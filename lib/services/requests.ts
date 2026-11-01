import 'server-only';
import { and, between, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  attendanceLogs,
  employees,
  explanations,
  positions,
  requests,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { toMinutes } from '@/lib/domain/shift';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays, atMinute } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { formatDecimal } from '@/lib/format';
import type { DecisionInput, ExplanationInput, RequestInput } from '@/lib/validation/request';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { loadEmployeeRules, recomputeDays } from './recompute';
import { assertOwned } from './references';
import { allowedShiftIds } from './schedule';

type Reader = Pick<Tx, 'select'>;

const DAY_MINUTES = 24 * 60;
const annualPayload = z.object({ leaveType: z.literal('annual'), days: z.number() });
const forgotPayload = z.object({
  shiftId: z.string(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
});

/** Phép năm còn lại: đơn đang chờ cũng giữ chỗ, để không gửi được hai đơn vượt phép cùng lúc. */
export async function leaveBalance(db: Reader, employeeId: string, year: string) {
  const [employee] = await db
    .select({ payOverride: employees.payOverride, leaveDays: positions.leaveDays })
    .from(employees)
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(eq(employees.id, employeeId));
  const leaves = await db
    .select({ payload: requests.payload })
    .from(requests)
    .where(
      and(
        eq(requests.employeeId, employeeId),
        eq(requests.type, 'leave'),
        inArray(requests.status, ['pending', 'approved']),
        between(requests.fromDate, `${year}-01-01`, `${year}-12-31`),
      ),
    );

  const total = employee?.payOverride?.leaveDays ?? employee?.leaveDays ?? 0;
  const used = leaves.reduce((sum, { payload }) => {
    const parsed = annualPayload.safeParse(payload);
    return parsed.success ? sum + parsed.data.days : sum;
  }, 0);
  return { total, used, remaining: total - used };
}

/** Công kỳ vọng của khoảng ngày: mỗi ngày tối đa 1, ca ghép 0,5 (C4); ngày không có ca không tính. */
async function leaveDaysBetween(tx: Tx, ctx: AuthContext, from: string, to: string) {
  const employeeId = ctx.employee.id;
  const rules = await loadEmployeeRules(tx, [employeeId]);
  const employee = rules.get(employeeId)!;
  const library = (await tx
    .select()
    .from(shifts)
    .where(eq(shifts.companyId, ctx.company.id))) as EngineShift[];
  const cells = await tx
    .select({ date: scheduleCells.date, shiftIds: scheduleCells.shiftIds, isOff: scheduleCells.isOff })
    .from(scheduleCells)
    .where(and(eq(scheduleCells.employeeId, employeeId), between(scheduleCells.date, from, to)));

  let days = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const schedule = cells.find((cell) => cell.date === date) ?? null;
    const expected = expectedShifts({ date, employee, schedule, shifts: library }).shifts;
    days += Math.min(
      1,
      expected.reduce((sum, { isPart }) => sum + (isPart ? 0.5 : 1), 0),
    );
  }
  return days;
}

async function leavePayload(tx: Tx, ctx: AuthContext, input: Extract<RequestInput, { type: 'leave' }>) {
  const { fromDate, toDate, leaveType } = input;
  const [overlap] = await tx
    .select({ id: requests.id })
    .from(requests)
    .where(
      and(
        eq(requests.employeeId, ctx.employee.id),
        eq(requests.type, 'leave'),
        inArray(requests.status, ['pending', 'approved']),
        lte(requests.fromDate, toDate),
        gte(requests.toDate, fromDate),
      ),
    )
    .limit(1);
  if (overlap) throw new ApiError(409, 'Đã có đơn nghỉ trong khoảng ngày này');

  const days = await leaveDaysBetween(tx, ctx, fromDate, toDate);
  if (days === 0) {
    const message = 'Những ngày này chưa có ca, cần xếp lịch trước khi xin nghỉ';
    throw new ApiError(400, message, { fromDate: message });
  }
  if (leaveType === 'annual') {
    const { remaining } = await leaveBalance(tx, ctx.employee.id, fromDate.slice(0, 4));
    if (days > remaining) {
      const message = `Vượt phép còn lại (còn ${formatDecimal(remaining)} ngày, xin ${formatDecimal(days)} ngày)`;
      throw new ApiError(400, message, { toDate: message });
    }
  }
  return { leaveType, days };
}

/** Nhân viên gửi đơn (US29–US31); khoảng ngày lưu ở cột, chi tiết từng loại lưu trong `payload`. */
export async function createRequest(ctx: AuthContext, input: RequestInput) {
  const companyId = ctx.company.id;
  const employeeId = ctx.employee.id;
  const fromDate = input.type === 'leave' ? input.fromDate : input.date;
  const toDate = input.type === 'leave' ? input.toDate : input.date;

  return getDb().transaction(async (tx) => {
    let payload: object;
    if (input.type === 'leave') {
      payload = await leavePayload(tx, ctx, input);
    } else if (input.type === 'forgot') {
      if (input.date > vietnamToday()) {
        throw new ApiError(400, 'Chưa tới ngày này', { date: 'Chưa tới ngày này' });
      }
      await assertOwned(tx, ctx, shifts, [input.shiftId], 'shiftId');
      const [employee] = await tx
        .select({ positionId: employees.positionId })
        .from(employees)
        .where(eq(employees.id, employeeId));
      const allowed = await allowedShiftIds(tx, [
        { id: employeeId, positionId: employee?.positionId ?? null },
      ]);
      if (!allowed.get(employeeId)?.includes(input.shiftId)) {
        throw new ApiError(400, 'Ca này không nằm trong ca bạn được làm', { shiftId: 'Ca không hợp lệ' });
      }
      payload = { shiftId: input.shiftId, inTime: input.inTime, outTime: input.outTime };
    } else {
      payload = { when: input.when, from: input.from, to: input.to };
    }

    const [request] = await tx
      .insert(requests)
      .values({ companyId, employeeId, type: input.type, payload, fromDate, toDate, reason: input.reason })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'request.create',
      entity: 'request',
      entityId: request!.id,
      after: request,
    });
    return request!;
  });
}

/** Đơn của tôi và phép còn lại năm nay (US29, US33). */
export async function listMyRequests(ctx: AuthContext) {
  const db = getDb();
  const [balance, rows] = await Promise.all([
    leaveBalance(db, ctx.employee.id, vietnamToday().slice(0, 4)),
    db
      .select({
        id: requests.id,
        type: requests.type,
        payload: requests.payload,
        fromDate: requests.fromDate,
        toDate: requests.toDate,
        reason: requests.reason,
        status: requests.status,
        rejectNote: requests.rejectNote,
        createdAt: requests.createdAt,
      })
      .from(requests)
      .where(eq(requests.employeeId, ctx.employee.id))
      .orderBy(desc(requests.createdAt)),
  ]);
  return { balance, requests: rows };
}

/** Đơn quên chấm thành lần chấm tổng hợp; giờ ra nhỏ hơn giờ vào là qua đêm. */
async function addSyntheticPunches(tx: Tx, request: typeof requests.$inferSelect) {
  const { shiftId, inTime, outTime } = forgotPayload.parse(request.payload);
  const inMinute = inTime ? toMinutes(inTime) : null;
  const outMinute = outTime ? toMinutes(outTime) : null;
  const crossesMidnight = inMinute !== null && outMinute !== null && outMinute < inMinute;
  const punch = (type: 'in' | 'out', minute: number) => ({
    companyId: request.companyId,
    employeeId: request.employeeId,
    at: atMinute(request.fromDate, minute),
    type,
    chosenShiftId: shiftId,
    synthetic: true,
    sourceRequestId: request.id,
  });
  await tx
    .insert(attendanceLogs)
    .values([
      ...(inMinute === null ? [] : [punch('in', inMinute)]),
      ...(outMinute === null ? [] : [punch('out', outMinute + (crossesMidnight ? DAY_MINUTES : 0))]),
    ]);
}

/** Duyệt hoặc từ chối đơn đang chờ (US33); đơn đã quyết định không đổi được nữa (C10). */
export async function decideRequest(ctx: AuthContext, id: string, { decision, note }: DecisionInput) {
  const companyId = ctx.company.id;
  await getDb().transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.id, id),
          scopeToStaff(ctx, { companyId: requests.companyId, employeeId: requests.employeeId }),
        ),
      )
      .for('update');
    if (!request) throw notFound('đơn');
    if (request.status !== 'pending') throw new ApiError(409, 'Đơn này đã được xử lý');

    const { employeeId, fromDate, toDate } = request;
    await assertCanDecide(tx, ctx, employeeId);

    const approve = decision === 'approve';
    const [after] = await tx
      .update(requests)
      .set({
        status: approve ? 'approved' : 'rejected',
        decidedBy: ctx.employee.id,
        decidedAt: new Date(),
        rejectNote: approve ? null : (note ?? null),
      })
      .where(eq(requests.id, id))
      .returning();
    if (approve && request.type === 'forgot') await addSyntheticPunches(tx, request);

    await writeAudit(tx, actorOf(ctx), {
      action: 'request.decide',
      entity: 'request',
      entityId: id,
      before: request,
      after,
    });
    // Tính cả ngày kế: đơn của ca đêm có giờ thuộc sáng hôm sau
    if (approve) {
      await recomputeDays(tx, {
        companyId,
        employeeIds: [employeeId],
        from: fromDate,
        to: addDays(toDate, 1),
      });
    }
  });
}

/** Gửi lại thì cập nhật lời giải trình và mở lại; lời giải trình gắn vào việc của ngày (C9). */
export async function saveExplanation(ctx: AuthContext, { date, shiftId, reason }: ExplanationInput) {
  const companyId = ctx.company.id;
  const employeeId = ctx.employee.id;
  if (date > vietnamToday()) throw new ApiError(400, 'Chưa tới ngày này', { date: 'Chưa tới ngày này' });

  return getDb().transaction(async (tx) => {
    await assertOwned(tx, ctx, shifts, [shiftId], 'shiftId');
    const [explanation] = await tx
      .insert(explanations)
      .values({ companyId, employeeId, date, shiftId, reason })
      .onConflictDoUpdate({
        target: [explanations.employeeId, explanations.date, explanations.shiftId],
        set: { reason, status: 'pending' },
      })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'explanation.save',
      entity: 'explanation',
      entityId: explanation!.id,
      after: explanation,
    });
    await recomputeDays(tx, { companyId, employeeIds: [employeeId], from: date, to: date });
    return explanation!;
  });
}
