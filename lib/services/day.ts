import 'server-only';
import { and, asc, eq, gte, lt, or } from 'drizzle-orm';
import { notFound } from '@/lib/api/errors';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { attendanceLogs, dayRecords, employees, positions, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { atMinute } from '@/lib/engine/time';
import type { DayRecord } from '@/lib/engine/types';
import { computeDayLive, isSettledDay } from './recompute';

const DAY_MINUTES = 24 * 60;

const RECORD_FIELDS = [
  'shiftId',
  'status',
  'inAt',
  'outAt',
  'workedMin',
  'cong',
  'lateMin',
  'earlyMin',
  'otProposed',
  'otApproved',
  'flags',
  'needsReview',
  'notes',
] as const;

type RecordView = Pick<DayRecord, (typeof RECORD_FIELDS)[number]>;

function recordView(record: RecordView): RecordView {
  return Object.fromEntries(RECORD_FIELDS.map((field) => [field, record[field]])) as RecordView;
}

/** Ngày đã chốt đọc `day_records`; ngày gần đây tính tại chỗ vì trạng thái đổi theo đồng hồ. */
async function recordsOfDay(ctx: AuthContext, employeeIds: string[], date: string) {
  const db = getDb();
  const records = new Map<string, RecordView[]>();
  if (!isSettledDay(date, vietnamToday())) {
    const live = await computeDayLive(db, ctx.company.id, employeeIds, date);
    for (const [id, rows] of live) records.set(id, rows.map(recordView));
    return records;
  }

  const rows = await db
    .select()
    .from(dayRecords)
    .where(and(eq(dayRecords.date, date), scopeToCompany(ctx, dayRecords.companyId)));
  for (const id of employeeIds) {
    const own = rows.filter(({ employeeId }) => employeeId === id);
    records.set(
      id,
      own.map((row) => recordView({ ...row, notes: row.notes as string[] })),
    );
  }
  return records;
}

/** Bảng ngày công một ngày của người trong phạm vi quản lý; màn tạm trước Bảng công Sprint 3. */
export async function listDay(ctx: AuthContext, date: string) {
  const db = getDb();
  const staff = await db
    .select({ id: employees.id, name: employees.name, positionName: positions.name })
    .from(employees)
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(
      and(
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
        or(eq(employees.status, 'active'), gte(employees.leftDate, date)),
      ),
    )
    .orderBy(asc(employees.name));
  const library = await db
    .select({ id: shifts.id, name: shifts.name })
    .from(shifts)
    .where(scopeToCompany(ctx, shifts.companyId));
  const records = await recordsOfDay(
    ctx,
    staff.map(({ id }) => id),
    date,
  );

  return staff.flatMap(({ id, name, positionName }) =>
    (records.get(id) ?? []).map((record) => ({
      ...record,
      employeeId: id,
      employeeName: name,
      positionName,
      shiftName: library.find((shift) => shift.id === record.shiftId)?.name ?? null,
    })),
  );
}

export type DayRow = Awaited<ReturnType<typeof listDay>>[number];

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
  const records = await recordsOfDay(ctx, [employeeId], date);

  return { employee, date, punches, records: records.get(employeeId) ?? [] };
}
