import 'server-only';
import { and, between, desc, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';
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
import { requestSummary } from '@/lib/domain/request-text';
import { editableUntil, REQUEST_EDIT_MINUTES } from '@/lib/domain/request-window';
import { toMinutes } from '@/lib/domain/shift';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays, atMinute } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { formatDate, formatDecimal } from '@/lib/format';
import type { DecisionInput, ExplanationInput, RequestInput } from '@/lib/validation/request';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { notify } from './notifications';
import { loadEmployeeRules, lockEmployees, recomputeDays } from './recompute';
import { assertOwned } from './references';
import { allowedShiftIds, expectedShiftIds, firstDraftDate, writeCells } from './schedule';
import { acceptIntoDraft, dropFromDrafts, removeRegistrationFromDraft } from './schedule-drafts';
import { currentRegistrationWindow } from './registration-window';

type Reader = Pick<Tx, 'select'>;

const DAY_MINUTES = 24 * 60;
const annualPayload = z.object({ leaveType: z.literal('annual'), days: z.number() });
const forgotPayload = z.object({
  shiftId: z.string(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
});
const swapPayload = z.object({
  offDate: z.string(),
  offShiftId: z.string(),
  workDate: z.string(),
  workShiftId: z.string(),
});
const registerPayload = z.object({ shiftId: z.string() });
const STATUS_TEXT = { approve: 'đã được duyệt', reject: 'bị từ chối' };

/** Phép năm còn lại: đơn đang chờ cũng giữ chỗ, để không gửi được hai đơn vượt phép cùng lúc. */
export async function leaveBalance(db: Reader, employeeId: string, year: string, excludeId?: string) {
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
        excludeId ? ne(requests.id, excludeId) : undefined,
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

/** `excludeId`: đơn đang được sửa, không tính là trùng với chính nó. */
async function leavePayload(
  tx: Tx,
  ctx: AuthContext,
  input: Extract<RequestInput, { type: 'leave' }>,
  excludeId?: string,
) {
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
        excludeId ? ne(requests.id, excludeId) : undefined,
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
    const { remaining } = await leaveBalance(tx, ctx.employee.id, fromDate.slice(0, 4), excludeId);
    if (days > remaining) {
      const message = `Vượt phép còn lại (còn ${formatDecimal(remaining)} ngày, xin ${formatDecimal(days)} ngày)`;
      throw new ApiError(400, message, { toDate: message });
    }
  }
  return { leaveType, days };
}

async function allowedFor(tx: Tx, employeeId: string) {
  const [employee] = await tx
    .select({ positionId: employees.positionId })
    .from(employees)
    .where(eq(employees.id, employeeId));
  const allowed = await allowedShiftIds(tx, [{ id: employeeId, positionId: employee?.positionId ?? null }]);
  return allowed.get(employeeId) ?? [];
}

async function assertAllowedShift(tx: Tx, ctx: AuthContext, shiftId: string, field: string) {
  await assertOwned(tx, ctx, shifts, [shiftId], field);
  if (!(await allowedFor(tx, ctx.employee.id)).includes(shiftId)) {
    throw new ApiError(400, 'Ca này không nằm trong ca bạn được làm', { [field]: 'Ca không hợp lệ' });
  }
}

/** Mỗi ngày chỉ một đơn đi trễ và một đơn về sớm: hai đơn cộng dồn sẽ khó hiểu lúc đối chiếu. */
async function lateEarlyPayload(
  tx: Tx,
  ctx: AuthContext,
  input: Extract<RequestInput, { type: 'late_early' }>,
  excludeId?: string,
) {
  if (input.shiftId) await assertAllowedShift(tx, ctx, input.shiftId, 'shiftId');
  const sameDay = await tx
    .select({ payload: requests.payload })
    .from(requests)
    .where(
      and(
        eq(requests.employeeId, ctx.employee.id),
        eq(requests.type, 'late_early'),
        eq(requests.fromDate, input.date),
        inArray(requests.status, ['pending', 'approved']),
        excludeId ? ne(requests.id, excludeId) : undefined,
      ),
    );
  if (sameDay.some(({ payload }) => (payload as { kind?: string }).kind === input.kind)) {
    throw new ApiError(409, 'Ngày này đã có đơn cùng loại');
  }
  return { kind: input.kind, minutes: input.minutes, shiftId: input.shiftId };
}

async function swapPayloadOf(tx: Tx, ctx: AuthContext, input: Extract<RequestInput, { type: 'shift_swap' }>) {
  const { offDate, offShiftId, workDate, workShiftId } = input;
  const today = vietnamToday();
  if (offDate < today || workDate < today) {
    const message = 'Chỉ đổi được ca từ hôm nay trở đi';
    throw new ApiError(400, message, { offDate: message });
  }
  await assertAllowedShift(tx, ctx, workShiftId, 'workShiftId');

  const employeeId = ctx.employee.id;
  const offShifts = await expectedShiftIds(tx, ctx, employeeId, offDate);
  if (!offShifts.includes(offShiftId)) {
    const message = 'Ngày này bạn không có ca đó';
    throw new ApiError(400, message, { offShiftId: message });
  }
  const workShifts = await expectedShiftIds(tx, ctx, employeeId, workDate);
  if (workShifts.includes(workShiftId)) {
    const message = 'Ngày làm bù đã có ca này';
    throw new ApiError(400, message, { workShiftId: message });
  }
  return { offDate, offShiftId, workDate, workShiftId };
}

/** Chi tiết từng loại đơn, kiểm tra theo cùng quy tắc khi gửi và khi sửa. */
async function payloadOf(tx: Tx, ctx: AuthContext, input: RequestInput, excludeId?: string): Promise<object> {
  if (input.type === 'leave') return leavePayload(tx, ctx, input, excludeId);
  if (input.type === 'forgot') {
    if (input.date > vietnamToday()) {
      throw new ApiError(400, 'Chưa tới ngày này', { date: 'Chưa tới ngày này' });
    }
    await assertAllowedShift(tx, ctx, input.shiftId, 'shiftId');
    return { shiftId: input.shiftId, inTime: input.inTime, outTime: input.outTime };
  }
  if (input.type === 'late_early') return lateEarlyPayload(tx, ctx, input, excludeId);
  if (input.type === 'shift_swap') return swapPayloadOf(tx, ctx, input);
  return { when: input.when, from: input.from, to: input.to };
}

/** Nhân viên gửi đơn (US29–US31); khoảng ngày lưu ở cột, chi tiết từng loại lưu trong `payload`. */
export async function createRequest(ctx: AuthContext, input: RequestInput) {
  const companyId = ctx.company.id;
  const employeeId = ctx.employee.id;
  const [fromDate, toDate] = dateRangeOf(input);

  return getDb().transaction(async (tx) => {
    const payload = await payloadOf(tx, ctx, input);
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

/** Đơn của chính mình, khoá dòng; quá hạn sửa hoặc đã được quyết định thì từ chối. */
async function lockOwnEditable(tx: Tx, ctx: AuthContext, id: string) {
  const [request] = await tx
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.employeeId, ctx.employee.id)))
    .for('update');
  if (!request) throw notFound('đơn');
  if (request.status !== 'pending') throw new ApiError(409, 'Đơn đã được xử lý, không sửa hay xoá được nữa');
  if (!editableUntil(request, new Date(), currentRegistrationWindow())) {
    throw new ApiError(
      409,
      request.type === 'shift_register'
        ? 'Đã hết giờ đăng ký ca, không sửa hay xoá được nữa'
        : `Đã quá ${REQUEST_EDIT_MINUTES} phút từ lúc gửi, không sửa hay xoá được nữa`,
    );
  }
  return request;
}

/** Sửa đơn trong 10 phút đầu khi còn chờ; giữ loại đơn, hạn sửa vẫn tính từ lúc gửi lần đầu. */
export async function updateMyRequest(ctx: AuthContext, id: string, input: RequestInput) {
  return getDb().transaction(async (tx) => {
    const before = await lockOwnEditable(tx, ctx, id);
    if (before.type === 'shift_register') {
      throw new ApiError(400, 'Đăng ký ca sửa trên lưới đăng ký: bỏ ô cũ rồi chọn ô mới');
    }
    if (input.type !== before.type)
      throw new ApiError(400, 'Không đổi được loại đơn, hãy xoá rồi gửi đơn mới');

    const [fromDate, toDate] = dateRangeOf(input);
    const payload = await payloadOf(tx, ctx, input, id);
    const [after] = await tx
      .update(requests)
      .set({ payload, fromDate, toDate, reason: input.reason })
      .where(eq(requests.id, id))
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'request.update',
      entity: 'request',
      entityId: id,
      before,
      after,
    });
    return after!;
  });
}

/**
 * Xoá hẳn đơn còn chờ trong hạn sửa. Đăng ký ca đã được nhận vào nháp thì gỡ luôn ca đó khỏi nháp,
 * để quản lý thấy ô đổi trước khi Công bố. Nhật ký giữ bản đơn đã xoá.
 */
export async function deleteMyRequest(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    await lockEmployees(tx, [ctx.employee.id]);
    const before = await lockOwnEditable(tx, ctx, id);
    if (before.type === 'shift_register') await removeRegistrationFromDraft(tx, ctx, before);
    await tx.delete(requests).where(eq(requests.id, id));
    await writeAudit(tx, actorOf(ctx), { action: 'request.delete', entity: 'request', entityId: id, before });
  });
}

function dateRangeOf(input: RequestInput): [string, string] {
  if (input.type === 'leave') return [input.fromDate, input.toDate];
  if (input.type === 'shift_swap') {
    return [input.offDate, input.workDate].sort() as [string, string];
  }
  return [input.date, input.date];
}

/** Đơn của tôi và phép còn lại năm nay (US29, US33). */
export async function listMyRequests(ctx: AuthContext) {
  const db = getDb();
  const [balance, library, rows] = await Promise.all([
    leaveBalance(db, ctx.employee.id, vietnamToday().slice(0, 4)),
    db.select({ id: shifts.id, name: shifts.name }).from(shifts).where(eq(shifts.companyId, ctx.company.id)),
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
  const shiftName = (id: unknown) => library.find((shift) => shift.id === id)?.name ?? null;
  const now = new Date();
  const window = currentRegistrationWindow(now);
  return {
    balance,
    requests: rows.map(({ payload, ...row }) => ({
      ...row,
      /** Chi tiết để mở lại form khi sửa. */
      payload: payload as Record<string, unknown>,
      summary: requestSummary(row.type, payload as Record<string, unknown>, shiftName),
      editableUntil: editableUntil(row, now, window)?.toISOString() ?? null,
    })),
  };
}

export type MyRequestView = Awaited<ReturnType<typeof listMyRequests>>['requests'][number];

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

/** Đã chấm công thì giờ làm thật đã gắn với ca cũ: đổi lịch lúc này làm sai ngày công, để quản lý sửa tay. */
async function assertNoPunches(tx: Tx, employeeId: string, dates: readonly string[]) {
  for (const date of dates) {
    const [punch] = await tx
      .select({ id: attendanceLogs.id })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.employeeId, employeeId),
          gte(attendanceLogs.at, atMinute(date, 0)),
          lt(attendanceLogs.at, atMinute(date, DAY_MINUTES)),
        ),
      )
      .limit(1);
    if (punch) {
      throw new ApiError(
        409,
        `Ngày ${formatDate(date)} đã có lần chấm, không đổi ca được. Hãy sửa lịch tay.`,
      );
    }
  }
}

async function assertStillAllowed(tx: Tx, employeeId: string, shiftId: string) {
  if (!(await allowedFor(tx, employeeId)).includes(shiftId)) {
    throw new ApiError(409, 'Ca này không còn trong ca được làm của nhân viên');
  }
}

/** Đổi ca: bỏ ca nghỉ, thêm ca bù. Ngày hết ca thành Cho nghỉ, vì ô trống sẽ quay lại ca cố định. */
async function applySwap(tx: Tx, ctx: AuthContext, request: typeof requests.$inferSelect) {
  const { employeeId } = request;
  const { offDate, offShiftId, workDate, workShiftId } = swapPayload.parse(request.payload);
  await assertNoPunches(tx, employeeId, [...new Set([offDate, workDate])]);
  await assertStillAllowed(tx, employeeId, workShiftId);

  const offShifts = await expectedShiftIds(tx, ctx, employeeId, offDate);
  if (!offShifts.includes(offShiftId)) throw new ApiError(409, 'Lịch ngày nghỉ đã đổi, đơn không còn đúng');
  const kept = offShifts.filter((id) => id !== offShiftId);

  const silent = { silent: true };
  if (offDate === workDate) {
    const shiftIds = [...kept, workShiftId];
    await writeCells(tx, ctx, [{ employeeId, date: offDate, shiftIds, isOff: false }], silent);
    return;
  }
  const workShifts = await expectedShiftIds(tx, ctx, employeeId, workDate);
  if (workShifts.includes(workShiftId)) throw new ApiError(409, 'Ngày làm bù đã có ca này');
  await writeCells(
    tx,
    ctx,
    [
      { employeeId, date: offDate, shiftIds: kept, isOff: kept.length === 0 },
      { employeeId, date: workDate, shiftIds: [...workShifts, workShiftId], isOff: false },
    ],
    silent,
  );
}

/** Nhận đăng ký: thêm ca vào lịch, đã có sẵn thì thôi. */
async function applyRegistration(tx: Tx, ctx: AuthContext, request: typeof requests.$inferSelect) {
  const { employeeId, fromDate: date } = request;
  const { shiftId } = registerPayload.parse(request.payload);
  await assertStillAllowed(tx, employeeId, shiftId);
  const current = await expectedShiftIds(tx, ctx, employeeId, date);
  if (current.includes(shiftId)) return;
  const shiftIds = [...current, shiftId];
  await writeCells(tx, ctx, [{ employeeId, date, shiftIds, isOff: false }], { silent: true });
}

/** Đổi trạng thái đơn và áp hiệu lực của nó; người gọi đã khoá đơn và kiểm tra quyền. */
export async function applyDecision(
  tx: Tx,
  ctx: AuthContext,
  request: typeof requests.$inferSelect,
  decision: DecisionInput['decision'],
  note: string | null,
) {
  const approve = decision === 'approve';
  const [after] = await tx
    .update(requests)
    .set({
      status: approve ? 'approved' : 'rejected',
      decidedBy: ctx.employee.id,
      decidedAt: new Date(),
      rejectNote: approve ? null : note,
    })
    .where(eq(requests.id, request.id))
    .returning();
  if (approve && request.type === 'forgot') await addSyntheticPunches(tx, request);
  if (approve && request.type === 'shift_swap') await applySwap(tx, ctx, request);
  if (approve && request.type === 'shift_register') await applyRegistration(tx, ctx, request);
  if (!approve && request.type === 'shift_register') await dropFromDrafts(tx, request.id);

  await writeAudit(tx, actorOf(ctx), {
    action: 'request.decide',
    entity: 'request',
    entityId: request.id,
    before: request,
    after,
  });
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
    // Nhận ca từ ngày mai trở đi chỉ vào nháp như ở màn Xếp ca; Công bố mới báo cho nhân viên
    if (request.type === 'shift_register' && decision === 'approve' && fromDate >= firstDraftDate()) {
      await lockEmployees(tx, [employeeId]);
      await acceptIntoDraft(tx, ctx, request, null);
      return;
    }
    await applyDecision(tx, ctx, request, decision, note ?? null);

    const library = await tx
      .select({ id: shifts.id, name: shifts.name })
      .from(shifts)
      .where(eq(shifts.companyId, companyId));
    const summary = requestSummary(
      request.type,
      request.payload as Record<string, unknown>,
      (shiftId) => library.find((shift) => shift.id === shiftId)?.name ?? null,
    );
    const rejectNote = decision === 'reject' && note ? [note] : [];
    await notify(tx, [
      {
        companyId,
        employeeId,
        kind: 'request',
        title: `Đơn ${STATUS_TEXT[decision]}`,
        body: [summary, formatDate(fromDate).slice(0, 5), ...rejectNote].join(' · '),
        href: '#/lich',
      },
    ]);

    // Tính cả ngày kế: đơn của ca đêm có giờ thuộc sáng hôm sau
    if (decision === 'approve') {
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
