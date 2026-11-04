import 'server-only';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { employees, positions, requests, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { requestSummary } from '@/lib/domain/request-text';
import { canDecideOwn } from './approvals';
import { draftedRegistrationIds } from './schedule-drafts';
import { periodFor } from './timesheet';

/**
 * Lịch sử đơn của một kỳ lương, mọi trạng thái, của người mình quản lý: đơn có ngày nằm trong kỳ.
 * Lọc trạng thái, loại và tên làm ở trình duyệt vì một quán chỉ có vài chục đơn mỗi kỳ.
 */
export async function listRequestHistory(ctx: AuthContext, periodKey?: string) {
  const db = getDb();
  const { period, previousKey, nextKey } = await periodFor(ctx, periodKey, vietnamToday());
  const decider = alias(employees, 'decider');

  const [rows, library, drafted, ownAllowed] = await Promise.all([
    db
      .select({
        id: requests.id,
        type: requests.type,
        payload: requests.payload,
        fromDate: requests.fromDate,
        toDate: requests.toDate,
        reason: requests.reason,
        status: requests.status,
        rejectNote: requests.rejectNote,
        createdAt: requests.createdAt,
        decidedAt: requests.decidedAt,
        employeeId: requests.employeeId,
        employeeName: employees.name,
        positionName: positions.name,
        deciderName: decider.name,
      })
      .from(requests)
      .innerJoin(employees, eq(employees.id, requests.employeeId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .leftJoin(decider, eq(decider.id, requests.decidedBy))
      .where(
        and(
          scopeToStaff(ctx, { companyId: requests.companyId, employeeId: requests.employeeId }),
          lte(requests.fromDate, period.to),
          gte(requests.toDate, period.from),
        ),
      )
      .orderBy(desc(requests.createdAt)),
    db.select({ id: shifts.id, name: shifts.name }).from(shifts).where(scopeToCompany(ctx, shifts.companyId)),
    draftedRegistrationIds(db, ctx.company.id),
    canDecideOwn(db, ctx),
  ]);
  const shiftName = (id: unknown) => library.find((shift) => shift.id === id)?.name ?? null;

  return {
    period,
    previousKey,
    nextKey,
    requests: rows.map(({ payload, ...row }) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      summary: requestSummary(row.type, payload as Record<string, unknown>, shiftName),
      /** Đăng ký đã nhận vào nháp, chờ Công bố ở màn Xếp ca. */
      inDraft: drafted.has(row.id),
      /** Người quyết định đã bị xoá thì không còn tên. */
      deciderRemoved: row.decidedAt !== null && row.deciderName === null,
      decidable: row.status === 'pending' && (row.employeeId !== ctx.employee.id || ownAllowed),
    })),
  };
}

export type RequestHistoryView = Awaited<ReturnType<typeof listRequestHistory>>;
export type RequestHistoryRow = RequestHistoryView['requests'][number];
