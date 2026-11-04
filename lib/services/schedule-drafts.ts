import 'server-only';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { employees, payrollPeriods, requests, scheduleCells, scheduleDrafts } from '@/lib/db/schema';
import { normalizePositions, sameScheduleCell } from '@/lib/domain/shift-positions';
import { addDays } from '@/lib/engine/time';
import type { ScheduleSaveInput } from '@/lib/validation/schedule';
import { actorOf } from './actor';
import { recomputeDays } from './recompute';
import {
  allowedShiftIds,
  assertCellsAllowed,
  cellMatch,
  firstDraftDate,
  primaryPositions,
  writeCells,
  type CellWrite,
} from './schedule';
import { positionsOf } from './staff-positions';

const EMPTY = { shiftIds: [] as string[], isOff: false, positions: {} };

const shiftOf = (payload: unknown) => (payload as { shiftId?: string }).shiftId ?? '';

/**
 * Ghi nháp cả ô như sẽ công bố. Nháp giống hệt lịch đã công bố là xoá nháp. Đơn đăng ký đã nhận vào
 * nháp mà ca của nó bị gỡ khỏi ô thì quay về chờ nhận.
 */
export async function writeDrafts(tx: Tx, ctx: AuthContext, cells: readonly CellWrite[]) {
  const [published, existing, primary] = await Promise.all([
    tx.select().from(scheduleCells).where(cellMatch(scheduleCells, cells)),
    tx.select().from(scheduleDrafts).where(cellMatch(scheduleDrafts, cells)),
    primaryPositions(
      tx,
      cells.map(({ employeeId }) => employeeId),
    ),
  ]);
  const linked = existing.flatMap(({ registrationIds }) => registrationIds);
  const registrations =
    linked.length === 0
      ? []
      : await tx
          .select({ id: requests.id, payload: requests.payload })
          .from(requests)
          .where(inArray(requests.id, linked));
  const find = <T extends { employeeId: string; date: string }>(rows: T[], cell: CellWrite) =>
    rows.find((row) => row.employeeId === cell.employeeId && row.date === cell.date);

  for (const cell of cells) {
    const { employeeId, date, shiftIds, isOff } = cell;
    const first = primary.get(employeeId) ?? null;
    const old = find(existing, cell);
    const live = find(published, cell) ?? EMPTY;
    const positions = normalizePositions(shiftIds, cell.positions ?? old?.positions ?? live.positions, first);
    const registrationIds = (old?.registrationIds ?? []).filter((id) =>
      shiftIds.includes(shiftOf(registrations.find((row) => row.id === id)?.payload)),
    );

    if (registrationIds.length === 0 && sameScheduleCell(live, { shiftIds, isOff, positions }, first)) {
      await tx
        .delete(scheduleDrafts)
        .where(and(eq(scheduleDrafts.employeeId, employeeId), eq(scheduleDrafts.date, date)));
      continue;
    }
    await tx
      .insert(scheduleDrafts)
      .values({ companyId: ctx.company.id, employeeId, date, shiftIds, isOff, positions, registrationIds })
      .onConflictDoUpdate({
        target: [scheduleDrafts.employeeId, scheduleDrafts.date],
        set: {
          shiftIds: sql`excluded.shift_ids`,
          isOff: sql`excluded.is_off`,
          positions: sql`excluded.positions`,
          registrationIds: sql`excluded.registration_ids`,
          updatedAt: sql`now()`,
        },
      });
  }

  await writeAudit(tx, actorOf(ctx), {
    action: 'schedule.draft',
    entity: 'schedule',
    before: { cells: existing },
    after: { cells },
  });
}

/**
 * Nhận một đăng ký vào nháp: thêm ca vào ô nháp (chưa có nháp thì lấy từ lịch đã công bố) với vị trí
 * đã chọn. Đơn vẫn chờ, Công bố mới chuyển sang Đã nhận; người gọi đã khoá đơn và kiểm tra quyền.
 */
export async function acceptIntoDraft(
  tx: Tx,
  ctx: AuthContext,
  request: typeof requests.$inferSelect,
  positionId: string | null,
) {
  const { employeeId, fromDate: date } = request;
  const shiftId = shiftOf(request.payload);
  const [person] = await tx
    .select({ id: employees.id, positionId: employees.positionId })
    .from(employees)
    .where(eq(employees.id, employeeId));
  const first = person?.positionId ?? null;
  const [held, allowed] = await Promise.all([
    positionsOf(tx, person ? [person] : []),
    allowedShiftIds(tx, person ? [person] : []),
  ]);
  if (!allowed.get(employeeId)?.includes(shiftId)) {
    throw new ApiError(409, 'Ca này không còn trong ca được làm của nhân viên');
  }
  if (positionId && !held.get(employeeId)?.includes(positionId)) {
    throw new ApiError(400, 'Nhân viên không làm vị trí này', { positionId: 'Vị trí không hợp lệ' });
  }

  const at = [{ employeeId, date }];
  const [[draft], [live]] = await Promise.all([
    tx.select().from(scheduleDrafts).where(cellMatch(scheduleDrafts, at)),
    tx.select().from(scheduleCells).where(cellMatch(scheduleCells, at)),
  ]);
  const base = draft ?? live ?? EMPTY;
  const shiftIds = base.isOff
    ? [shiftId]
    : base.shiftIds.includes(shiftId)
      ? base.shiftIds
      : [...base.shiftIds, shiftId];
  const chosen = positionId ?? first;
  const positions = {
    ...normalizePositions(shiftIds, base.positions, first),
    ...(chosen ? { [shiftId]: chosen } : {}),
  };
  const registrationIds = [...new Set([...(draft?.registrationIds ?? []), request.id])];

  await tx
    .insert(scheduleDrafts)
    .values({
      companyId: ctx.company.id,
      employeeId,
      date,
      shiftIds,
      isOff: false,
      positions,
      registrationIds,
    })
    .onConflictDoUpdate({
      target: [scheduleDrafts.employeeId, scheduleDrafts.date],
      set: {
        shiftIds: sql`excluded.shift_ids`,
        isOff: sql`excluded.is_off`,
        positions: sql`excluded.positions`,
        registrationIds: sql`excluded.registration_ids`,
        updatedAt: sql`now()`,
      },
    });
  await writeAudit(tx, actorOf(ctx), {
    action: 'request.draft_accept',
    entity: 'request',
    entityId: request.id,
    after: { date, shiftId, positionId: chosen },
  });
}

/** Đơn bị từ chối thì không còn gắn với nháp nào; ca đã thêm vào nháp vẫn để quản lý tự quyết. */
export async function dropFromDrafts(tx: Tx, requestId: string) {
  await tx
    .update(scheduleDrafts)
    .set({ registrationIds: sql`array_remove(${scheduleDrafts.registrationIds}, ${requestId}::uuid)` })
    .where(sql`${requestId}::uuid = any(${scheduleDrafts.registrationIds})`);
}

/** Mã đơn đăng ký đang nằm trong nháp, để Hộp việc không mời nhận lại lần nữa. */
export async function draftedRegistrationIds(db: Pick<Tx, 'select'>, companyId: string) {
  const rows = await db
    .select({ ids: scheduleDrafts.registrationIds })
    .from(scheduleDrafts)
    .where(
      and(eq(scheduleDrafts.companyId, companyId), sql`cardinality(${scheduleDrafts.registrationIds}) > 0`),
    );
  return new Set(rows.flatMap(({ ids }) => ids));
}

/**
 * Lương đọc vị trí của ca từ ô lịch, không từ `day_records`: đổi vị trí của ngày đã qua không làm đổi
 * ngày công nên tính lại không tự đánh dấu. Kỳ đã công bố phủ ngày đó phải báo cần công bố lại.
 */
async function markChangedStale(tx: Tx, companyId: string, dates: readonly string[]) {
  for (const date of new Set(dates)) {
    await tx
      .update(payrollPeriods)
      .set({ stale: true })
      .where(
        and(
          eq(payrollPeriods.companyId, companyId),
          eq(payrollPeriods.published, true),
          lte(payrollPeriods.fromDate, date),
          gte(payrollPeriods.toDate, date),
        ),
      );
  }
}

/**
 * Lưu các ô thay đổi (US15, US16). Từ ngày mai trở đi vào nháp, chờ Công bố; hôm nay và quá khứ ghi
 * thẳng vào lịch rồi tính lại ngày công. Ô trống và không Cho nghỉ là xoá ô.
 */
export async function saveSchedule(ctx: AuthContext, { cells }: ScheduleSaveInput) {
  const firstDraft = firstDraftDate();
  await getDb().transaction(async (tx) => {
    await assertCellsAllowed(tx, ctx, cells);

    const later = cells.filter(({ date }) => date >= firstDraft);
    if (later.length > 0) await writeDrafts(tx, ctx, later);

    const now = cells.filter(({ date }) => date < firstDraft);
    if (now.length === 0) return;
    const { changed } = await writeCells(tx, ctx, now);
    await markChangedStale(
      tx,
      ctx.company.id,
      changed.map(({ date }) => date),
    );

    // Tính cả ngày kế tiếp: đổi ca đêm thì lần ra sáng hôm sau đổi chỗ thuộc về
    for (const employeeId of new Set(now.map(({ employeeId: id }) => id))) {
      const dates = now
        .filter((cell) => cell.employeeId === employeeId)
        .map(({ date }) => date)
        .sort();
      await recomputeDays(tx, {
        companyId: ctx.company.id,
        employeeIds: [employeeId],
        from: dates[0]!,
        to: addDays(dates[dates.length - 1]!, 1),
      });
    }
  });
}
