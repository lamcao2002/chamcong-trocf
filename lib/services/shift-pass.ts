import 'server-only';
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { employees, positionCovers, positions, requests, scheduleCells, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { shiftSpanMinutes, toMinutes } from '@/lib/domain/shift';
import { positionOfShift } from '@/lib/domain/shift-positions';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays, atMinute } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { formatDate } from '@/lib/format';
import type { PassResponseInput, RequestInput } from '@/lib/validation/request';
import { actorOf } from './actor';
import { notify } from './notifications';
import { loadEmployeeRules, lockEmployees, recomputeDays } from './recompute';
import { writeCells } from './schedule';
import { positionsOf } from './staff-positions';

type Reader = Pick<Tx, 'select'>;

/** Pass được ca của hôm nay tới chừng này ngày tới, theo lịch đã công bố. */
const PASS_DAYS = 14;
const MINUTE_MS = 60_000;

export const passPayload = z.object({
  shiftId: z.string(),
  positionId: z.string().nullable(),
  positionName: z.string().nullable(),
  toName: z.string(),
  startsAt: z.string(),
});

/** Đơn pass ca hết hạn khi ca bắt đầu mà người nhận chưa trả lời. */
export function passExpired(payload: unknown, now: Date) {
  const parsed = passPayload.safeParse(payload);
  return parsed.success && now >= new Date(parsed.data.startsAt);
}

type Shift = typeof shifts.$inferSelect;

/** Khoảng thời gian thật của một ca trong ngày, ca qua đêm kéo sang hôm sau. */
function spanOf(date: string, shift: Pick<Shift, 'startTime' | 'endTime'>): [number, number] {
  const start = atMinute(date, toMinutes(shift.startTime)).getTime();
  return [start, start + shiftSpanMinutes(shift) * MINUTE_MS];
}

const overlaps = ([a, b]: [number, number], [c, d]: [number, number]) => a < d && c < b;

/** Ca thực tế của nhiều người trong một ngày, tính cả ca cố định khi chưa có ô lịch. */
async function shiftsOn(
  db: Reader,
  ctx: AuthContext,
  ids: readonly string[],
  date: string,
  library: Shift[],
) {
  if (ids.length === 0) return new Map<string, string[]>();
  const [rules, cells] = await Promise.all([
    loadEmployeeRules(db, ids),
    db
      .select({
        employeeId: scheduleCells.employeeId,
        shiftIds: scheduleCells.shiftIds,
        isOff: scheduleCells.isOff,
        positions: scheduleCells.positions,
      })
      .from(scheduleCells)
      .where(and(inArray(scheduleCells.employeeId, [...ids]), eq(scheduleCells.date, date))),
  ]);
  return new Map(
    ids.map((id) => {
      const rule = rules.get(id);
      if (!rule) return [id, []];
      const cell = cells.find((row) => row.employeeId === id) ?? null;
      const expected = expectedShifts({
        date,
        employee: rule,
        schedule: cell,
        shifts: library as EngineShift[],
      });
      return [id, expected.shifts.map((shift) => shift.id)];
    }),
  );
}

/** Vị trí một người nhận được khi pass ca: vị trí họ làm và những vị trí đó làm thay được. */
async function takeablePositions(db: Reader, rows: { id: string; positionId: string | null }[]) {
  const held = await positionsOf(db, rows);
  const all = [...new Set([...held.values()].flat())];
  const covers =
    all.length === 0
      ? []
      : await db.select().from(positionCovers).where(inArray(positionCovers.positionId, all));
  return new Map(
    rows.map(({ id }) => {
      const mine = held.get(id) ?? [];
      const extra = covers.filter((row) => mine.includes(row.positionId)).map((row) => row.coversId);
      return [id, new Set([...mine, ...extra])];
    }),
  );
}

async function library(db: Reader, ctx: AuthContext) {
  return db.select().from(shifts).where(scopeToCompany(ctx, shifts.companyId));
}

type Slot = {
  date: string;
  shift: Shift;
  positionId: string | null;
  positionName: string | null;
  startsAt: Date;
};

/** Một ca của chính mình, chưa bắt đầu, còn trong lịch đã công bố; vị trí lấy từ ô lịch. */
async function ownSlot(
  db: Reader,
  ctx: AuthContext,
  date: string,
  shiftId: string,
  now: Date,
): Promise<Slot> {
  const all = await library(db, ctx);
  const shift = all.find(({ id }) => id === shiftId);
  if (!shift) throw new ApiError(400, 'Ca không hợp lệ', { shiftId: 'Ca không hợp lệ' });
  const startsAt = new Date(spanOf(date, shift)[0]);
  if (startsAt <= now) {
    throw new ApiError(400, 'Ca đã bắt đầu hoặc đã qua, không pass được', { shiftId: 'Ca đã qua' });
  }
  const mine = (await shiftsOn(db, ctx, [ctx.employee.id], date, all)).get(ctx.employee.id) ?? [];
  if (!mine.includes(shiftId)) {
    throw new ApiError(400, 'Ngày này bạn không có ca đó trong lịch', { shiftId: 'Ca không có trong lịch' });
  }
  const [[person], [cell]] = await Promise.all([
    db.select({ positionId: employees.positionId }).from(employees).where(eq(employees.id, ctx.employee.id)),
    db
      .select({ positions: scheduleCells.positions })
      .from(scheduleCells)
      .where(and(eq(scheduleCells.employeeId, ctx.employee.id), eq(scheduleCells.date, date))),
  ]);
  const positionId = positionOfShift(cell?.positions, shiftId, person?.positionId ?? null);
  const [position] = positionId
    ? await db.select({ name: positions.name }).from(positions).where(eq(positions.id, positionId))
    : [];
  return { date, shift, positionId, positionName: position?.name ?? null, startsAt };
}

/** Ca pass đang chờ người nhận trả lời: một ca chỉ có một đơn như vậy. */
async function pendingPassKeys(db: Reader, employeeId: string, from: string, to: string, now: Date) {
  const rows = await db
    .select({ fromDate: requests.fromDate, payload: requests.payload })
    .from(requests)
    .where(
      and(
        eq(requests.employeeId, employeeId),
        eq(requests.type, 'shift_pass'),
        eq(requests.status, 'pending'),
        gte(requests.fromDate, from),
        lte(requests.fromDate, to),
      ),
    );
  return new Set(
    rows
      .filter(({ payload }) => !passExpired(payload, now))
      .map(({ fromDate, payload }) => `${fromDate}|${passPayload.parse(payload).shiftId}`),
  );
}

/** Ca của tôi pass được: từ giờ tới 14 ngày, chưa bắt đầu, chưa có đơn pass đang chờ. */
export async function myPassableShifts(ctx: AuthContext, now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const to = addDays(today, PASS_DAYS - 1);
  const all = await library(db, ctx);
  const [[person], cells, waiting] = await Promise.all([
    db.select({ positionId: employees.positionId }).from(employees).where(eq(employees.id, ctx.employee.id)),
    db
      .select({ date: scheduleCells.date, positions: scheduleCells.positions })
      .from(scheduleCells)
      .where(
        and(
          eq(scheduleCells.employeeId, ctx.employee.id),
          gte(scheduleCells.date, today),
          lte(scheduleCells.date, to),
        ),
      ),
    pendingPassKeys(db, ctx.employee.id, today, to, now),
  ]);
  const positionRows = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(scopeToCompany(ctx, positions.companyId));

  const result = [];
  for (let date = today; date <= to; date = addDays(date, 1)) {
    const ids = (await shiftsOn(db, ctx, [ctx.employee.id], date, all)).get(ctx.employee.id) ?? [];
    for (const shift of all.filter(({ id }) => ids.includes(id))) {
      const startsAt = new Date(spanOf(date, shift)[0]);
      if (startsAt <= now || waiting.has(`${date}|${shift.id}`)) continue;
      const cell = cells.find((row) => row.date === date);
      const positionId = positionOfShift(cell?.positions, shift.id, person?.positionId ?? null);
      result.push({
        date,
        shiftId: shift.id,
        shiftName: shift.name,
        startTime: shift.startTime.slice(0, 5),
        endTime: shift.endTime.slice(0, 5),
        positionId,
        positionName: positionRows.find(({ id }) => id === positionId)?.name ?? null,
      });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export type PassableShift = Awaited<ReturnType<typeof myPassableShifts>>[number];

/**
 * Người nhận được ca: đang làm, không phải mình, hôm đó không có ca trùng giờ (kể cả ca đêm hôm
 * trước), và làm được vị trí của ca (vị trí của họ hoặc vị trí họ làm thay được).
 */
async function eligibleTakers(db: Reader, ctx: AuthContext, slot: Slot, onlyId?: string) {
  const all = await library(db, ctx);
  const staff = await db
    .select({ id: employees.id, name: employees.name, positionId: employees.positionId })
    .from(employees)
    .where(
      and(
        scopeToCompany(ctx, employees.companyId),
        eq(employees.status, 'active'),
        lte(employees.onboardDate, slot.date),
        or(isNull(employees.leftDate), gte(employees.leftDate, slot.date)),
        onlyId ? eq(employees.id, onlyId) : undefined,
      ),
    )
    .orderBy(asc(employees.name));
  const others = staff.filter(({ id }) => id !== ctx.employee.id);
  const ids = others.map(({ id }) => id);
  const previous = addDays(slot.date, -1);
  const [today, yesterday, takeable, held] = await Promise.all([
    shiftsOn(db, ctx, ids, slot.date, all),
    shiftsOn(db, ctx, ids, previous, all),
    takeablePositions(db, others),
    positionsOf(db, others),
  ]);
  const positionRows = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(scopeToCompany(ctx, positions.companyId));
  const target = spanOf(slot.date, slot.shift);
  const busy = (date: string, shiftIds: string[]) =>
    all.filter(({ id }) => shiftIds.includes(id)).some((shift) => overlaps(spanOf(date, shift), target));

  return others
    .filter(
      ({ id }) =>
        !busy(slot.date, today.get(id) ?? []) &&
        !busy(previous, yesterday.get(id) ?? []) &&
        (!slot.positionId || takeable.get(id)?.has(slot.positionId)),
    )
    .map(({ id, name }) => ({
      id,
      name,
      positionNames: (held.get(id) ?? []).map(
        (positionId) => positionRows.find((row) => row.id === positionId)?.name ?? '',
      ),
    }));
}

/** Danh sách người nhận được một ca của tôi, cho ô chọn trong form Pass ca. */
export async function passCandidates(ctx: AuthContext, date: string, shiftId: string) {
  const db = getDb();
  const slot = await ownSlot(db, ctx, date, shiftId, new Date());
  return eligibleTakers(db, ctx, slot);
}

/** Kiểm tra và dựng chi tiết đơn pass ca lúc gửi; trả cả người nhận để ghi vào cột riêng. */
export async function passRequestOf(
  tx: Tx,
  ctx: AuthContext,
  input: Extract<RequestInput, { type: 'shift_pass' }>,
) {
  const now = new Date();
  const slot = await ownSlot(tx, ctx, input.date, input.shiftId, now);
  const waiting = await pendingPassKeys(tx, ctx.employee.id, input.date, input.date, now);
  if (waiting.has(`${input.date}|${input.shiftId}`))
    throw new ApiError(409, 'Ca này đã có đơn pass đang chờ trả lời');
  const [taker] = await eligibleTakers(tx, ctx, slot, input.toEmployeeId);
  if (!taker) {
    const message = 'Người này không nhận được ca: trùng ca, đã nghỉ hoặc không làm được vị trí của ca';
    throw new ApiError(400, message, { toEmployeeId: message });
  }
  return {
    targetEmployeeId: taker.id,
    payload: {
      shiftId: slot.shift.id,
      positionId: slot.positionId,
      positionName: slot.positionName,
      toName: taker.name,
      startsAt: slot.startsAt.toISOString(),
    },
    notice: `${ctx.employee.name} muốn pass ${slot.shift.name} ${formatDate(input.date).slice(0, 5)} cho bạn`,
  };
}

/** Báo cho người được pass ca ngay sau khi tạo đơn, mở thẳng tab Tôi để trả lời. */
export async function notifyPassTarget(tx: Tx, ctx: AuthContext, targetEmployeeId: string, body: string) {
  await notify(tx, [
    {
      companyId: ctx.company.id,
      employeeId: targetEmployeeId,
      kind: 'request',
      title: 'Có người pass ca cho bạn',
      body,
      href: '#/toi',
    },
  ]);
}

/** Đơn pass ca gửi tới tôi đang chờ trả lời, chưa hết hạn. */
export async function incomingPasses(db: Reader, ctx: AuthContext, now: Date = new Date()) {
  const rows = await db
    .select({
      id: requests.id,
      fromDate: requests.fromDate,
      payload: requests.payload,
      reason: requests.reason,
      createdAt: requests.createdAt,
      fromName: employees.name,
    })
    .from(requests)
    .innerJoin(employees, eq(employees.id, requests.employeeId))
    .where(
      and(
        eq(requests.companyId, ctx.company.id),
        eq(requests.type, 'shift_pass'),
        eq(requests.status, 'pending'),
        eq(requests.targetEmployeeId, ctx.employee.id),
      ),
    )
    .orderBy(asc(requests.fromDate));
  const all = await library(db, ctx);
  return rows
    .filter(({ payload }) => !passExpired(payload, now))
    .map(({ payload, ...row }) => {
      const pass = passPayload.parse(payload);
      const shift = all.find(({ id }) => id === pass.shiftId);
      return {
        ...row,
        shiftName: shift?.name ?? '',
        startTime: shift?.startTime.slice(0, 5) ?? '',
        endTime: shift?.endTime.slice(0, 5) ?? '',
        positionName: pass.positionName,
        startsAt: pass.startsAt,
      };
    });
}

export type IncomingPass = Awaited<ReturnType<typeof incomingPasses>>[number];

/**
 * Người nhận trả lời. Đồng ý thì lịch đổi ngay, không cần quản lý duyệt: gỡ ca khỏi người gửi, thêm
 * vào người nhận với vị trí của ca, tính lại ngày công cả hai. Ca đã bắt đầu thì đơn hết hạn.
 */
export async function respondPass(ctx: AuthContext, id: string, { decision }: PassResponseInput) {
  const companyId = ctx.company.id;
  const receiver = ctx.employee.id;
  return getDb().transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.id, id),
          eq(requests.companyId, companyId),
          eq(requests.type, 'shift_pass'),
          eq(requests.targetEmployeeId, receiver),
        ),
      )
      .for('update');
    if (!request) throw notFound('đơn');
    if (request.status !== 'pending') throw new ApiError(409, 'Đơn này đã được trả lời');
    const now = new Date();
    if (passExpired(request.payload, now)) throw new ApiError(409, 'Ca đã bắt đầu, đơn pass ca đã hết hạn');

    const giver = request.employeeId;
    const date = request.fromDate;
    const pass = passPayload.parse(request.payload);
    await lockEmployees(tx, [giver, receiver]);
    const all = await library(tx, ctx);
    const shift = all.find(({ id: shiftId }) => shiftId === pass.shiftId);
    const label = `${shift?.name ?? 'ca'} ${formatDate(date).slice(0, 5)}`;
    const accept = decision === 'accept';

    if (accept) {
      const giverCtx = { ...ctx, employee: { ...ctx.employee, id: giver } };
      const slot = {
        date,
        shift: shift!,
        positionId: pass.positionId,
        positionName: pass.positionName,
        startsAt: new Date(pass.startsAt),
      };
      const current = await shiftsOn(tx, ctx, [giver, receiver], date, all);
      if (!current.get(giver)?.includes(pass.shiftId)) {
        throw new ApiError(409, 'Lịch của người gửi đã đổi, ca này không còn để nhận');
      }
      if ((await eligibleTakers(tx, giverCtx, slot, receiver)).length === 0) {
        throw new ApiError(409, 'Bạn không còn nhận được ca này: trùng ca hoặc không làm được vị trí');
      }
      const [rules, cells] = await Promise.all([
        loadEmployeeRules(tx, [giver]),
        tx
          .select()
          .from(scheduleCells)
          .where(and(inArray(scheduleCells.employeeId, [giver, receiver]), eq(scheduleCells.date, date))),
      ]);
      const kept = current.get(giver)!.filter((shiftId) => shiftId !== pass.shiftId);
      // Người ca cố định mà để ô trống thì ca cố định quay lại, nên ghi Cho nghỉ
      const giverOff = kept.length === 0 && rules.get(giver)?.shiftMode === 'fixed';
      const receiverCell = cells.find((row) => row.employeeId === receiver);
      await writeCells(
        tx,
        ctx,
        [
          { employeeId: giver, date, shiftIds: kept, isOff: giverOff },
          {
            employeeId: receiver,
            date,
            shiftIds: [...(current.get(receiver) ?? []), pass.shiftId],
            isOff: false,
            positions: {
              ...receiverCell?.positions,
              ...(pass.positionId ? { [pass.shiftId]: pass.positionId } : {}),
            },
          },
        ],
        { silent: true },
      );
      for (const employeeId of [giver, receiver]) {
        await recomputeDays(tx, { companyId, employeeIds: [employeeId], from: date, to: addDays(date, 1) });
      }
    }

    const [after] = await tx
      .update(requests)
      .set({ status: accept ? 'approved' : 'rejected', decidedBy: receiver, decidedAt: now })
      .where(eq(requests.id, id))
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: accept ? 'request.pass_accept' : 'request.pass_decline',
      entity: 'request',
      entityId: id,
      before: request,
      after,
    });

    const [giverRow] = await tx
      .select({ name: employees.name, managerId: employees.managerId })
      .from(employees)
      .where(eq(employees.id, giver));
    const [receiverRow] = await tx
      .select({ managerId: employees.managerId })
      .from(employees)
      .where(eq(employees.id, receiver));
    const managers = accept
      ? [...new Set([giverRow?.managerId, receiverRow?.managerId])].filter(
          (managerId): managerId is string => !!managerId && managerId !== giver && managerId !== receiver,
        )
      : [];
    await notify(tx, [
      {
        companyId,
        employeeId: giver,
        kind: 'request',
        title: accept ? 'Pass ca thành công' : 'Pass ca bị từ chối',
        body: `${ctx.employee.name} ${accept ? 'đã nhận' : 'không nhận'} ${label}`,
        href: '#/toi',
      },
      ...managers.map((managerId) => ({
        companyId,
        employeeId: managerId,
        kind: 'request' as const,
        title: 'Lịch đổi do pass ca',
        body: `${giverRow?.name ?? ''} đã pass ${label} cho ${ctx.employee.name}`,
        href: '/app/don-tu',
      })),
    ]);
    return after!;
  });
}
