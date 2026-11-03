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
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { formatDate } from '@/lib/format';
import type { ScheduleSaveInput } from '@/lib/validation/schedule';
import { actorOf } from './actor';
import { canDecideOwn } from './approvals';
import { notify } from './notifications';
import { loadEmployeeRules, recomputeDays } from './recompute';
import { assertOwned } from './references';

const WEEK_DAYS = 7;

type Reader = Pick<Tx, 'select'>;

/** Ca được xếp cho từng người: ghi đè Ca riêng thắng ca của vị trí, luôn gồm ca cố định. */
export async function allowedShiftIds(db: Reader, employeeRows: { id: string; positionId: string | null }[]) {
  const ids = employeeRows.map(({ id }) => id);
  const positionIds = employeeRows.flatMap(({ positionId }) => positionId ?? []);
  const [overrides, ofPositions, fixed] = await Promise.all([
    db.select().from(employeeShifts).where(inArray(employeeShifts.employeeId, ids)),
    db.select().from(positionShifts).where(inArray(positionShifts.positionId, positionIds)),
    db
      .select({ id: positions.id, shiftId: positions.fixedShiftId })
      .from(positions)
      .where(inArray(positions.id, positionIds)),
  ]);

  return new Map(
    employeeRows.map(({ id, positionId }) => {
      const own = overrides.filter(({ employeeId }) => employeeId === id).map(({ shiftId }) => shiftId);
      const inherited = ofPositions.filter((row) => row.positionId === positionId).map((row) => row.shiftId);
      const fixedShift = fixed.find((row) => row.id === positionId)?.shiftId;
      const allowed = own.length > 0 ? own : inherited;
      return [id, [...new Set([...allowed, ...(fixedShift ? [fixedShift] : [])])]];
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

/** Lưới một tuần: người được quản lý, ô đã xếp, và ô ca cố định không cần xếp (US14). */
export type ScheduleView = Awaited<ReturnType<typeof getSchedule>>;

export async function getSchedule(ctx: AuthContext, week: string) {
  const db = getDb();
  const dates = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(week, index));
  const to = dates[WEEK_DAYS - 1]!;

  const [staff, library, holidayRows] = await Promise.all([
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
  ]);

  const ids = staff.map(({ id }) => id);
  const [cells, rules, allowed, ownAllowed] = await Promise.all([
    db
      .select()
      .from(scheduleCells)
      .where(and(inArray(scheduleCells.employeeId, ids), between(scheduleCells.date, week, to))),
    loadEmployeeRules(db, ids),
    allowedShiftIds(db, staff),
    canDecideOwn(db, ctx),
  ]);

  return {
    ...(await pendingRegistrations(ctx, week, ownAllowed)),
    week,
    dates,
    holidays: holidayRows,
    shifts: library.map(({ id, code, name, startTime, endTime, overnight }) => ({
      id,
      code,
      name,
      startTime: startTime.slice(0, 5),
      endTime: endTime.slice(0, 5),
      overnight,
    })),
    employees: staff.map(({ id, name, positionName }) => {
      const employee = rules.get(id)!;
      return {
        id,
        name,
        positionName,
        shiftMode: employee.shiftMode,
        allowedShiftIds: allowed.get(id) ?? [],
        cells: dates.map((date) => {
          const cell = cells.find((row) => row.employeeId === id && row.date === date);
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
            defaultShiftIds: defaults.shifts.map((shift) => shift.id),
            editable: date >= employee.onboardDate && (!employee.leftDate || date <= employee.leftDate),
          };
        }),
      };
    }),
  };
}

type CellWrite = { employeeId: string; date: string; shiftIds: string[]; isOff: boolean };

const sameShifts = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

/**
 * Ghi ô lịch kèm nhật ký; ô trống và không Cho nghỉ là xoá ô. Mặc định báo cho nhân viên các ngày từ
 * hôm nay trở đi thực sự đổi; luồng đơn tự báo kết quả của mình nên truyền `silent`.
 */
export async function writeCells(
  tx: Tx,
  ctx: AuthContext,
  cells: readonly CellWrite[],
  { silent = false }: { silent?: boolean } = {},
) {
  const ids = [...new Set(cells.map(({ employeeId }) => employeeId))];
  const before = await tx
    .select()
    .from(scheduleCells)
    .where(
      and(
        inArray(scheduleCells.employeeId, ids),
        or(
          ...cells.map(({ employeeId, date }) =>
            and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date)),
          ),
        ),
      ),
    );

  for (const { employeeId, date, shiftIds, isOff } of cells) {
    if (shiftIds.length === 0 && !isOff) {
      await tx
        .delete(scheduleCells)
        .where(and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date)));
      continue;
    }
    await tx
      .insert(scheduleCells)
      .values({ companyId: ctx.company.id, employeeId, date, shiftIds, isOff })
      .onConflictDoUpdate({
        target: [scheduleCells.employeeId, scheduleCells.date],
        set: { shiftIds: sql`excluded.shift_ids`, isOff: sql`excluded.is_off` },
      });
  }

  await writeAudit(tx, actorOf(ctx), {
    action: 'schedule.update',
    entity: 'schedule',
    before: { cells: before },
    after: { cells },
  });
  if (silent) return;

  const today = vietnamToday();
  const changed = cells.filter(({ employeeId, date, shiftIds, isOff }) => {
    const old = before.find((row) => row.employeeId === employeeId && row.date === date);
    const same = (old?.isOff ?? false) === isOff && sameShifts(old?.shiftIds ?? [], shiftIds);
    return date >= today && !same && employeeId !== ctx.employee.id;
  });
  await notify(
    tx,
    [...new Set(changed.map(({ employeeId }) => employeeId))].map((employeeId) => ({
      companyId: ctx.company.id,
      employeeId,
      kind: 'schedule' as const,
      title: 'Lịch làm việc thay đổi',
      body: changed
        .filter((cell) => cell.employeeId === employeeId)
        .map(({ date }) => date)
        .sort()
        .map((date) => formatDate(date).slice(0, 5))
        .join(', '),
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

/** Lưu các ô thay đổi rồi tính lại ngày công; ô trống và không Cho nghỉ là xoá ô (US15, US16). */
export async function saveSchedule(ctx: AuthContext, { cells }: ScheduleSaveInput) {
  await getDb().transaction(async (tx) => {
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

    const allowed = await allowedShiftIds(tx, staff);
    for (const { employeeId, date, shiftIds } of cells) {
      const employee = staff.find(({ id }) => id === employeeId)!;
      if (date < employee.onboardDate || (employee.leftDate && date > employee.leftDate)) {
        throw new ApiError(400, 'Ngày này nhân viên chưa vào làm hoặc đã nghỉ', {
          cells: 'Ngày không hợp lệ',
        });
      }
      if (shiftIds.some((shiftId) => !allowed.get(employeeId)?.includes(shiftId))) {
        throw new ApiError(400, 'Ca không nằm trong ca được làm của nhân viên', { cells: 'Ca không hợp lệ' });
      }
    }

    await writeCells(tx, ctx, cells);

    // Tính cả ngày kế tiếp: đổi ca đêm thì lần ra sáng hôm sau đổi chỗ thuộc về
    for (const employeeId of ids) {
      const dates = cells
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
