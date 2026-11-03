import 'server-only';
import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  adjustments,
  companies,
  employees,
  payrollPeriods,
  payslips,
  positions,
  requests,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { periodByKey } from '@/lib/domain/period';
import { formatDate } from '@/lib/format';
import {
  computePay,
  type PayDay,
  type PayLine,
  type PayProfile,
  type PayResult,
} from '@/lib/payroll/compute-pay';
import type { AdjustmentInput } from '@/lib/validation/payroll';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { notify } from './notifications';
import { readDayRecords, staffInScope } from './day';
import { firstLiveDay, loadEmployeeRules, recomputeDays } from './recompute';
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
};

type Staff = Awaited<ReturnType<typeof staffInScope>>[number];

/** Mức lương của từng người: ghi đè riêng thắng vị trí, người chưa có vị trí là 0đ. */
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

  return new Map(
    rows.map(({ employee, position }): [string, PayProfile & { fixedShiftId: string | null }] => {
      const pay = employee.payOverride;
      const rule = rules.get(employee.id)!;
      return [
        employee.id,
        {
          payType: pay?.payType ?? position?.payType ?? 'month',
          payAmount: pay?.payAmount ?? position?.payAmount ?? 0,
          stdDays: pay?.stdDays ?? position?.stdDays ?? DEFAULT_STD_DAYS,
          otRates: rule.otRates,
          fixedShiftId: rule.fixedShiftId,
        },
      ];
    }),
  );
}

/** Tiền lương cả nhóm của một kỳ, tính khi đọc từ cùng nguồn với Hộp việc và Bảng công. */
async function computePeriod(ctx: AuthContext, staff: Staff[], from: string, to: string, key: string) {
  const db = getDb();
  const ids = staff.map(({ id }) => id);
  const today = vietnamToday();
  const [profiles, records, library, adjustmentRows, pendingRequests] = await Promise.all([
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
          lte(requests.fromDate, to),
          gte(requests.toDate, from),
        ),
      ),
  ]);

  const hoursOf = (shiftId: string | null) => library.find(({ id }) => id === shiftId)?.stdHours ?? null;

  return staff.map((person) => {
    const profile = profiles.get(person.id)!;
    const own = records.filter(({ employeeId }) => employeeId === person.id);
    const days: PayDay[] = own.map((record) => ({
      ...record,
      stdHours: hoursOf(record.shiftId) ?? hoursOf(profile.fixedShiftId),
    }));
    const manual = adjustmentRows.filter(({ employeeId }) => employeeId === person.id);
    const issues =
      own.filter(({ needsReview }) => needsReview).length +
      pendingRequests.filter(({ employeeId }) => employeeId === person.id).length;
    return { ...person, profile, manual, issues, pay: computePay({ profile, days, adjustments: manual }) };
  });
}

function summaryRow({ id, name, positionName, profile, manual, issues, pay }: PeriodRow) {
  return {
    id,
    name,
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

async function periodStatus(ctx: AuthContext, key: string) {
  const db = getDb();
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(scopeToCompany(ctx, payrollPeriods.companyId), eq(payrollPeriods.periodKey, key)));
  if (!period?.published)
    return { published: false, publishedAt: null, stale: false, publishedNet: 0, count: 0 };

  const slips = await db.select({ net: payslips.net }).from(payslips).where(eq(payslips.periodId, period.id));
  return {
    published: true,
    publishedAt: period.publishedAt,
    stale: period.stale,
    publishedNet: slips.reduce((sum, { net }) => sum + net, 0),
    count: slips.length,
  };
}

/** Quỹ lương, tiến độ và danh sách của một kỳ (US34). */
export async function getPayroll(ctx: AuthContext, periodKey?: string) {
  const { period, previousKey, nextKey } = await periodFor(ctx, periodKey, vietnamToday());
  const staff = await staffInScope(ctx, period.from);
  const [rows, status] = await Promise.all([
    computePeriod(ctx, staff, period.from, period.to, period.key),
    periodStatus(ctx, period.key),
  ]);
  const withOt = rows.filter((row) => row.pay.summary.otApprovedMin > 0);
  const waiting = rows.filter((row) => row.pay.summary.otPendingMin > 0);
  const flagged = rows.filter(({ issues }) => issues > 0);
  const adjusted = rows.filter(({ manual }) => manual.length > 0);

  return {
    period,
    previousKey,
    nextKey,
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
    employees: rows.map(summaryRow),
  };
}

export type PayrollView = Awaited<ReturnType<typeof getPayroll>>;

/** Sao kê một người: từng dòng có công thức chữ, OT chờ và thực lĩnh dự phóng (US34). */
export async function getPayStatement(ctx: AuthContext, employeeId: string, periodKey?: string) {
  const { period } = await periodFor(ctx, periodKey, vietnamToday());
  const staff = await staffInScope(ctx, period.from);
  const person = staff.find(({ id }) => id === employeeId);
  if (!person) throw notFound('nhân viên');

  const [row] = await computePeriod(ctx, [person], period.from, period.to, period.key);
  const { id, name, positionName, profile, manual, issues, pay } = row!;
  return {
    period,
    employee: { id, name, positionName },
    payType: profile.payType,
    payAmount: profile.payAmount,
    stdDays: profile.stdDays,
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

/**
 * Công bố kỳ: bản chụp bất biến gồm cả mức lương lúc đó, vì schema không lưu lịch sử cấu hình. Công
 * bố lại thay bản chụp cũ, `audit_logs` giữ số trước đó (D11).
 */
export async function publishPayroll(ctx: AuthContext, periodKey?: string) {
  const companyId = ctx.company.id;
  const today = vietnamToday();
  const { period } = await periodFor(ctx, periodKey, today);
  if (period.from > today) throw new ApiError(409, 'Kỳ này chưa bắt đầu');
  const staff = await staffInScope(ctx, period.from);
  const rows = await computePeriod(ctx, staff, period.from, period.to, period.key);
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
    await recomputeDays(tx, {
      companyId,
      employeeIds: staff.map(({ id }) => id),
      from: period.from > liveFrom ? period.from : liveFrom,
      to: period.to,
    });

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
        set: { published: true, publishedAt, publishedBy: ctx.employee.id, stale: false },
      })
      .returning();
    const periodId = record!.id;

    const before = await tx.delete(payslips).where(eq(payslips.periodId, periodId)).returning({
      employeeId: payslips.employeeId,
      net: payslips.net,
    });
    if (rows.length > 0) {
      await tx.insert(payslips).values(
        rows.map(({ id, positionName, profile, pay }) => ({
          companyId,
          periodId,
          employeeId: id,
          net: pay.net,
          lines: pay.lines,
          summary: {
            ...pay.summary,
            positionName,
            payType: profile.payType,
            payAmount: profile.payAmount,
            stdDays: profile.stdDays,
            from: period.from,
            to: period.to,
          },
          publishedAt,
        })),
      );
    }

    const republished = before.length > 0;
    await notify(
      tx,
      rows.map(({ id }) => ({
        companyId,
        employeeId: id,
        kind: 'payslip' as const,
        title: republished ? 'Phiếu lương đã cập nhật' : 'Có phiếu lương mới',
        body: `Kỳ ${formatDate(period.from).slice(0, 5)} – ${formatDate(period.to)}`,
        href: '#/luong',
      })),
    );

    const totalNet = total(rows, ({ pay }) => pay.net);
    await writeAudit(tx, actorOf(ctx), {
      action: republished ? 'payroll.republish' : 'payroll.publish',
      entity: 'payroll_period',
      entityId: periodId,
      before: before.length > 0 ? { payslips: before } : null,
      after: { periodKey: period.key, count: rows.length, total: totalNet },
    });
    return { periodKey: period.key, count: rows.length, total: totalNet };
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
