import 'server-only';
import { and, asc, between, count, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  adjustments,
  approvals,
  companies,
  employeePositions,
  employees,
  payrollPeriods,
  payslips,
  positions,
  requests,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { daySymbol } from '@/lib/domain/symbols';
import { periodByKey } from '@/lib/domain/period';
import { formatDate } from '@/lib/format';
import {
  computePay,
  type PayDay,
  type PayLine,
  type PayProfile,
  type PayResult,
  type RoleProfile,
} from '@/lib/payroll/compute-pay';
import { positionOfShift } from '@/lib/domain/shift-positions';
import type { AdjustmentInput } from '@/lib/validation/payroll';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { notify } from './notifications';
import { readDayRecords, staffInScope } from './day';
import { firstLiveDay, loadEmployeeRules, recomputeDays } from './recompute';
import { positionsOf } from './staff-positions';
import { periodFor } from './timesheet';

const DEFAULT_STD_DAYS = 26;

/** Tổng hợp trong bản chụp, gồm cả mức lương lúc công bố vì schema không lưu lịch sử cấu hình. */
type PayslipSummary = PayResult['summary'] & {
  positionName: string | null;
  payType: PayProfile['payType'];
  payAmount: number;
  stdDays: number;
  from: string;
  to: string;
  /** Từng ca lúc công bố; phiếu công bố trước khi có trường này thì không có. */
  days?: PayDayDetail[];
  /** Người giữ nhiều vị trí: bảng ngày công có cột Vị trí. */
  multiPosition?: boolean;
};

type Staff = Awaited<ReturnType<typeof staffInScope>>[number];

/**
 * Mức lương của từng người: ghi đè riêng thắng vị trí, người chưa có vị trí là 0đ. Vị trí phụ trả
 * theo giờ hoặc theo công có mức riêng; lương riêng của người đó ở vị trí phụ thắng mức của vị trí.
 */
async function loadProfiles(ids: string[]) {
  const db = getDb();
  const [rules, rows] = await Promise.all([
    loadEmployeeRules(db, ids),
    db
      .select({ employee: employees, position: positions })
      .from(employees)
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .where(inArray(employees.id, ids)),
  ]);
  const held = await positionsOf(
    db,
    rows.map(({ employee }) => employee),
  );
  const extraIds = [...new Set([...held.values()].flatMap((list) => list.slice(1)))];
  const [extras, ownPay] =
    extraIds.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(positions).where(inArray(positions.id, extraIds)),
          db.select().from(employeePositions).where(inArray(employeePositions.employeeId, ids)),
        ]);

  return new Map(
    rows.map(({ employee, position }): [string, Profile] => {
      const pay = employee.payOverride;
      const rule = rules.get(employee.id)!;
      const stdDays = pay?.stdDays ?? position?.stdDays ?? DEFAULT_STD_DAYS;
      const roles: Record<string, RoleProfile> = {};
      for (const extra of extras) {
        if (!held.get(employee.id)?.slice(1).includes(extra.id) || extra.payType === 'month') continue;
        const own = ownPay.find((row) => row.employeeId === employee.id && row.positionId === extra.id);
        roles[extra.id] = { ...roleProfileOf(extra, stdDays), payAmount: own?.payAmount ?? extra.payAmount };
      }
      return [
        employee.id,
        {
          payType: pay?.payType ?? position?.payType ?? 'month',
          payAmount: pay?.payAmount ?? position?.payAmount ?? 0,
          stdDays,
          otRates: rule.otRates,
          fixedShiftId: rule.fixedShiftId,
          primaryId: employee.positionId,
          roles,
          positionCount: held.get(employee.id)?.length ?? (employee.positionId ? 1 : 0),
        },
      ];
    }),
  );
}

/** Mức lương theo một vị trí trả theo giờ hoặc theo công; công chuẩn lấy của vị trí chính. */
function roleProfileOf(position: typeof positions.$inferSelect, stdDays: number): RoleProfile {
  return {
    name: position.name,
    payType: position.payType as RoleProfile['payType'],
    payAmount: position.payAmount,
    stdDays,
    otRates: {
      weekday: position.otWeekday,
      saturday: position.otSaturday,
      offday: position.otOffday,
      holiday: position.otHoliday,
    },
  };
}

type Profile = PayProfile & {
  fixedShiftId: string | null;
  primaryId: string | null;
  roles: Record<string, RoleProfile>;
  /** Số vị trí người đó giữ: hơn một thì phiếu có cột Vị trí. */
  positionCount: number;
};

/** Tiền lương cả nhóm của một kỳ, tính khi đọc từ cùng nguồn với Hộp việc và Bảng công. */
async function computePeriod(ctx: AuthContext, staff: Staff[], from: string, to: string, key: string) {
  const db = getDb();
  const ids = staff.map(({ id }) => id);
  const today = vietnamToday();
  const [profiles, records, library, adjustmentRows, pendingRequests, cells, positionNames, notes] =
    await Promise.all([
      loadProfiles(ids),
      readDayRecords(db, ctx.company.id, ids, from, to < today ? to : today),
      db
        .select({ id: shifts.id, stdHours: shifts.stdHours })
        .from(shifts)
        .where(scopeToCompany(ctx, shifts.companyId)),
      db
        .select()
        .from(adjustments)
        .where(and(scopeToCompany(ctx, adjustments.companyId), eq(adjustments.periodKey, key)))
        .orderBy(asc(adjustments.createdAt)),
      db
        .select({ employeeId: requests.employeeId })
        .from(requests)
        .where(
          and(
            scopeToCompany(ctx, requests.companyId),
            eq(requests.status, 'pending'),
            // Đăng ký ca chưa nhận không đổi công của ai, không được giữ người đó ở "chưa sẵn sàng"
            ne(requests.type, 'shift_register'),
            ne(requests.type, 'shift_pass'),
            lte(requests.fromDate, to),
            gte(requests.toDate, from),
          ),
        ),
      db
        .select({
          employeeId: scheduleCells.employeeId,
          date: scheduleCells.date,
          positions: scheduleCells.positions,
        })
        .from(scheduleCells)
        .where(and(inArray(scheduleCells.employeeId, ids), between(scheduleCells.date, from, to))),
      db
        .select({ id: positions.id, name: positions.name })
        .from(positions)
        .where(scopeToCompany(ctx, positions.companyId)),
      // Ghi chú quản lý gõ khi duyệt công, hiện trên bảng ngày công của phiếu
      db
        .select({
          employeeId: approvals.employeeId,
          date: approvals.date,
          shiftId: approvals.shiftId,
          note: approvals.note,
        })
        .from(approvals)
        .where(
          and(
            inArray(approvals.employeeId, ids),
            between(approvals.date, from, to),
            isNull(approvals.revokedAt),
            isNotNull(approvals.note),
          ),
        ),
    ]);

  const hoursOf = (shiftId: string | null) => library.find(({ id }) => id === shiftId)?.stdHours ?? null;
  // Ca nhận từ pass ca có thể ở vị trí người đó không có (người Pha chế làm thay ca Phục vụ): trả theo mức vị trí của ca
  const referenced = [...new Set(cells.flatMap(({ positions: map }) => Object.values(map)))];
  const covered =
    referenced.length === 0 ? [] : await db.select().from(positions).where(inArray(positions.id, referenced));

  return staff.map((person) => {
    const base = profiles.get(person.id)!;
    const borrowed = covered.filter(({ id, payType }) => id !== base.primaryId && payType !== 'month');
    const profile = {
      ...base,
      roles: {
        ...Object.fromEntries(borrowed.map((row) => [row.id, roleProfileOf(row, base.stdDays)])),
        ...base.roles,
      },
    };
    const own = records.filter(({ employeeId }) => employeeId === person.id);
    const roleOf = ({ date, shiftId }: (typeof own)[number]) => {
      if (!shiftId) return null;
      const cell = cells.find((row) => row.employeeId === person.id && row.date === date);
      const positionId = positionOfShift(cell?.positions, shiftId, profile.primaryId);
      return positionId && profile.roles[positionId] ? positionId : null;
    };
    const days: PayDay[] = own.map((record) => ({
      ...record,
      stdHours: hoursOf(record.shiftId) ?? hoursOf(profile.fixedShiftId),
      roleId: roleOf(record),
    }));
    const manual = adjustmentRows.filter(({ employeeId }) => employeeId === person.id);
    const issues =
      own.filter(({ needsReview }) => needsReview).length +
      pendingRequests.filter(({ employeeId }) => employeeId === person.id).length;
    const pay = computePay({ profile, days, adjustments: manual, roles: profile.roles });
    // Vị trí và ghi chú từng ca, cùng thứ tự với `records`
    const details = own.map(({ date, shiftId }) => {
      const cell = cells.find((row) => row.employeeId === person.id && row.date === date);
      const positionId = shiftId ? positionOfShift(cell?.positions, shiftId, profile.primaryId) : null;
      const note = notes.find(
        (row) => row.employeeId === person.id && row.date === date && row.shiftId === shiftId,
      )?.note;
      return {
        positionName: positionNames.find(({ id }) => id === positionId)?.name ?? person.positionName,
        note: note?.trim() || null,
      };
    });
    return { ...person, profile, manual, issues, pay, records: own, details };
  });
}

function summaryRow({ id, name, email, positionName, profile, manual, issues, pay }: PeriodRow) {
  return {
    id,
    name,
    email,
    positionName,
    payType: profile.payType,
    cong: pay.summary.cong,
    otApprovedMin: pay.summary.otApprovedMin,
    otPendingMin: pay.summary.otPendingMin,
    net: pay.net,
    issues,
    ready: issues === 0,
    hasAdjustment: manual.length > 0,
  };
}

type PeriodRow = Awaited<ReturnType<typeof computePeriod>>[number];

const total = (rows: readonly PeriodRow[], pick: (row: PeriodRow) => number) =>
  rows.reduce((sum, row) => sum + pick(row), 0);

const paidOt = ({ pay }: PeriodRow) =>
  pay.lines.filter(({ key }) => key.startsWith('ot_')).reduce((sum, { amount }) => sum + amount, 0);

const manualAmount = ({ manual }: PeriodRow) =>
  manual.reduce((sum, { kind, amount }) => sum + (kind === 'bonus' ? amount : -amount), 0);

type SlipRow = { employeeId: string; net: number; lines: unknown };

/** Phiếu đã chụp khác số tính lúc này: tiền hoặc một dòng sao kê đã đổi, cần công bố lại (D10). */
function slipChanged(slip: SlipRow, pay: PayResult): boolean {
  const lines = (slip.lines as PayLine[]).map(({ key, amount }) => `${key}:${amount}`).join('|');
  return slip.net !== pay.net || lines !== pay.lines.map(({ key, amount }) => `${key}:${amount}`).join('|');
}

export type SlipState = 'none' | 'published' | 'stale';

function slipStateOf(slips: readonly SlipRow[], row: PeriodRow): SlipState {
  const slip = slips.find(({ employeeId }) => employeeId === row.id);
  if (!slip) return 'none';
  return slipChanged(slip, row.pay) ? 'stale' : 'published';
}

/** Trạng thái công bố của kỳ theo từng người: công bố được một phần, mỗi người cần công bố lại riêng. */
async function periodStatus(ctx: AuthContext, key: string) {
  const db = getDb();
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(scopeToCompany(ctx, payrollPeriods.companyId), eq(payrollPeriods.periodKey, key)));
  if (!period?.published) {
    return { published: false, publishedAt: null, publishedBy: null, slips: [] as SlipRow[] };
  }

  const [slips, [by]] = await Promise.all([
    db
      .select({ employeeId: payslips.employeeId, net: payslips.net, lines: payslips.lines })
      .from(payslips)
      .where(eq(payslips.periodId, period.id)),
    period.publishedBy
      ? db.select({ name: employees.name }).from(employees).where(eq(employees.id, period.publishedBy))
      : [],
  ]);
  return {
    published: true,
    /** Lần công bố gần nhất, của bất kỳ ai trong kỳ. */
    publishedAt: period.publishedAt,
    /** Người đã xoá thì không còn tên. */
    publishedBy: by?.name ?? null,
    slips,
  };
}

/** Quỹ lương, tiến độ và danh sách của một kỳ (US34). */
export async function getPayroll(ctx: AuthContext, periodKey?: string) {
  const { period, previousKey, nextKey, currentKey } = await periodFor(ctx, periodKey, vietnamToday());
  const staff = await staffInScope(ctx, period.from);
  const [rows, { slips, ...published }] = await Promise.all([
    computePeriod(ctx, staff, period.from, period.to, period.key),
    periodStatus(ctx, period.key),
  ]);
  const states = new Map(rows.map((row) => [row.id, slipStateOf(slips, row)]));
  const mine = slips.filter(({ employeeId }) => states.has(employeeId));
  const staleCount = [...states.values()].filter((state) => state === 'stale').length;
  const status = {
    ...published,
    published: mine.length > 0,
    /** Số người đã có phiếu trong kỳ, trên `headcount`. */
    count: mine.length,
    staleCount,
    stale: staleCount > 0,
    publishedNet: mine.reduce((sum, { net }) => sum + net, 0),
  };
  const withOt = rows.filter((row) => row.pay.summary.otApprovedMin > 0);
  const waiting = rows.filter((row) => row.pay.summary.otPendingMin > 0);
  const flagged = rows.filter(({ issues }) => issues > 0);
  const adjusted = rows.filter(({ manual }) => manual.length > 0);

  return {
    period,
    previousKey,
    nextKey,
    currentKey,
    status,
    fund: total(rows, ({ pay }) => pay.net),
    headcount: rows.length,
    readyCount: rows.length - flagged.length,
    otApproved: {
      amount: total(rows, paidOt),
      minutes: total(withOt, ({ pay }) => pay.summary.otApprovedMin),
      people: withOt.length,
    },
    otPending: {
      amount: total(rows, ({ pay }) => pay.pendingOt.amount),
      minutes: total(waiting, ({ pay }) => pay.summary.otPendingMin),
      people: waiting.length,
    },
    review: { items: total(flagged, ({ issues }) => issues), people: flagged.length },
    adjustments: { amount: total(rows, manualAmount), people: adjusted.length },
    employees: rows.map((row) => ({ ...summaryRow(row), slip: states.get(row.id)! })),
  };
}

export type PayrollView = Awaited<ReturnType<typeof getPayroll>>;

type ShiftLibrary = Awaited<ReturnType<typeof shiftLibrary>>;

function shiftLibrary(ctx: AuthContext) {
  return getDb()
    .select({ id: shifts.id, code: shifts.code, name: shifts.name, startTime: shifts.startTime })
    .from(shifts)
    .where(scopeToCompany(ctx, shifts.companyId));
}

/**
 * Từng ca trong kỳ cho bảng Từng ngày của sao kê và phiếu nhân viên. `dayAmounts` cùng thứ tự với
 * `records`, ghép trước khi sắp theo ngày và giờ bắt đầu ca.
 */
function statementDays({ records, pay, details }: PeriodRow, library: ShiftLibrary) {
  const shiftOf = (shiftId: string | null) => library.find((shift) => shift.id === shiftId);
  return records
    .map((record, index) => ({ record, amount: pay.dayAmounts[index] ?? null, ...details[index]! }))
    .sort(
      ({ record: a }, { record: b }) =>
        a.date.localeCompare(b.date) ||
        (shiftOf(a.shiftId)?.startTime ?? '').localeCompare(shiftOf(b.shiftId)?.startTime ?? ''),
    )
    .map(({ record, amount, positionName, note }) => {
      const symbol = daySymbol([record]);
      const lateMin = record.waivedLate ? 0 : record.lateMin;
      const earlyMin = record.waivedEarly ? 0 : record.earlyMin;
      return {
        date: record.date,
        shiftId: record.shiftId,
        shiftCode: shiftOf(record.shiftId)?.code ?? null,
        shiftName: shiftOf(record.shiftId)?.name ?? null,
        positionName,
        /** Ghi chú của quản lý khi duyệt công. */
        note,
        inAt: record.inAt,
        outAt: record.outAt,
        workedMin: record.workedMin,
        cong: record.cong,
        payFactor: record.payFactor,
        /** Tiền của ca với lương giờ; lương tháng và công không tách theo ca. */
        amount,
        lateMin,
        earlyMin,
        otApproved: record.otApproved,
        otPending: Math.max(0, record.otProposed - record.otApproved),
        symbol: symbol.key,
        symbolLabel: symbol.label,
        symbolTitle: symbol.title,
        // Ngày đủ công, không muộn sớm, không OT thì ẩn khi tắt "Hiện đủ từng ngày"
        notable:
          record.needsReview ||
          lateMin > 0 ||
          earlyMin > 0 ||
          record.otProposed > 0 ||
          record.otApproved !== 0 ||
          record.payFactor !== 1 ||
          !['du', 'le', 'chua_toi', 'dang_lam'].includes(record.status),
      };
    });
}

export type PayDayDetail = ReturnType<typeof statementDays>[number];

/** Sao kê một người: từng dòng có công thức chữ, OT chờ và thực lĩnh dự phóng (US34). */
export async function getPayStatement(ctx: AuthContext, employeeId: string, periodKey?: string) {
  const { period } = await periodFor(ctx, periodKey, vietnamToday());
  const staff = await staffInScope(ctx, period.from);
  const person = staff.find(({ id }) => id === employeeId);
  if (!person) throw notFound('nhân viên');

  const [[row], library] = await Promise.all([
    computePeriod(ctx, [person], period.from, period.to, period.key),
    shiftLibrary(ctx),
  ]);
  const { id, name, positionName, profile, manual, issues, pay, records } = row!;
  const shiftOf = (shiftId: string | null) => library.find((shift) => shift.id === shiftId);
  const days = statementDays(row!, library);
  const fixedShift = shiftOf(profile.fixedShiftId);
  return {
    period,
    employee: { id, name, positionName },
    payType: profile.payType,
    payAmount: profile.payAmount,
    stdDays: profile.stdDays,
    /** Ca cố định thì có tên ca, linh hoạt là null. */
    fixedShiftName: fixedShift?.name ?? null,
    shiftCount: records.filter(({ cong }) => cong > 0).length,
    days,
    issues,
    adjustments: manual.map(({ id: adjustmentId, kind, amount, note }) => ({
      id: adjustmentId,
      kind,
      amount,
      note,
    })),
    ...pay,
  };
}

export type PayStatement = Awaited<ReturnType<typeof getPayStatement>>;

/** Phiếu của kỳ đã công bố không đổi theo; đánh dấu kỳ để trang Lương báo cần công bố lại. */
async function markPeriodStale(tx: Parameters<typeof writeAudit>[0], companyId: string, key: string) {
  await tx
    .update(payrollPeriods)
    .set({ stale: true })
    .where(
      and(
        eq(payrollPeriods.companyId, companyId),
        eq(payrollPeriods.periodKey, key),
        eq(payrollPeriods.published, true),
      ),
    );
}

/** Thêm thưởng/phạt cho kỳ: cộng trừ thẳng vào thực lĩnh (US35). */
export async function createAdjustment(ctx: AuthContext, input: AdjustmentInput) {
  const companyId = ctx.company.id;
  return getDb().transaction(async (tx) => {
    await assertCanDecide(tx, ctx, input.employeeId);
    const [adjustment] = await tx
      .insert(adjustments)
      .values({ ...input, companyId, by: ctx.employee.id })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'adjustment.create',
      entity: 'adjustment',
      entityId: adjustment!.id,
      after: adjustment,
    });
    await markPeriodStale(tx, companyId, input.periodKey);
    return adjustment!;
  });
}

export async function deleteAdjustment(ctx: AuthContext, id: string) {
  const companyId = ctx.company.id;
  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(adjustments)
      .where(and(eq(adjustments.id, id), eq(adjustments.companyId, companyId)))
      .for('update');
    if (!before) throw notFound('khoản thưởng/phạt');
    await assertCanDecide(tx, ctx, before.employeeId);
    await tx.delete(adjustments).where(eq(adjustments.id, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'adjustment.delete',
      entity: 'adjustment',
      entityId: id,
      before,
    });
    await markPeriodStale(tx, companyId, before.periodKey);
  });
}

/** Người được chọn phải trong phạm vi của kỳ; không chọn là cả kỳ. */
function pickTargets<T extends { id: string }>(staff: readonly T[], employeeIds?: readonly string[]): T[] {
  if (!employeeIds) return [...staff];
  const picked = staff.filter(({ id }) => employeeIds.includes(id));
  if (picked.length !== new Set(employeeIds).size) throw notFound('nhân viên');
  return picked;
}

const periodRange = ({ from, to }: { from: string; to: string }) =>
  `Kỳ ${formatDate(from).slice(0, 5)} – ${formatDate(to)}`;

/**
 * Công bố cả kỳ hoặc một số người: bản chụp bất biến gồm cả mức lương lúc đó, vì schema không lưu
 * lịch sử cấu hình. Công bố lại thay bản chụp cũ của người được chọn, phiếu người khác giữ nguyên;
 * `audit_logs` giữ số trước đó (D11).
 */
export async function publishPayroll(ctx: AuthContext, periodKey?: string, employeeIds?: string[]) {
  const companyId = ctx.company.id;
  const today = vietnamToday();
  const { period } = await periodFor(ctx, periodKey, today);
  if (period.from > today) throw new ApiError(409, 'Kỳ này chưa bắt đầu');
  const staff = await staffInScope(ctx, period.from);
  const targets = pickTargets(staff, employeeIds);
  const targetIds = targets.map(({ id }) => id);
  // Tính cả kỳ để biết sau lần này còn ai cần công bố lại
  const [rows, library] = await Promise.all([
    computePeriod(ctx, staff, period.from, period.to, period.key),
    shiftLibrary(ctx),
  ]);
  const picked = rows.filter(({ id }) => targetIds.includes(id));
  const publishedAt = new Date();

  return getDb().transaction(async (tx) => {
    // Giữ dòng công ty tới hết transaction: `updateCompany` chờ ở đây rồi mới thấy kỳ vừa công bố
    const [company] = await tx
      .select({ cutoffDay: companies.cutoffDay })
      .from(companies)
      .where(eq(companies.id, companyId))
      .for('share');
    const current = periodByKey(period.key, company?.cutoffDay ?? null);
    if (current.from !== period.from || current.to !== period.to) {
      throw new ApiError(409, 'Ngày chốt vừa đổi, hãy tải lại trang Lương rồi công bố');
    }

    // Phiếu lấy số tính tại chỗ cho ngày gần đây; ghi lại để `day_records` khớp phiếu, nếu không lần
    // cron kế tiếp sẽ thấy dòng mới và báo cần công bố lại dù tiền không đổi
    const liveFrom = firstLiveDay(today);
    if (targetIds.length > 0) {
      await recomputeDays(tx, {
        companyId,
        employeeIds: targetIds,
        from: period.from > liveFrom ? period.from : liveFrom,
        to: period.to,
      });
    }

    const [record] = await tx
      .insert(payrollPeriods)
      .values({
        companyId,
        periodKey: period.key,
        fromDate: period.from,
        toDate: period.to,
        published: true,
        publishedAt,
        publishedBy: ctx.employee.id,
        stale: false,
      })
      .onConflictDoUpdate({
        target: [payrollPeriods.companyId, payrollPeriods.periodKey],
        set: { published: true, publishedAt, publishedBy: ctx.employee.id },
      })
      .returning();
    const periodId = record!.id;

    const before =
      targetIds.length === 0
        ? []
        : await tx
            .delete(payslips)
            .where(and(eq(payslips.periodId, periodId), inArray(payslips.employeeId, targetIds)))
            .returning({ employeeId: payslips.employeeId, net: payslips.net });
    if (picked.length > 0) {
      await tx.insert(payslips).values(
        picked.map((row) => ({
          companyId,
          periodId,
          employeeId: row.id,
          net: row.pay.net,
          lines: row.pay.lines,
          summary: {
            ...row.pay.summary,
            positionName: row.positionName,
            payType: row.profile.payType,
            payAmount: row.profile.payAmount,
            stdDays: row.profile.stdDays,
            from: period.from,
            to: period.to,
            days: statementDays(row, library),
            multiPosition: row.profile.positionCount > 1,
          },
          publishedAt,
        })),
      );
    }

    // Cờ của kỳ cho Excel và phiếu in: còn người khác có phiếu cũ đã lệch số thì vẫn cần công bố lại
    const others = await tx
      .select({ employeeId: payslips.employeeId, net: payslips.net, lines: payslips.lines })
      .from(payslips)
      .where(eq(payslips.periodId, periodId));
    const stale = rows.some((row) => !targetIds.includes(row.id) && slipStateOf(others, row) === 'stale');
    await tx.update(payrollPeriods).set({ stale }).where(eq(payrollPeriods.id, periodId));

    const had = new Set(before.map(({ employeeId }) => employeeId));
    await notify(
      tx,
      picked.map(({ id }) => ({
        companyId,
        employeeId: id,
        kind: 'payslip' as const,
        title: had.has(id) ? 'Phiếu lương đã cập nhật' : 'Có phiếu lương mới',
        body: periodRange(period),
        href: '#/luong',
      })),
    );

    const totalNet = total(picked, ({ pay }) => pay.net);
    await writeAudit(tx, actorOf(ctx), {
      action: before.length > 0 ? 'payroll.republish' : 'payroll.publish',
      entity: 'payroll_period',
      entityId: periodId,
      before: before.length > 0 ? { payslips: before } : null,
      after: {
        periodKey: period.key,
        count: picked.length,
        total: totalNet,
        ...(employeeIds ? { employeeIds: targetIds } : {}),
      },
    });
    return { periodKey: period.key, count: picked.length, total: totalNet };
  });
}

/**
 * Huỷ công bố cả kỳ hoặc một số người: xoá bản chụp nên người đó hết thấy phiếu. Không còn phiếu nào
 * thì kỳ về Chưa công bố. `audit_logs` giữ số của các phiếu vừa xoá.
 */
export async function unpublishPayroll(ctx: AuthContext, periodKey?: string, employeeIds?: string[]) {
  const companyId = ctx.company.id;
  const { period } = await periodFor(ctx, periodKey, vietnamToday());
  const targetIds = employeeIds
    ? pickTargets(await staffInScope(ctx, period.from), employeeIds).map(({ id }) => id)
    : null;

  return getDb().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(payrollPeriods)
      .where(and(eq(payrollPeriods.companyId, companyId), eq(payrollPeriods.periodKey, period.key)))
      .for('update');
    if (!record?.published) throw new ApiError(409, 'Kỳ này chưa công bố');

    const before = await tx
      .delete(payslips)
      .where(
        and(
          eq(payslips.periodId, record.id),
          targetIds ? inArray(payslips.employeeId, targetIds) : undefined,
        ),
      )
      .returning({ employeeId: payslips.employeeId, net: payslips.net });
    if (targetIds && before.length === 0) throw new ApiError(409, 'Những người đã chọn chưa có phiếu kỳ này');

    const [left] = await tx.select({ total: count() }).from(payslips).where(eq(payslips.periodId, record.id));
    if (!left?.total) {
      await tx
        .update(payrollPeriods)
        .set({ published: false, publishedAt: null, publishedBy: null, stale: false })
        .where(eq(payrollPeriods.id, record.id));
    }

    await notify(
      tx,
      before.map(({ employeeId }) => ({
        companyId,
        employeeId,
        kind: 'payslip' as const,
        title: 'Phiếu lương đã thu hồi',
        body: `${periodRange(period)} đang được sửa, sẽ công bố lại`,
        href: '#/luong',
      })),
    );
    await writeAudit(tx, actorOf(ctx), {
      action: 'payroll.unpublish',
      entity: 'payroll_period',
      entityId: record.id,
      before: { periodKey: period.key, publishedAt: record.publishedAt, payslips: before },
      after: left?.total ? { remaining: left.total } : null,
    });
    return { periodKey: period.key, count: before.length };
  });
}

/** Danh sách phiếu đã công bố của chính nhân viên, mới nhất trước (US36). */
export async function listMyPayslips(ctx: AuthContext) {
  return getDb()
    .select({
      periodKey: payrollPeriods.periodKey,
      from: payrollPeriods.fromDate,
      to: payrollPeriods.toDate,
      net: payslips.net,
      publishedAt: payslips.publishedAt,
    })
    .from(payslips)
    .innerJoin(payrollPeriods, eq(payrollPeriods.id, payslips.periodId))
    .where(eq(payslips.employeeId, ctx.employee.id))
    .orderBy(sql`${payrollPeriods.toDate} desc`);
}

/** Một phiếu: chỉ đọc bản chụp, không tính lại. Chỉ lọc theo phiên nên không xem được phiếu người khác. */
export async function getMyPayslip(ctx: AuthContext, periodKey: string) {
  const [slip] = await getDb()
    .select({
      periodKey: payrollPeriods.periodKey,
      from: payrollPeriods.fromDate,
      to: payrollPeriods.toDate,
      net: payslips.net,
      lines: payslips.lines,
      summary: payslips.summary,
      publishedAt: payslips.publishedAt,
    })
    .from(payslips)
    .innerJoin(payrollPeriods, eq(payrollPeriods.id, payslips.periodId))
    .where(and(eq(payslips.employeeId, ctx.employee.id), eq(payrollPeriods.periodKey, periodKey)));
  if (!slip) throw notFound('phiếu lương');
  return { ...slip, lines: slip.lines as PayLine[], summary: slip.summary as PayslipSummary };
}

/**
 * Số liệu cho Excel và phiếu in. Kỳ đã công bố lấy bản chụp, kể cả khi đang chờ công bố lại, để giấy
 * luôn khớp phiếu nhân viên đang thấy; kỳ chưa công bố tính tại chỗ và được đánh dấu tạm tính.
 */
export async function getPayrollDocument(ctx: AuthContext, periodKey?: string, employeeId?: string) {
  const db = getDb();
  const { period } = await periodFor(ctx, periodKey, vietnamToday());
  const [record] = await db
    .select()
    .from(payrollPeriods)
    .where(and(scopeToCompany(ctx, payrollPeriods.companyId), eq(payrollPeriods.periodKey, period.key)));

  if (record?.published) {
    const rows = await db
      .select({
        employeeId: payslips.employeeId,
        name: employees.name,
        net: payslips.net,
        lines: payslips.lines,
        summary: payslips.summary,
      })
      .from(payslips)
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .where(
        and(eq(payslips.periodId, record.id), employeeId ? eq(payslips.employeeId, employeeId) : undefined),
      )
      .orderBy(asc(employees.name));
    return {
      period,
      state: record.stale ? ('stale' as const) : ('published' as const),
      slips: rows.map((row) => {
        const summary = row.summary as PayslipSummary;
        return {
          employeeId: row.employeeId,
          name: row.name,
          positionName: summary.positionName,
          payType: summary.payType,
          cong: summary.cong,
          otApprovedMin: summary.otApprovedMin,
          lines: row.lines as PayLine[],
          net: row.net,
        };
      }),
    };
  }

  const staff = await staffInScope(ctx, period.from);
  const wanted = employeeId ? staff.filter(({ id }) => id === employeeId) : staff;
  const rows = wanted.length > 0 ? await computePeriod(ctx, wanted, period.from, period.to, period.key) : [];
  return {
    period,
    state: 'draft' as const,
    slips: rows.map(({ id, name, positionName, profile, pay }) => ({
      employeeId: id,
      name,
      positionName,
      payType: profile.payType,
      cong: pay.summary.cong,
      otApprovedMin: pay.summary.otApprovedMin,
      lines: pay.lines,
      net: pay.net,
    })),
  };
}

export type PayrollDocument = Awaited<ReturnType<typeof getPayrollDocument>>;
export type PayslipView = Awaited<ReturnType<typeof getMyPayslip>>;
export type PayslipRow = Awaited<ReturnType<typeof listMyPayslips>>[number];
