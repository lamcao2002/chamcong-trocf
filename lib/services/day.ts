import 'server-only';
import { and, asc, between, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { notFound } from '@/lib/api/errors';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb, type Db } from '@/lib/db/client';
import { approvals, attendanceLogs, dayRecords, employees, positions, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { addDays, atMinute } from '@/lib/engine/time';
import type { DayRecord, Suggestion } from '@/lib/engine/types';
import { computeDaysLive, firstLiveDay } from './recompute';

const DAY_MINUTES = 24 * 60;

export type DayView = Omit<DayRecord, 'otRate' | 'penalty'> & { employeeId: string };

/**
 * Nguồn đọc ngày công duy nhất của mọi màn: ngày đã chốt lấy `day_records`, ngày gần đây tính tại
 * chỗ. Hộp việc, Bảng công và app nhân viên cùng đi qua đây nên không thể ra số khác nhau.
 */
export async function readDayRecords(
  db: Db,
  companyId: string,
  employeeIds: string[],
  from: string,
  to: string,
  now: Date = new Date(),
): Promise<DayView[]> {
  if (employeeIds.length === 0) return [];
  const today = vietnamToday(now);
  const liveFrom = firstLiveDay(today);
  const lastStored = addDays(liveFrom, -1);
  const storedTo = to < lastStored ? to : lastStored;

  const [stored, live] = await Promise.all([
    from > storedTo
      ? []
      : db
          .select()
          .from(dayRecords)
          .where(
            and(
              eq(dayRecords.companyId, companyId),
              inArray(dayRecords.employeeId, employeeIds),
              between(dayRecords.date, from, storedTo),
            ),
          ),
    computeDaysLive(
      db,
      companyId,
      employeeIds,
      from > liveFrom ? from : liveFrom,
      to < today ? to : today,
      now,
    ),
  ]);

  return [
    ...stored.map((row) => ({
      ...row,
      suggestions: (row.suggestion ?? []) as Suggestion[],
      notes: row.notes as string[],
    })),
    ...live,
  ];
}

/** Người trong phạm vi quản lý còn làm tính từ ngày `from`. */
export function staffInScope(ctx: AuthContext, from: string) {
  return getDb()
    .select({ id: employees.id, name: employees.name, positionName: positions.name })
    .from(employees)
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(
      and(
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
        or(eq(employees.status, 'active'), gte(employees.leftDate, from)),
      ),
    )
    .orderBy(asc(employees.name));
}

/** Chi tiết một người một ngày: lần chấm gốc và ngày công hệ thống tính (US28 dùng lại ở Sprint 3). */
export async function getDayDetail(ctx: AuthContext, employeeId: string, date: string) {
  const db = getDb();
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

  const punches = await db
    .select({
      at: attendanceLogs.at,
      type: attendanceLogs.type,
      inZone: attendanceLogs.inZone,
      distanceM: attendanceLogs.distanceM,
      synthetic: attendanceLogs.synthetic,
    })
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.employeeId, employeeId),
        gte(attendanceLogs.at, atMinute(date, 0)),
        // Hết ngày hôm sau: lần ra của ca đêm vẫn thuộc ngày này
        lt(attendanceLogs.at, atMinute(date, 2 * DAY_MINUTES)),
      ),
    )
    .orderBy(asc(attendanceLogs.at));
  const records = await readDayRecords(db, ctx.company.id, [employeeId], date, date);
  const library = await db
    .select({ id: shifts.id, name: shifts.name })
    .from(shifts)
    .where(scopeToCompany(ctx, shifts.companyId));

  const approved = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.employeeId, employeeId), eq(approvals.date, date), isNull(approvals.revokedAt)));

  return { employee, date, punches, records, approvals: approved, shifts: library };
}

export type DayDetail = Awaited<ReturnType<typeof getDayDetail>>;
