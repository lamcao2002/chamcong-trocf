import 'server-only';
import { and, between, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit, type Tx } from '@/lib/audit';
import { getDb } from '@/lib/db/client';
import {
  approvals,
  attendanceLogs,
  companies,
  dayRecords,
  employeeShifts,
  employees,
  explanations,
  holidays,
  payrollPeriods,
  positions,
  requests,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { computeDay } from '@/lib/engine/compute-day';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays, atMinute } from '@/lib/engine/time';
import type {
  DayInput,
  DayRecord,
  EngineEmployee,
  EngineRequest,
  EngineShift,
  OtRates,
} from '@/lib/engine/types';

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_OT_RATES: OtRates = { weekday: 150, saturday: null, offday: 200, holiday: 300 };
/** Giới hạn tính lại khi chưa công bố kỳ lương nào: hơn hai kỳ tháng. */
const MAX_OPEN_DAYS = 62;
const INSERT_BATCH = 1000;
/** Ca đêm cộng cửa sổ ra ca 6 giờ có thể kéo sang ngày thứ hai sau ngày bắt đầu. */
const CRON_DAYS_BACK = 2;
const DAY_MINUTES = 24 * 60;

type Reader = Pick<Tx, 'select'>;
type EmployeeRules = EngineEmployee & { otRates: OtRates };

const leavePayload = z.object({ leaveType: z.enum(['annual', 'sick', 'unpaid']) });
const overtimePayload = z.object({ from: z.string(), to: z.string() });

/** Đơn đã duyệt theo góc nhìn của engine; `forgot` đã thành lần chấm tổng hợp nên bỏ qua. */
function engineRequest(type: string, payload: unknown): EngineRequest | null {
  if (type === 'leave') {
    const parsed = leavePayload.safeParse(payload);
    return parsed.success ? { type, ...parsed.data } : null;
  }
  if (type === 'overtime') {
    const parsed = overtimePayload.safeParse(payload);
    return parsed.success ? { type, ...parsed.data } : null;
  }
  return null;
}

/** Vị trí, ghi đè ca và hệ số OT của từng nhân viên; dùng chung cho tính công và màn Xếp ca. */
export async function loadEmployeeRules(db: Reader, employeeIds: readonly string[]) {
  const [rows, overrides] = await Promise.all([
    db
      .select({ employee: employees, position: positions })
      .from(employees)
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .where(inArray(employees.id, [...employeeIds])),
    db
      .select({ employeeId: employeeShifts.employeeId, shiftId: employeeShifts.shiftId })
      .from(employeeShifts)
      .where(inArray(employeeShifts.employeeId, [...employeeIds])),
  ]);

  return new Map(
    rows.map(({ employee, position }): [string, EmployeeRules] => {
      const pay = employee.payOverride;
      const ownShift = overrides.find(({ employeeId }) => employeeId === employee.id)?.shiftId;
      return [
        employee.id,
        {
          onboardDate: employee.onboardDate,
          leftDate: employee.leftDate,
          shiftMode: position?.shiftMode ?? 'flexible',
          fixedShiftId: ownShift ?? position?.fixedShiftId ?? null,
          workDays: position?.workDays ?? ALL_WEEK,
          otRates: {
            weekday: pay?.otWeekday ?? position?.otWeekday ?? DEFAULT_OT_RATES.weekday,
            saturday: pay?.otSaturday ?? position?.otSaturday ?? DEFAULT_OT_RATES.saturday,
            offday: pay?.otOffday ?? position?.otOffday ?? DEFAULT_OT_RATES.offday,
            holiday: pay?.otHoliday ?? position?.otHoliday ?? DEFAULT_OT_RATES.holiday,
          },
        },
      ];
    }),
  );
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

const byEmployee = <T extends { employeeId: string }>(rows: readonly T[]) =>
  groupBy(rows, ({ employeeId }) => employeeId);

/** Đọc gộp một lần cho cả khoảng ngày, không truy vấn theo từng ngày. */
async function loadInputs(tx: Reader, companyId: string, employeeIds: string[], from: string, to: string) {
  const [
    companyRows,
    rules,
    shiftRows,
    cells,
    holidayRows,
    punches,
    requestRows,
    explanationRows,
    approvalRows,
  ] = await Promise.all([
    tx.select().from(companies).where(eq(companies.id, companyId)),
    loadEmployeeRules(tx, employeeIds),
    tx.select().from(shifts).where(eq(shifts.companyId, companyId)),
    tx
      .select()
      .from(scheduleCells)
      .where(
        and(
          inArray(scheduleCells.employeeId, employeeIds),
          between(scheduleCells.date, addDays(from, -1), to),
        ),
      ),
    tx
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(eq(holidays.companyId, companyId), between(holidays.date, from, to))),
    tx
      .select()
      .from(attendanceLogs)
      .where(
        and(
          inArray(attendanceLogs.employeeId, employeeIds),
          between(attendanceLogs.at, atMinute(from, -2 * DAY_MINUTES), atMinute(to, 3 * DAY_MINUTES)),
        ),
      ),
    tx
      .select()
      .from(requests)
      .where(
        and(
          inArray(requests.employeeId, employeeIds),
          eq(requests.status, 'approved'),
          lte(requests.fromDate, to),
          gte(requests.toDate, from),
        ),
      ),
    tx
      .select()
      .from(explanations)
      .where(
        and(
          inArray(explanations.employeeId, employeeIds),
          between(explanations.date, from, to),
          ne(explanations.status, 'rejected'),
        ),
      ),
    tx
      .select()
      .from(approvals)
      .where(
        and(
          inArray(approvals.employeeId, employeeIds),
          between(approvals.date, from, to),
          isNull(approvals.revokedAt),
        ),
      ),
  ]);

  return {
    company: companyRows[0]!,
    rules,
    shifts: shiftRows as EngineShift[],
    cells: new Map(cells.map((cell) => [`${cell.employeeId}|${cell.date}`, cell])),
    holidayDates: new Set(holidayRows.map(({ date }) => date)),
    punches: byEmployee(punches),
    requests: byEmployee(requestRows),
    explanations: byEmployee(explanationRows),
    approvals: byEmployee(approvalRows),
  };
}

type Loaded = Awaited<ReturnType<typeof loadInputs>>;

function dayInput(loaded: Loaded, employeeId: string, date: string): DayInput | null {
  const rules = loaded.rules.get(employeeId);
  if (!rules) return null;
  const { otRates, ...employee } = rules;
  const { company, shifts: library } = loaded;
  const cellOf = (day: string) => {
    const cell = loaded.cells.get(`${employeeId}|${day}`);
    return cell ? { shiftIds: cell.shiftIds, isOff: cell.isOff } : null;
  };
  const dayStart = atMinute(date, -DAY_MINUTES).getTime();
  const dayEnd = atMinute(date, 2 * DAY_MINUTES).getTime();
  const mine = <T>(rows: Map<string, T[]>) => rows.get(employeeId) ?? [];

  return {
    date,
    employee,
    company,
    shifts: library,
    schedule: cellOf(date),
    previousDayShifts: expectedShifts({
      date: addDays(date, -1),
      employee,
      schedule: cellOf(addDays(date, -1)),
      shifts: library,
    }).shifts,
    isHoliday: loaded.holidayDates.has(date),
    punches: mine(loaded.punches).filter(({ at }) => at.getTime() >= dayStart && at.getTime() < dayEnd),
    otRates,
    penaltyPerMin: 0,
    requests: mine(loaded.requests)
      .filter(({ fromDate, toDate }) => fromDate <= date && toDate >= date)
      .map(({ type, payload }) => engineRequest(type, payload))
      .filter((request) => request !== null),
    explanations: mine(loaded.explanations).filter((row) => row.date === date),
    approvals: mine(loaded.approvals).filter((row) => row.date === date),
  };
}

/**
 * Tính một khoảng ngày mà không ghi: `chua_toi`, `dang_lam` đổi theo đồng hồ, nên dòng đã lưu của
 * những ngày cron chưa chốt có thể cũ.
 */
export async function computeDaysLive(
  db: Reader,
  companyId: string,
  employeeIds: string[],
  from: string,
  to: string,
  now: Date = new Date(),
) {
  if (employeeIds.length === 0 || from > to) return [];
  const loaded = await loadInputs(db, companyId, employeeIds, from, to);
  const rows: (DayRecord & { employeeId: string })[] = [];
  for (const employeeId of employeeIds) {
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const input = dayInput(loaded, employeeId, date);
      if (!input) continue;
      for (const record of computeDay(input, now)) rows.push({ ...record, employeeId });
    }
  }
  return rows;
}

/** Ngày đầu tiên cron chưa chốt: từ đây trở đi màn đọc phải tính tại chỗ. */
export function firstLiveDay(today: string): string {
  return addDays(today, -CRON_DAYS_BACK);
}

type RecordFields = {
  employeeId: string;
  date: string;
  shiftId: string | null;
  status: string;
  cong: number;
  workedMin: number;
  lateMin: number;
  earlyMin: number;
  waivedLate: boolean;
  waivedEarly: boolean;
  otProposed: number;
  otApproved: number;
  offDay: boolean;
  isHoliday: boolean;
};

/** Các trường làm đổi tiền hoặc số trên phiếu; bỏ `computed_at` để tính lại ra cùng số không bị coi là đổi. */
function fingerprint(rows: readonly RecordFields[], from: string, to: string): string {
  return rows
    .filter(({ date }) => date >= from && date <= to)
    .map((row) =>
      [
        row.employeeId,
        row.date,
        row.shiftId,
        row.status,
        row.cong,
        row.workedMin,
        row.lateMin,
        row.earlyMin,
        row.waivedLate,
        row.waivedEarly,
        row.otProposed,
        row.otApproved,
        row.offDay,
        row.isHoliday,
      ].join('|'),
    )
    .sort()
    .join('\n');
}

/**
 * Sửa dữ liệu trong kỳ đã công bố vẫn được, phiếu giữ nguyên, nhưng kỳ chuyển sang "cần công bố lại"
 * (D10). Chỉ đặt cờ khi số thật sự đổi: cron chạy lại ra cùng kết quả thì không được báo sai.
 */
async function markChangedPeriodsStale(
  tx: Tx,
  companyId: string,
  ids: string[],
  from: string,
  to: string,
  next: readonly RecordFields[],
) {
  const periods = await tx
    .select({ id: payrollPeriods.id, fromDate: payrollPeriods.fromDate, toDate: payrollPeriods.toDate })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.companyId, companyId),
        eq(payrollPeriods.published, true),
        lte(payrollPeriods.fromDate, to),
        gte(payrollPeriods.toDate, from),
      ),
    );
  if (periods.length === 0) return;

  const current = await tx
    .select()
    .from(dayRecords)
    .where(and(inArray(dayRecords.employeeId, ids), between(dayRecords.date, from, to)));
  for (const period of periods) {
    const start = period.fromDate > from ? period.fromDate : from;
    const end = period.toDate < to ? period.toDate : to;
    if (fingerprint(current, start, end) !== fingerprint(next, start, end)) {
      await tx.update(payrollPeriods).set({ stale: true }).where(eq(payrollPeriods.id, period.id));
    }
  }
}

/** Bỏ các trường chỉ dùng trong tính toán, xem chú thích ở `DayRecord`. */
function toRow(companyId: string, employeeId: string, record: DayRecord, computedAt: Date) {
  const { otRate: _otRate, penalty: _penalty, suggestions, ...fields } = record;
  return { ...fields, companyId, employeeId, suggestion: suggestions, computedAt };
}

/**
 * Tính lại ngày công trong cùng transaction với thao tác ghi, để Hộp việc, Bảng công và Lương khớp
 * ngay (US22). Xoá rồi ghi chứ không upsert: dòng của ca vừa gỡ khỏi lịch phải biến mất. Ngày tương
 * lai bị bỏ qua, chưa có gì để tính. Trả về số dòng đã ghi.
 */
export async function recomputeDays(
  tx: Tx,
  {
    companyId,
    employeeIds,
    from,
    to,
  }: { companyId: string; employeeIds: string[]; from: string; to: string },
  now: Date = new Date(),
): Promise<number> {
  const lastDay = [to, vietnamToday(now)].sort()[0]!;
  const ids = [...new Set(employeeIds)].sort();
  if (ids.length === 0 || from > lastDay) return 0;

  // Sắp xếp ID để hai giao dịch cùng khoá nhiều người không chờ nhau vòng tròn. Khoá này tự mở khi
  // transaction kết thúc nên chạy được qua Transaction pooler của Supabase
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(id, 0)) from unnest(${sql.param(ids)}::text[]) as id`,
  );

  const loaded = await loadInputs(tx, companyId, ids, from, lastDay);
  const rows: ReturnType<typeof toRow>[] = [];
  for (const employeeId of ids) {
    for (let date = from; date <= lastDay; date = addDays(date, 1)) {
      const input = dayInput(loaded, employeeId, date);
      if (!input) continue;
      for (const record of computeDay(input, now)) rows.push(toRow(companyId, employeeId, record, now));
    }
  }

  await markChangedPeriodsStale(tx, companyId, ids, from, lastDay, rows);
  await tx
    .delete(dayRecords)
    .where(and(inArray(dayRecords.employeeId, ids), between(dayRecords.date, from, lastDay)));
  for (let index = 0; index < rows.length; index += INSERT_BATCH) {
    await tx.insert(dayRecords).values(rows.slice(index, index + INSERT_BATCH));
  }
  return rows.length;
}

/** Ngày đầu chưa bị khoá bởi kỳ lương đã công bố; kỳ đã công bố là bản chụp, không tính lại. */
async function openPeriodStart(tx: Tx, companyId: string, today: string): Promise<string> {
  const [published] = await tx
    .select({ toDate: payrollPeriods.toDate })
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.companyId, companyId), eq(payrollPeriods.published, true)))
    .orderBy(desc(payrollPeriods.toDate))
    .limit(1);
  const limit = addDays(today, -MAX_OPEN_DAYS);
  const afterPublished = published ? addDays(published.toDate, 1) : limit;
  return afterPublished > limit ? afterPublished : limit;
}

/** Người còn cần tính công từ ngày `from`: đang làm, hoặc nghỉ sau ngày đó. */
async function employeesSince(tx: Tx, companyId: string, from: string) {
  const rows = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.companyId, companyId),
        or(eq(employees.status, 'active'), gte(employees.leftDate, from)),
      ),
    );
  return rows.map(({ id }) => id);
}

/** Tính lại kỳ chưa công bố khi sửa cấu hình; không truyền `employeeIds` là cả công ty. */
export async function recomputeOpenPeriod(tx: Tx, companyId: string, employeeIds?: string[]) {
  const today = vietnamToday();
  const from = await openPeriodStart(tx, companyId, today);
  const ids = employeeIds ?? (await employeesSince(tx, companyId, from));
  return recomputeDays(tx, { companyId, employeeIds: ids, from, to: today });
}

/** Tính lại một ngày cho cả công ty, khi thêm hoặc xoá ngày lễ. */
export async function recomputeCompanyDay(tx: Tx, companyId: string, date: string) {
  const ids = await employeesSince(tx, companyId, date);
  return recomputeDays(tx, { companyId, employeeIds: ids, from: date, to: date });
}

/** Người có thể bị ảnh hưởng khi sửa ca: có ca cố định, ghi đè, lịch, hoặc đã có ngày công ở ca đó. */
export async function employeesUsingShift(tx: Tx, companyId: string, shiftId: string) {
  const rows = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.companyId, companyId),
        sql`(
          ${employees.positionId} in (select ${positions.id} from ${positions} where ${positions.fixedShiftId} = ${shiftId})
          or ${employees.id} in (select ${employeeShifts.employeeId} from ${employeeShifts} where ${employeeShifts.shiftId} = ${shiftId})
          or ${employees.id} in (select ${scheduleCells.employeeId} from ${scheduleCells} where ${shiftId} = any(${scheduleCells.shiftIds}))
          or ${employees.id} in (select ${dayRecords.employeeId} from ${dayRecords} where ${dayRecords.shiftId} = ${shiftId})
        )`,
      ),
    );
  return rows.map(({ id }) => id);
}

/** Có trường nào trong `keys` đổi giá trị không; đổi tên hay địa chỉ thì khỏi tính lại. */
export function rulesChanged<T extends object>(before: T, after: T, keys: readonly (keyof T)[]) {
  return keys.some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

/**
 * Cron hằng ngày: người không chấm thì không có sự kiện nào, nên `vang` và `thieu_gio` chỉ xuất hiện
 * nhờ bước này. Lỗi ở một công ty không chặn các công ty khác.
 */
export async function recomputeRecentDays(now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const from = addDays(today, -CRON_DAYS_BACK);
  const to = addDays(today, -1);
  const rows = await db.select({ id: companies.id }).from(companies);

  let failed = 0;
  for (const { id: companyId } of rows) {
    try {
      await db.transaction(async (tx) => {
        const employeeIds = await employeesSince(tx, companyId, from);
        const records = await recomputeDays(tx, { companyId, employeeIds, from, to }, now);
        await writeAudit(
          tx,
          { companyId, actorId: null },
          { action: 'day.recompute', entity: 'day_record', after: { from, to, records } },
        );
      });
    } catch (error) {
      failed += 1;
      console.error('Tính lại ngày công lỗi:', companyId, error instanceof Error ? error.message : error);
    }
  }
  return { companies: rows.length, failed, from, to };
}
