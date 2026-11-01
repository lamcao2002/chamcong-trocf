import 'server-only';
import { and, between, eq } from 'drizzle-orm';
import { notFound } from '@/lib/api/errors';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { companies, employees, explanations, holidays, scheduleCells, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { nextPeriod, periodByKey, periodOf, previousPeriod } from '@/lib/domain/period';
import { daySymbol } from '@/lib/domain/symbols';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import { readDayRecords, staffInScope, type DayView } from './day';
import { loadEmployeeRules } from './recompute';

const WEEK_DAYS = 7;

async function periodFor(ctx: AuthContext, key: string | undefined, today: string) {
  const db = getDb();
  const [company] = await db
    .select({ cutoffDay: companies.cutoffDay })
    .from(companies)
    .where(eq(companies.id, ctx.company.id));
  const cutoffDay = company?.cutoffDay ?? null;
  const period = key ? periodByKey(key, cutoffDay) : periodOf(today, cutoffDay);
  const next = nextPeriod(period, cutoffDay);
  return {
    period,
    previousKey: previousPeriod(period, cutoffDay).key,
    nextKey: next.from <= today ? next.key : null,
  };
}

function datesOf(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Cột tổng cộng từ chính các dòng tạo ra ô, nên lưới và tổng không thể lệch nhau. */
function totalsOf(records: readonly DayView[]) {
  let cong = 0;
  let lateMin = 0;
  let missing = 0;
  let otApproved = 0;
  let otPending = 0;
  for (const record of records) {
    cong += record.cong;
    lateMin += record.waivedLate ? 0 : record.lateMin;
    missing += record.missing;
    otApproved += record.otApproved;
    if (record.otState === 'cho_duyet') otPending += record.otProposed - record.otApproved;
  }
  return { cong: Math.round(cong * 100) / 100, lateMin, missing, otApproved, otPending };
}

function byDate(records: readonly DayView[]) {
  const groups = new Map<string, DayView[]>();
  for (const record of records) {
    const group = groups.get(record.date);
    if (group) group.push(record);
    else groups.set(record.date, [record]);
  }
  return groups;
}

/** Lưới công một kỳ của người trong phạm vi quản lý (US27). */
export async function getTimesheet(ctx: AuthContext, periodKey?: string, now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const { period, previousKey, nextKey } = await periodFor(ctx, periodKey, today);
  const staff = await staffInScope(ctx, period.from);
  const lastDay = period.to < today ? period.to : today;
  const records = await readDayRecords(
    db,
    ctx.company.id,
    staff.map(({ id }) => id),
    period.from,
    lastDay,
    now,
  );

  const perEmployee = new Map<string, DayView[]>();
  for (const record of records) {
    const group = perEmployee.get(record.employeeId);
    if (group) group.push(record);
    else perEmployee.set(record.employeeId, [record]);
  }

  return {
    period,
    previousKey,
    nextKey,
    today,
    dates: datesOf(period.from, period.to),
    employees: staff.map(({ id, name, positionName }) => {
      const own = perEmployee.get(id) ?? [];
      const days = byDate(own);
      return {
        id,
        name,
        positionName,
        cells: [...days].map(([date, rows]) => {
          const { key, label, title } = daySymbol(rows);
          return { date, symbol: key, label, title, shiftCount: rows.length };
        }),
        totals: totalsOf(own),
      };
    }),
  };
}

export type TimesheetView = Awaited<ReturnType<typeof getTimesheet>>;

/** Bảng công cả kỳ của một người, từng dòng theo ngày × ca (US28). */
export async function getEmployeeTimesheet(
  ctx: AuthContext,
  employeeId: string,
  periodKey?: string,
  now: Date = new Date(),
) {
  const db = getDb();
  const today = vietnamToday(now);
  const [employee] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
      ),
    );
  if (!employee) throw notFound('nhân viên');

  const { period, previousKey, nextKey } = await periodFor(ctx, periodKey, today);
  return {
    employee,
    period,
    previousKey,
    nextKey,
    ...(await ownRows(ctx, employeeId, period.from, period.to < today ? period.to : today, now)),
  };
}

export type EmployeeTimesheetView = Awaited<ReturnType<typeof getEmployeeTimesheet>>;

async function ownRows(ctx: AuthContext, employeeId: string, from: string, to: string, now: Date) {
  const db = getDb();
  const [records, library] = await Promise.all([
    readDayRecords(db, ctx.company.id, [employeeId], from, to, now),
    db.select({ id: shifts.id, name: shifts.name }).from(shifts).where(scopeToCompany(ctx, shifts.companyId)),
  ]);
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({
      date: record.date,
      shiftId: record.shiftId,
      shiftName: library.find(({ id }) => id === record.shiftId)?.name ?? null,
      status: record.status,
      inAt: record.inAt,
      outAt: record.outAt,
      workedMin: record.workedMin,
      cong: record.cong,
      lateMin: record.lateMin,
      earlyMin: record.earlyMin,
      otProposed: record.otProposed,
      otApproved: record.otApproved,
      needsReview: record.needsReview,
      notes: record.notes,
    }));
  return { rows, totals: totalsOf(records) };
}

/** Bảng công một kỳ của chính nhân viên: lịch tháng có chấm màu và chi tiết từng ngày (M3). */
export async function getMyTimesheet(ctx: AuthContext, periodKey?: string, now: Date = new Date()) {
  const today = vietnamToday(now);
  const employeeId = ctx.employee.id;
  const { period, previousKey, nextKey } = await periodFor(ctx, periodKey, today);
  const { rows, totals } = await ownRows(
    ctx,
    employeeId,
    period.from,
    period.to < today ? period.to : today,
    now,
  );
  const sent = await getDb()
    .select({
      date: explanations.date,
      shiftId: explanations.shiftId,
      reason: explanations.reason,
      status: explanations.status,
    })
    .from(explanations)
    .where(and(eq(explanations.employeeId, employeeId), between(explanations.date, period.from, period.to)));

  const dates = datesOf(period.from, period.to);
  return {
    period,
    previousKey,
    nextKey,
    today,
    totals,
    days: dates.map((date) => {
      const records = rows
        .filter((row) => row.date === date)
        .map((row) => ({
          ...row,
          explanation: sent.find((item) => item.date === date && item.shiftId === row.shiftId) ?? null,
        }));
      return { date, symbol: daySymbol(records).key, records };
    }),
  };
}

export type MyTimesheetView = Awaited<ReturnType<typeof getMyTimesheet>>;

/** Lịch một tuần của chính nhân viên (M3). */
export async function getMySchedule(ctx: AuthContext, week: string) {
  const db = getDb();
  const employeeId = ctx.employee.id;
  const dates = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(week, index));
  const to = dates[WEEK_DAYS - 1]!;
  const [rules, library, cells, holidayRows] = await Promise.all([
    loadEmployeeRules(db, [employeeId]),
    db.select().from(shifts).where(scopeToCompany(ctx, shifts.companyId)),
    db
      .select()
      .from(scheduleCells)
      .where(and(eq(scheduleCells.employeeId, employeeId), between(scheduleCells.date, week, to))),
    db
      .select({ date: holidays.date, name: holidays.name })
      .from(holidays)
      .where(and(scopeToCompany(ctx, holidays.companyId), between(holidays.date, week, to))),
  ]);
  const employee = rules.get(employeeId)!;

  return {
    week,
    days: dates.map((date) => {
      const cell = cells.find((row) => row.date === date);
      const schedule = cell ? { shiftIds: cell.shiftIds, isOff: cell.isOff } : null;
      const expected = expectedShifts({ date, employee, schedule, shifts: library as EngineShift[] });
      return {
        date,
        isOff: expected.reason === 'off',
        holiday: holidayRows.find((row) => row.date === date)?.name ?? null,
        shifts: expected.shifts.map(({ id, name, startTime, endTime }) => ({
          id,
          name,
          startTime: startTime.slice(0, 5),
          endTime: endTime.slice(0, 5),
        })),
      };
    }),
  };
}

export type MyScheduleView = Awaited<ReturnType<typeof getMySchedule>>;
