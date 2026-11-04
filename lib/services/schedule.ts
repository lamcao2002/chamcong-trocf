import 'server-only';
import { and, asc, between, count, eq, gte, inArray, ne, or, sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  employeeShifts,
  employees,
  holidays,
  positionShifts,
  positions,
  requests,
  scheduleCells,
  scheduleDrafts,
  shifts,
  type ShiftPositions,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { normalizePositions, sameScheduleCell } from '@/lib/domain/shift-positions';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { formatDate } from '@/lib/format';
import { actorOf } from './actor';
import { canDecideOwn } from './approvals';
import { notify } from './notifications';
import { loadEmployeeRules } from './recompute';
import { assertOwned } from './references';
import { positionsOf } from './staff-positions';

const WEEK_DAYS = 7;

type Reader = Pick<Tx, 'select'>;

/**
 * Ca được xếp cho từng người: ghi đè Ca riêng thắng ca của vị trí, luôn gồm ca cố định. Người làm
 * nhiều vị trí được mọi ca mà ít nhất một vị trí của họ cho phép.
 */
export async function allowedShiftIds(db: Reader, employeeRows: { id: string; positionId: string | null }[]) {
  const ids = employeeRows.map(({ id }) => id);
  const held = await positionsOf(db, employeeRows);
  const positionIds = [...new Set([...held.values()].flat())];
  const [overrides, ofPositions, fixed] = await Promise.all([
    db.select().from(employeeShifts).where(inArray(employeeShifts.employeeId, ids)),
    db.select().from(positionShifts).where(inArray(positionShifts.positionId, positionIds)),
    db
      .select({ id: positions.id, shiftId: positions.fixedShiftId })
      .from(positions)
      .where(inArray(positions.id, positionIds)),
  ]);

  return new Map(
    employeeRows.map(({ id }) => {
      const mine = held.get(id) ?? [];
      const own = overrides.filter(({ employeeId }) => employeeId === id).map(({ shiftId }) => shiftId);
      const inherited = ofPositions.filter((row) => mine.includes(row.positionId)).map((row) => row.shiftId);
      const fixedShifts = fixed.flatMap((row) => (mine.includes(row.id) && row.shiftId ? [row.shiftId] : []));
      const allowed = own.length > 0 ? own : inherited;
      return [id, [...new Set([...allowed, ...fixedShifts])]];
    }),
  );
}

/** Đăng ký chờ nhận của một tuần và số của tuần sau đó, cho banner màn Xếp ca (SCH-11). */
async function pendingRegistrations(ctx: AuthContext, week: string, ownAllowed: boolean) {
  const db = getDb();
  const nextWeek = addDays(week, WEEK_DAYS);
  const notSelf = ownAllowed ? undefined : ne(requests.employeeId, ctx.employee.id);
  const pending = and(
    scopeToStaff(ctx, { companyId: requests.companyId, employeeId: requests.employeeId }),
    eq(requests.type, 'shift_register'),
    eq(requests.status, 'pending'),
    notSelf,
  );
  const [rows, [next]] = await Promise.all([
    db
      .select({
        id: requests.id,
        employeeId: requests.employeeId,
        employeeName: employees.name,
        date: requests.fromDate,
        payload: requests.payload,
      })
      .from(requests)
      .innerJoin(employees, eq(employees.id, requests.employeeId))
      .where(and(pending, between(requests.fromDate, week, addDays(week, WEEK_DAYS - 1))))
      .orderBy(asc(requests.fromDate), asc(employees.name)),
    db
      .select({ total: count() })
      .from(requests)
      .where(and(pending, between(requests.fromDate, nextWeek, addDays(nextWeek, WEEK_DAYS - 1)))),
  ]);
  return {
    registrations: rows.map(({ payload, ...row }) => ({
      ...row,
      shiftId: (payload as { shiftId: string }).shiftId,
    })),
    nextWeekRegistrations: next?.total ?? 0,
  };
}

/** Ngày từ đây trở đi lưu vào nháp; hôm nay và quá khứ có hiệu lực ngay để sửa Bảng công. */
export const firstDraftDate = () => addDays(vietnamToday(), 1);

/** Lưới một tuần: người được quản lý, ô đã công bố, ô nháp và ô ca cố định không cần xếp (US14). */
export type ScheduleView = Awaited<ReturnType<typeof getSchedule>>;

export async function getSchedule(ctx: AuthContext, week: string) {
  const db = getDb();
  const dates = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(week, index));
  const to = dates[WEEK_DAYS - 1]!;

  const [staff, library, holidayRows, positionRows] = await Promise.all([
    db
      .select({
        id: employees.id,
        name: employees.name,
        positionId: employees.positionId,
        positionName: positions.name,
      })
      .from(employees)
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .where(
        and(
          scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
          or(eq(employees.status, 'active'), gte(employees.leftDate, week)),
        ),
      )
      .orderBy(asc(employees.name)),
    db
      .select()
      .from(shifts)
      .where(scopeToCompany(ctx, shifts.companyId))
      .orderBy(asc(shifts.startTime), asc(shifts.code)),
    db
      .select({ date: holidays.date, name: holidays.name })
      .from(holidays)
      .where(and(scopeToCompany(ctx, holidays.companyId), between(holidays.date, week, to))),
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(scopeToCompany(ctx, positions.companyId))
      .orderBy(asc(positions.name)),
  ]);

  const ids = staff.map(({ id }) => id);
  const inWeek = <T extends typeof scheduleCells | typeof scheduleDrafts>(table: T) =>
    and(inArray(table.employeeId, ids), between(table.date, week, to));
  const [cells, drafts, rules, allowed, held, ownAllowed] = await Promise.all([
    db.select().from(scheduleCells).where(inWeek(scheduleCells)),
    db.select().from(scheduleDrafts).where(inWeek(scheduleDrafts)),
    loadEmployeeRules(db, ids),
    allowedShiftIds(db, staff),
    positionsOf(db, staff),
    canDecideOwn(db, ctx),
  ]);
  const drafted = new Set(drafts.flatMap(({ registrationIds }) => registrationIds));
  const pending = await pendingRegistrations(ctx, week, ownAllowed);
  const firstDraft = firstDraftDate();

  return {
    ...pending,
    registrations: pending.registrations.map((row) => ({ ...row, inDraft: drafted.has(row.id) })),
    week,
    dates,
    firstDraftDate: firstDraft,
    draftCount: drafts.length,
    holidays: holidayRows,
    positions: positionRows,
    shifts: library.map(({ id, code, name, startTime, endTime, overnight }) => ({
      id,
      code,
      name,
      startTime: startTime.slice(0, 5),
      endTime: endTime.slice(0, 5),
      overnight,
    })),
    employees: staff.map(({ id, name, positionId, positionName }) => {
      const employee = rules.get(id)!;
      return {
        id,
        name,
        positionId,
        positionName,
        /** Vị trí chính đứng đầu. */
        positionIds: held.get(id) ?? [],
        shiftMode: employee.shiftMode,
        allowedShiftIds: allowed.get(id) ?? [],
        cells: dates.map((date) => {
          const cell = cells.find((row) => row.employeeId === id && row.date === date);
          const draft = drafts.find((row) => row.employeeId === id && row.date === date);
          /** Ca cố định khi không có ô lịch: hiện viền đứt, không cần xếp. */
          const defaults = expectedShifts({
            date,
            employee,
            schedule: null,
            shifts: library as EngineShift[],
          });
          return {
            date,
            shiftIds: cell?.shiftIds ?? [],
            isOff: cell?.isOff ?? false,
            positions: cell?.positions ?? {},
            draft: draft
              ? { shiftIds: draft.shiftIds, isOff: draft.isOff, positions: draft.positions }
              : null,
            defaultShiftIds: defaults.shifts.map((shift) => shift.id),
            editable: date >= employee.onboardDate && (!employee.leftDate || date <= employee.leftDate),
          };
        }),
      };
    }),
  };
}

export type CellWrite = {
  employeeId: string;
  date: string;
  shiftIds: string[];
  isOff: boolean;
  /** Bỏ trống thì giữ vị trí cũ của các ca còn lại, ca mới là vị trí chính. */
  positions?: ShiftPositions;
};

export const cellMatch = <T extends typeof scheduleCells | typeof scheduleDrafts>(
  table: T,
  cells: readonly { employeeId: string; date: string }[],
) =>
  and(
    inArray(table.employeeId, [...new Set(cells.map(({ employeeId }) => employeeId))]),
    or(...cells.map(({ employeeId, date }) => and(eq(table.employeeId, employeeId), eq(table.date, date)))),
  );

export async function primaryPositions(db: Reader, ids: readonly string[]) {
  const rows = await db
    .select({ id: employees.id, positionId: employees.positionId })
    .from(employees)
    .where(inArray(employees.id, [...ids]));
  return new Map(rows.map(({ id, positionId }) => [id, positionId]));
}

/**
 * Ghi ô lịch đã công bố kèm nhật ký; ô trống và không Cho nghỉ là xoá ô. Nháp của ô đó bị bỏ: lịch
 * thật vừa đổi thì nháp cũ không còn đúng. Mặc định báo cho nhân viên các ngày từ hôm nay trở đi
 * thực sự đổi; luồng đơn và Công bố tự báo kết quả của mình nên truyền `silent`.
 */
export async function writeCells(
  tx: Tx,
  ctx: AuthContext,
  cells: readonly CellWrite[],
  { silent = false }: { silent?: boolean } = {},
) {
  const before = await tx.select().from(scheduleCells).where(cellMatch(scheduleCells, cells));
  const primary = await primaryPositions(
    tx,
    cells.map(({ employeeId }) => employeeId),
  );
  const oldOf = ({ employeeId, date }: { employeeId: string; date: string }) =>
    before.find((row) => row.employeeId === employeeId && row.date === date);

  const written = cells.map((cell) => ({
    ...cell,
    positions: normalizePositions(
      cell.shiftIds,
      cell.positions ?? oldOf(cell)?.positions,
      primary.get(cell.employeeId) ?? null,
    ),
  }));
  for (const { employeeId, date, shiftIds, isOff, positions: map } of written) {
    if (shiftIds.length === 0 && !isOff) {
      await tx
        .delete(scheduleCells)
        .where(and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date)));
      continue;
    }
    await tx
      .insert(scheduleCells)
      .values({ companyId: ctx.company.id, employeeId, date, shiftIds, isOff, positions: map })
      .onConflictDoUpdate({
        target: [scheduleCells.employeeId, scheduleCells.date],
        set: {
          shiftIds: sql`excluded.shift_ids`,
          isOff: sql`excluded.is_off`,
          positions: sql`excluded.positions`,
        },
      });
  }
  await tx.delete(scheduleDrafts).where(cellMatch(scheduleDrafts, cells));

  await writeAudit(tx, actorOf(ctx), {
    action: 'schedule.update',
    entity: 'schedule',
    before: { cells: before },
    after: { cells: written },
  });

  const changed = written.filter((cell) => {
    const old = oldOf(cell);
    const previous = old ?? { shiftIds: [], isOff: false, positions: {} };
    return !sameScheduleCell(previous, cell, primary.get(cell.employeeId) ?? null);
  });
  if (!silent) await notifyScheduleChange(tx, ctx, changed, 'Lịch làm việc thay đổi');
  return { before, changed };
}

/** Mỗi người một thông báo gộp các ngày từ hôm nay trở đi; không báo cho chính người sửa. */
export async function notifyScheduleChange(
  tx: Tx,
  ctx: AuthContext,
  changed: readonly { employeeId: string; date: string }[],
  title: string,
  extra: Map<string, string> = new Map(),
) {
  const today = vietnamToday();
  const upcoming = changed.filter(({ date, employeeId }) => date >= today && employeeId !== ctx.employee.id);
  const people = new Set([...upcoming.map(({ employeeId }) => employeeId), ...extra.keys()]);
  people.delete(ctx.employee.id);
  await notify(
    tx,
    [...people].map((employeeId) => ({
      companyId: ctx.company.id,
      employeeId,
      kind: 'schedule' as const,
      title,
      body: [
        upcoming
          .filter((cell) => cell.employeeId === employeeId)
          .map(({ date }) => date)
          .sort()
          .map((date) => formatDate(date).slice(0, 5))
          .join(', '),
        extra.get(employeeId) ?? '',
      ]
        .filter(Boolean)
        .join(' · '),
      href: '#/lich',
    })),
  );
}

/** Ca thực tế của một ngày, tính cả ca cố định khi chưa có ô lịch. */
export async function expectedShiftIds(db: Reader, ctx: AuthContext, employeeId: string, date: string) {
  const [rules, library, [cell]] = await Promise.all([
    loadEmployeeRules(db, [employeeId]),
    db.select().from(shifts).where(scopeToCompany(ctx, shifts.companyId)),
    db
      .select({ shiftIds: scheduleCells.shiftIds, isOff: scheduleCells.isOff })
      .from(scheduleCells)
      .where(and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date))),
  ]);
  const employee = rules.get(employeeId)!;
  const expected = expectedShifts({
    date,
    employee,
    schedule: cell ?? null,
    shifts: library as EngineShift[],
  });
  return expected.shifts.map(({ id }) => id);
}

/** Kiểm tra từng ô trước khi ghi: người trong phạm vi, ngày trong thời gian làm, ca và vị trí họ làm được. */
export async function assertCellsAllowed(tx: Tx, ctx: AuthContext, cells: readonly CellWrite[]) {
  const ids = [...new Set(cells.map(({ employeeId }) => employeeId))];
  const staff = await tx
    .select({
      id: employees.id,
      positionId: employees.positionId,
      onboardDate: employees.onboardDate,
      leftDate: employees.leftDate,
    })
    .from(employees)
    .where(
      and(
        inArray(employees.id, ids),
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
      ),
    );
  if (staff.length !== ids.length) {
    throw new ApiError(400, 'Có nhân viên ngoài phạm vi quản lý', { cells: 'Nhân viên không hợp lệ' });
  }
  await assertOwned(
    tx,
    ctx,
    shifts,
    cells.flatMap(({ shiftIds }) => shiftIds),
    'cells',
  );

  const [allowed, held] = await Promise.all([allowedShiftIds(tx, staff), positionsOf(tx, staff)]);
  for (const { employeeId, date, shiftIds, positions: map } of cells) {
    const employee = staff.find(({ id }) => id === employeeId)!;
    if (date < employee.onboardDate || (employee.leftDate && date > employee.leftDate)) {
      throw new ApiError(400, 'Ngày này nhân viên chưa vào làm hoặc đã nghỉ', {
        cells: 'Ngày không hợp lệ',
      });
    }
    if (shiftIds.some((shiftId) => !allowed.get(employeeId)?.includes(shiftId))) {
      throw new ApiError(400, 'Ca không nằm trong ca được làm của nhân viên', { cells: 'Ca không hợp lệ' });
    }
    if (Object.values(map ?? {}).some((positionId) => !held.get(employeeId)?.includes(positionId))) {
      throw new ApiError(400, 'Nhân viên không làm vị trí này', { cells: 'Vị trí không hợp lệ' });
    }
  }
  return staff;
}
