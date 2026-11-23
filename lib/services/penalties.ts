import 'server-only';
import { and, asc, between, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { companies, employees, penalties, penaltyDismissals, penaltyRules, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { periodByKey, periodOf } from '@/lib/domain/period';
import {
  activeTotals,
  attendanceIssues,
  crossedThreshold,
  issueLabel,
  OTHER_RULE,
  overThreshold,
  PENALTY_BACK_DAYS,
  penaltyValueLabel,
  type PenaltyEvidence,
  type PenaltyIssue,
} from '@/lib/domain/penalties';
import { addDays } from '@/lib/engine/time';
import { formatDate } from '@/lib/format';
import type {
  PenaltyCancelInput,
  PenaltyInput,
  PenaltyIssueInput,
  PenaltyRuleInput,
} from '@/lib/validation/penalty';
import { actorOf } from './actor';
import { assertCanDecide, canDecideOwn } from './approvals';
import { readDayRecords } from './day';
import { notify } from './notifications';
import { lockEmployees } from './recompute';
import { periodFor } from './timesheet';

type Reader = Pick<Tx, 'select'>;

async function companyRules(db: Reader, companyId: string) {
  const [company] = await db
    .select({ cutoffDay: companies.cutoffDay, scarThreshold: companies.scarThreshold })
    .from(companies)
    .where(eq(companies.id, companyId));
  return { cutoffDay: company?.cutoffDay ?? null, scarThreshold: company?.scarThreshold ?? null };
}

// ——— Quy định ———

const RULE_COLUMNS = {
  id: penaltyRules.id,
  name: penaltyRules.name,
  scars: penaltyRules.scars,
  amount: penaltyRules.amount,
  note: penaltyRules.note,
};

/** Quy định còn dùng, theo tên; quy định đã lưu trữ không hiện để chọn nữa. */
export function listPenaltyRules(ctx: AuthContext) {
  return getDb()
    .select(RULE_COLUMNS)
    .from(penaltyRules)
    .where(and(scopeToCompany(ctx, penaltyRules.companyId), eq(penaltyRules.archived, false)))
    .orderBy(asc(penaltyRules.name));
}

export type PenaltyRuleView = Awaited<ReturnType<typeof listPenaltyRules>>[number];

const findRule = (ctx: AuthContext, id: string) =>
  and(eq(penaltyRules.id, id), scopeToCompany(ctx, penaltyRules.companyId), eq(penaltyRules.archived, false));

export async function createPenaltyRule(ctx: AuthContext, input: PenaltyRuleInput) {
  return getDb().transaction(async (tx) => {
    const [rule] = await tx
      .insert(penaltyRules)
      .values({ ...input, companyId: ctx.company.id })
      .returning(RULE_COLUMNS);
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty_rule.create',
      entity: 'penalty_rule',
      entityId: rule!.id,
      after: rule,
    });
    return rule!;
  });
}

/** Sửa quy định không đổi phiếu đã phạt: phiếu giữ tên và số lúc phạt. */
export async function updatePenaltyRule(ctx: AuthContext, id: string, input: PenaltyRuleInput) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(penaltyRules).where(findRule(ctx, id)).for('update');
    if (!before) throw notFound('quy định');
    const [rule] = await tx.update(penaltyRules).set(input).where(findRule(ctx, id)).returning(RULE_COLUMNS);
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty_rule.update',
      entity: 'penalty_rule',
      entityId: id,
      before,
      after: rule,
    });
    return rule!;
  });
}

/** Quy định đã có phiếu phạt thì lưu trữ để phiếu cũ vẫn trỏ được; chưa dùng thì xoá hẳn. */
export async function deletePenaltyRule(ctx: AuthContext, id: string) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(penaltyRules).where(findRule(ctx, id)).for('update');
    if (!before) throw notFound('quy định');
    const [used] = await tx
      .select({ id: penalties.id })
      .from(penalties)
      .where(eq(penalties.ruleId, id))
      .limit(1);
    if (used) await tx.update(penaltyRules).set({ archived: true }).where(eq(penaltyRules.id, id));
    else await tx.delete(penaltyRules).where(eq(penaltyRules.id, id));
    await writeAudit(tx, actorOf(ctx), {
      action: used ? 'penalty_rule.archive' : 'penalty_rule.delete',
      entity: 'penalty_rule',
      entityId: id,
      before,
    });
    return { archived: Boolean(used) };
  });
}

// ——— Phiếu phạt ———

const byPerson = alias(employees, 'penalty_by');
const cancelPerson = alias(employees, 'penalty_cancel_by');

/** Phiếu phạt kèm tên người bị phạt, người phạt, người huỷ; mới nhất trước. */
function penaltyRows(db: Reader, where: ReturnType<typeof and>) {
  return db
    .select({
      id: penalties.id,
      employeeId: penalties.employeeId,
      employeeName: employees.name,
      ruleId: penalties.ruleId,
      ruleName: penalties.ruleName,
      date: penalties.date,
      periodKey: penalties.periodKey,
      scars: penalties.scars,
      amount: penalties.amount,
      note: penalties.note,
      issue: penalties.issue,
      evidence: penalties.evidence,
      byId: penalties.by,
      byName: byPerson.name,
      createdAt: penalties.createdAt,
      cancelledAt: penalties.cancelledAt,
      cancelledByName: cancelPerson.name,
      cancelReason: penalties.cancelReason,
    })
    .from(penalties)
    .innerJoin(employees, eq(employees.id, penalties.employeeId))
    .leftJoin(byPerson, eq(byPerson.id, penalties.by))
    .leftJoin(cancelPerson, eq(cancelPerson.id, penalties.cancelledBy))
    .where(where)
    .orderBy(desc(penalties.date), desc(penalties.createdAt));
}

export type PenaltyRow = Awaited<ReturnType<typeof penaltyRows>>[number];

/** Huỷ được khi là người đã phạt hoặc Quản trị viên, và phiếu chưa huỷ. */
const cancellable = (ctx: AuthContext, row: Pick<PenaltyRow, 'byId' | 'cancelledAt'>) =>
  !row.cancelledAt && (ctx.employee.role === 'admin' || row.byId === ctx.employee.id);

// ——— Lỗi chấm công ———

type IssueKey = { employeeId: string; date: string; shiftId: string | null; issue: PenaltyIssue | null };
const issueKey = ({ employeeId, date, shiftId, issue }: IssueKey) =>
  `${employeeId}|${date}|${shiftId}|${issue}`;

/**
 * Các ca có lần chấm hoặc lỗi của những người này trong khoảng ngày, kèm lỗi còn phạt được. Ngày công
 * đọc qua `readDayRecords` như mọi màn khác.
 */
async function attendanceShifts(
  companyId: string,
  employeeIds: string[],
  from: string,
  to: string,
  now: Date,
) {
  if (employeeIds.length === 0 || from > to) return [];
  const db = getDb();
  const days = (await readDayRecords(db, companyId, employeeIds, from, to, now)).filter(
    (day) => day.shiftId && (day.inAt || day.outAt || attendanceIssues(day).length > 0),
  );
  const ids = [...new Set(days.map(({ shiftId }) => shiftId!))];
  const library = ids.length
    ? await db
        .select({ id: shifts.id, code: shifts.code, startTime: shifts.startTime, endTime: shifts.endTime })
        .from(shifts)
        .where(and(eq(shifts.companyId, companyId), inArray(shifts.id, ids)))
    : [];
  const byId = new Map(library.map((shift) => [shift.id, shift]));
  return days
    .map((day) => {
      const shift = byId.get(day.shiftId!);
      return {
        employeeId: day.employeeId,
        date: day.date,
        shiftId: day.shiftId!,
        shiftCode: shift?.code ?? '?',
        shiftHours: shift ? `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}` : '',
        inAt: day.inAt ? new Date(day.inAt).toISOString() : null,
        outAt: day.outAt ? new Date(day.outAt).toISOString() : null,
        issues: attendanceIssues(day).map((issue) => ({ issue, label: issueLabel(issue, day) })),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.shiftHours.localeCompare(b.shiftHours));
}

type AttendanceShift = Awaited<ReturnType<typeof attendanceShifts>>[number];

/** Lỗi đã có phiếu còn hiệu lực và lỗi đã Bỏ qua, theo khoá người × ngày × ca × lỗi. */
async function handledIssues(employeeIds: string[], from: string, to: string) {
  if (employeeIds.length === 0) return { penalized: new Set<string>(), dismissed: [] };
  const db = getDb();
  const [active, dismissed] = await Promise.all([
    db
      .select({
        employeeId: penalties.employeeId,
        date: penalties.date,
        shiftId: penalties.shiftId,
        issue: penalties.issue,
      })
      .from(penalties)
      .where(
        and(
          inArray(penalties.employeeId, employeeIds),
          between(penalties.date, from, to),
          isNotNull(penalties.issue),
          isNull(penalties.cancelledAt),
        ),
      ),
    db
      .select({
        id: penaltyDismissals.id,
        employeeId: penaltyDismissals.employeeId,
        date: penaltyDismissals.date,
        shiftId: penaltyDismissals.shiftId,
        issue: penaltyDismissals.issue,
      })
      .from(penaltyDismissals)
      .where(
        and(inArray(penaltyDismissals.employeeId, employeeIds), between(penaltyDismissals.date, from, to)),
      ),
  ]);
  return { penalized: new Set(active.map(issueKey)), dismissed };
}

/** Trải mỗi ca thành từng lỗi, kèm tên người, để làm danh sách gợi ý. */
function issueRows(rows: readonly AttendanceShift[], names: ReadonlyMap<string, string>) {
  return rows.flatMap(({ issues, ...shift }) =>
    issues.map(({ issue, label }) => ({
      ...shift,
      employeeName: names.get(shift.employeeId) ?? '',
      issue,
      issueLabel: label,
    })),
  );
}

/** Người này mình phạt được (trong phạm vi, không phải chính mình); kiểm trước khi đọc chấm công. */
const canPenalize = (ctx: AuthContext, employeeId: string) =>
  getDb().transaction((tx) => assertCanDecide(tx, ctx, employeeId));

/** Chấm công một ngày của một người mình phạt được, để làm bằng chứng trong form phạt. */
export async function attendanceOfDay(
  ctx: AuthContext,
  employeeId: string,
  date: string,
  now: Date = new Date(),
) {
  await canPenalize(ctx, employeeId);
  const [rows, { penalized }] = await Promise.all([
    attendanceShifts(ctx.company.id, [employeeId], date, date, now),
    handledIssues([employeeId], date, date),
  ]);
  return rows.map((row) => ({
    ...row,
    issues: row.issues.map((item) => ({
      ...item,
      penalized: penalized.has(issueKey({ ...row, issue: item.issue })),
    })),
  }));
}

export type AttendanceDayView = Awaited<ReturnType<typeof attendanceOfDay>>;

/** Lỗi đang còn của một ca, tính lại tại chỗ; không còn (đã miễn, sửa công) thì 400. */
async function standingIssue(ctx: AuthContext, input: IssueKey, now: Date) {
  const [row] = await attendanceShifts(ctx.company.id, [input.employeeId], input.date, input.date, now).then(
    (rows) => rows.filter(({ shiftId }) => shiftId === input.shiftId),
  );
  const found = row?.issues.find(({ issue }) => issue === input.issue);
  if (!row || !found) {
    const message = 'Ca này không còn lỗi chấm công này';
    throw new ApiError(400, message, { issue: message });
  }
  const evidence: PenaltyEvidence = {
    shiftCode: row.shiftCode,
    shiftHours: row.shiftHours,
    inAt: row.inAt,
    outAt: row.outAt,
    issueLabel: found.label,
  };
  return evidence;
}

/** Bỏ qua một lỗi trong gợi ý phạt; lỗi phải còn thật. */
export async function dismissIssue(ctx: AuthContext, input: PenaltyIssueInput, now: Date = new Date()) {
  await canPenalize(ctx, input.employeeId);
  await standingIssue(ctx, input, now);
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(penaltyDismissals)
      .values({ ...input, companyId: ctx.company.id, by: ctx.employee.id })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ApiError(409, 'Lỗi này đã bỏ qua');
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty.dismiss',
      entity: 'penalty_dismissal',
      entityId: row.id,
      after: row,
    });
    return row;
  });
}

/** Khôi phục lỗi đã Bỏ qua về danh sách gợi ý. */
export async function restoreIssue(ctx: AuthContext, id: string) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(penaltyDismissals)
      .where(
        and(
          eq(penaltyDismissals.id, id),
          scopeToStaff(ctx, {
            companyId: penaltyDismissals.companyId,
            employeeId: penaltyDismissals.employeeId,
          }),
        ),
      )
      .for('update');
    if (!before) throw notFound('lỗi đã bỏ qua');
    await tx.delete(penaltyDismissals).where(eq(penaltyDismissals.id, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty.restore',
      entity: 'penalty_dismissal',
      entityId: id,
      before,
    });
    return { restored: true };
  });
}

/**
 * Phiếu phạt của một kỳ trong phạm vi quản lý, kèm tổng theo người. Kỳ bỏ trống là kỳ hôm nay.
 * Tiền phạt chỉ ghi nhận, không vào Lương.
 */
export async function listPenalties(ctx: AuthContext, periodKey?: string, now: Date = new Date()) {
  const db = getDb();
  const [{ scarThreshold }, { period, previousKey, nextKey, currentKey }, staffRows, own] = await Promise.all(
    [
      companyRules(db, ctx.company.id),
      periodFor(ctx, periodKey, vietnamToday(now)),
      db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(
          and(
            scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
            eq(employees.status, 'active'),
          ),
        )
        .orderBy(asc(employees.name)),
      canDecideOwn(db, ctx),
    ],
  );
  const rows = await penaltyRows(
    db,
    and(
      scopeToStaff(ctx, { companyId: penalties.companyId, employeeId: penalties.employeeId }),
      eq(penalties.periodKey, period.key),
    ),
  );
  const staff = staffRows.filter(({ id }) => own || id !== ctx.employee.id);
  const today = vietnamToday(now);
  const issueTo = period.to < today ? period.to : today;
  const staffIds = staff.map(({ id }) => id);
  const [attendance, handled] = await Promise.all([
    attendanceShifts(ctx.company.id, staffIds, period.from, issueTo, now),
    handledIssues(staffIds, period.from, issueTo),
  ]);
  const names = new Map(staff.map(({ id, name }) => [id, name]));
  const dismissedIds = new Map(handled.dismissed.map((row) => [issueKey(row), row.id]));
  const allIssues = issueRows(attendance, names).filter((row) => !handled.penalized.has(issueKey(row)));

  const people = [...new Map(rows.map((row) => [row.employeeId, row.employeeName])).entries()]
    .map(([employeeId, name]) => {
      const totals = activeTotals(rows.filter((row) => row.employeeId === employeeId));
      return { employeeId, name, ...totals, overThreshold: overThreshold(totals.scars, scarThreshold) };
    })
    .sort((a, b) => b.scars - a.scars || b.amount - a.amount || a.name.localeCompare(b.name, 'vi'));

  return {
    period,
    previousKey,
    nextKey,
    currentKey,
    scarThreshold,
    /** Người phạt được, để chọn trong form; không có chính mình (trừ Quản trị viên duy nhất). */
    staff,
    people,
    /** Lỗi chấm công trong kỳ tới hôm nay chưa có phiếu và chưa Bỏ qua; mới nhất trước. */
    issues: allIssues.filter((row) => !dismissedIds.has(issueKey(row))).reverse(),
    /** Lỗi đã Bỏ qua, kèm `dismissalId` để Khôi phục. */
    dismissed: allIssues
      .flatMap((row) => {
        const dismissalId = dismissedIds.get(issueKey(row));
        return dismissalId ? [{ ...row, dismissalId }] : [];
      })
      .reverse(),
    penalties: rows.map((row) => ({ ...row, cancellable: cancellable(ctx, row) })),
  };
}

export type PenaltyListView = Awaited<ReturnType<typeof listPenalties>>;

/** Sẹo còn hiệu lực của một người trong một kỳ. */
async function scarsIn(tx: Reader, employeeId: string, periodKey: string) {
  const [row] = await tx
    .select({ scars: sql<number>`coalesce(sum(${penalties.scars}), 0)::int` })
    .from(penalties)
    .where(
      and(
        eq(penalties.employeeId, employeeId),
        eq(penalties.periodKey, periodKey),
        sql`${penalties.cancelledAt} is null`,
      ),
    );
  return row?.scars ?? 0;
}

/**
 * Phạt một người mình quản lý. Báo nhân viên ngay; lần phạt đưa số sẹo trong kỳ lên đủ ngưỡng thì báo
 * thêm một lần. Khoá nhân viên để hai lần phạt cùng lúc không cùng bỏ sót ngưỡng.
 */
export async function createPenalty(ctx: AuthContext, input: PenaltyInput, now: Date = new Date()) {
  const today = vietnamToday(now);
  if (input.date > today) {
    throw new ApiError(400, 'Ngày vi phạm không ở tương lai', { date: 'Ngày không hợp lệ' });
  }
  if (input.date < addDays(today, -PENALTY_BACK_DAYS)) {
    const message = `Chỉ phạt được vi phạm trong ${PENALTY_BACK_DAYS} ngày gần đây`;
    throw new ApiError(400, message, { date: message });
  }

  // Bằng chứng chấm công do server chụp, không nhận từ client
  let evidence: PenaltyEvidence | null = null;
  if (input.shiftId && input.issue) {
    await canPenalize(ctx, input.employeeId);
    evidence = await standingIssue(ctx, { ...input, shiftId: input.shiftId, issue: input.issue }, now);
  }

  return getDb().transaction(async (tx) => {
    await lockEmployees(tx, [input.employeeId]);
    await assertCanDecide(tx, ctx, input.employeeId);
    if (evidence) {
      const [taken] = await tx
        .select({ id: penalties.id })
        .from(penalties)
        .where(
          and(
            eq(penalties.employeeId, input.employeeId),
            eq(penalties.date, input.date),
            eq(penalties.shiftId, input.shiftId!),
            eq(penalties.issue, input.issue!),
            isNull(penalties.cancelledAt),
          ),
        );
      if (taken) throw new ApiError(409, 'Lỗi chấm công này đã có phiếu phạt');
    }
    const { cutoffDay, scarThreshold } = await companyRules(tx, ctx.company.id);

    let ruleName = `${OTHER_RULE}: ${input.otherReason ?? ''}`;
    if (input.ruleId) {
      const [rule] = await tx.select().from(penaltyRules).where(findRule(ctx, input.ruleId));
      if (!rule) throw new ApiError(400, 'Quy định không còn', { ruleId: 'Chọn lại quy định' });
      ruleName = rule.name;
    }

    const periodKey = periodOf(input.date, cutoffDay).key;
    const before = await scarsIn(tx, input.employeeId, periodKey);
    const [penalty] = await tx
      .insert(penalties)
      .values({
        companyId: ctx.company.id,
        employeeId: input.employeeId,
        ruleId: input.ruleId,
        ruleName,
        date: input.date,
        periodKey,
        scars: input.scars,
        amount: input.amount,
        note: input.note,
        shiftId: evidence ? input.shiftId : null,
        issue: evidence ? input.issue : null,
        evidence,
        by: ctx.employee.id,
      })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty.create',
      entity: 'penalty',
      entityId: penalty!.id,
      after: penalty,
    });

    const after = before + input.scars;
    await notify(tx, [
      {
        companyId: ctx.company.id,
        employeeId: input.employeeId,
        kind: 'penalty',
        title: `Bạn bị phạt: ${ruleName}`,
        body: `${penaltyValueLabel(input)} · ngày ${formatDate(input.date)}`,
        href: '#/toi',
      },
      ...(crossedThreshold(before, after, scarThreshold)
        ? [
            {
              companyId: ctx.company.id,
              employeeId: input.employeeId,
              kind: 'penalty' as const,
              title: `Bạn đã có ${after} sẹo trong kỳ này`,
              body: `Đã đủ ngưỡng ${scarThreshold} sẹo của quán. Quản lý sẽ trao đổi với bạn.`,
              href: '#/toi',
            },
          ]
        : []),
    ]);
    return { penalty: penalty!, scars: after, overThreshold: overThreshold(after, scarThreshold) };
  });
}

/** Huỷ phạt có lý do; phiếu giữ lại, không tính sẹo và tiền nữa. Người đã phạt hoặc Quản trị viên. */
export async function cancelPenalty(ctx: AuthContext, id: string, { reason }: PenaltyCancelInput) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(penalties)
      .where(
        and(
          eq(penalties.id, id),
          scopeToStaff(ctx, { companyId: penalties.companyId, employeeId: penalties.employeeId }),
        ),
      )
      .for('update');
    if (!before) throw notFound('phiếu phạt');
    if (before.cancelledAt) throw new ApiError(409, 'Phiếu phạt này đã huỷ');
    if (!cancellable(ctx, { byId: before.by, cancelledAt: null })) {
      throw new ApiError(403, 'Chỉ người đã phạt hoặc Quản trị viên được huỷ');
    }

    const [penalty] = await tx
      .update(penalties)
      .set({ cancelledAt: new Date(), cancelledBy: ctx.employee.id, cancelReason: reason })
      .where(eq(penalties.id, id))
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'penalty.cancel',
      entity: 'penalty',
      entityId: id,
      before,
      after: penalty,
    });
    await notify(tx, [
      {
        companyId: before.companyId,
        employeeId: before.employeeId,
        kind: 'penalty',
        title: `Đã huỷ phạt: ${before.ruleName}`,
        body: `${penaltyValueLabel(before)} ngày ${formatDate(before.date)} · ${reason}`,
        href: '#/toi',
      },
    ]);
    return penalty!;
  });
}

/**
 * Phiếu phạt của một người một ngày cho drawer ngày ở Bảng công, kèm quy định để mở form phạt.
 * `canPenalize` sai khi là chính mình (trừ Quản trị viên duy nhất).
 */
export async function penaltiesOfDay(ctx: AuthContext, employeeId: string, date: string) {
  const db = getDb();
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
      ),
    );
  if (!employee) throw notFound('nhân viên');
  const [rows, rules, own] = await Promise.all([
    penaltyRows(db, and(eq(penalties.employeeId, employeeId), eq(penalties.date, date))),
    listPenaltyRules(ctx),
    canDecideOwn(db, ctx),
  ]);
  return {
    canPenalize: own || employeeId !== ctx.employee.id,
    rules,
    penalties: rows.map((row) => ({ ...row, cancellable: cancellable(ctx, row) })),
  };
}

export type PenaltiesOfDayView = Awaited<ReturnType<typeof penaltiesOfDay>>;

// ——— App nhân viên ———

/** Phạt của chính mình trong một kỳ (bỏ trống là kỳ hôm nay) và các kỳ có phạt để chọn. */
export async function getMyPenalties(ctx: AuthContext, periodKey?: string, now: Date = new Date()) {
  const db = getDb();
  const { cutoffDay, scarThreshold } = await companyRules(db, ctx.company.id);
  const current = periodOf(vietnamToday(now), cutoffDay);
  const period = periodKey ? periodByKey(periodKey, cutoffDay) : current;
  const mine = eq(penalties.employeeId, ctx.employee.id);
  const [rows, keys] = await Promise.all([
    penaltyRows(db, and(mine, eq(penalties.periodKey, period.key))),
    db
      .selectDistinct({ key: penalties.periodKey })
      .from(penalties)
      .where(mine)
      .orderBy(desc(penalties.periodKey)),
  ]);
  const totals = activeTotals(rows);
  return {
    period,
    periods: [...new Set([current.key, ...keys.map(({ key }) => key)])]
      .sort()
      .reverse()
      .map((key) => periodByKey(key, cutoffDay)),
    scarThreshold,
    ...totals,
    overThreshold: overThreshold(totals.scars, scarThreshold),
    penalties: rows.map(({ byId: _by, ...row }) => row),
  };
}

export type MyPenaltiesView = Awaited<ReturnType<typeof getMyPenalties>>;
