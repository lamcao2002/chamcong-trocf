import 'server-only';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { approvals, employees, explanations, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import type { ApprovalInput } from '@/lib/validation/approval';
import { actorOf } from './actor';
import { recomputeDays } from './recompute';
import { assertOwned } from './references';

type Reader = Pick<Tx, 'select'>;

const ALREADY_DECIDED = 'Việc này vừa được xử lý, hãy làm mới danh sách';

/** Tự duyệt chỉ được khi công ty có đúng một Quản trị viên, không còn ai khác để duyệt (C6). */
export async function canDecideOwn(db: Reader, ctx: AuthContext): Promise<boolean> {
  if (ctx.employee.role !== 'admin') return false;
  const [admins] = await db
    .select({ total: count() })
    .from(employees)
    .where(
      and(
        eq(employees.companyId, ctx.company.id),
        eq(employees.role, 'admin'),
        eq(employees.status, 'active'),
      ),
    );
  return admins?.total === 1;
}

/** Người được quyết định phải quản lý nhân viên đó và không phải chính họ. */
export async function assertCanDecide(tx: Tx, ctx: AuthContext, employeeId: string) {
  const [employee] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        scopeToStaff(ctx, { companyId: employees.companyId, employeeId: employees.id }),
      ),
    );
  if (!employee) throw notFound('nhân viên');
  if (employeeId === ctx.employee.id && !(await canDecideOwn(tx, ctx))) {
    throw new ApiError(403, 'Bạn không tự duyệt việc của mình được');
  }
}

const sameShift = (shiftId: string | null) => sql`${approvals.shiftId} is not distinct from ${shiftId}`;

/** Giải trình đi theo quyết định của ngày: duyệt thì đóng, hoàn duyệt thì mở lại (C9). */
async function setExplanationStatus(
  tx: Tx,
  { employeeId, date, shiftId }: { employeeId: string; date: string; shiftId: string | null },
  status: 'pending' | 'approved',
) {
  await tx
    .update(explanations)
    .set({ status })
    .where(
      and(
        eq(explanations.employeeId, employeeId),
        eq(explanations.date, date),
        sql`${explanations.shiftId} is not distinct from ${shiftId}`,
      ),
    );
}

/** Mỗi nhân viên × ngày × ca có một bản ghi hiệu lực: quyết định sau gộp vào bản ghi đang có (C1). */
export async function saveApproval(ctx: AuthContext, input: ApprovalInput) {
  const { employeeId, date, shiftId, ...decision } = input;
  const companyId = ctx.company.id;
  if (date > vietnamToday()) throw new ApiError(400, 'Chưa tới ngày này', { date: 'Chưa tới ngày này' });

  try {
    return await getDb().transaction(async (tx) => {
      await assertCanDecide(tx, ctx, employeeId);
      await assertOwned(tx, ctx, shifts, [shiftId, decision.confirmShiftId], 'shiftId');

      const [before] = await tx
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.employeeId, employeeId),
            eq(approvals.date, date),
            sameShift(shiftId),
            isNull(approvals.revokedAt),
          ),
        )
        .for('update');

      const by = { by: ctx.employee.id, at: new Date() };
      const [approval] = before
        ? await tx
            .update(approvals)
            .set({ ...decision, ...by })
            .where(eq(approvals.id, before.id))
            .returning()
        : await tx
            .insert(approvals)
            .values({ companyId, employeeId, date, shiftId, ...decision, ...by })
            .returning();

      await setExplanationStatus(tx, { employeeId, date, shiftId }, 'approved');
      await writeAudit(tx, actorOf(ctx), {
        action: before ? 'approval.update' : 'approval.create',
        entity: 'approval',
        entityId: approval!.id,
        before,
        after: approval,
      });
      await recomputeDays(tx, { companyId, employeeIds: [employeeId], from: date, to: date });
      return approval!;
    });
  } catch (error) {
    // Hai người cùng duyệt lần đầu: index chỉ cho một bản ghi hiệu lực
    if (isUniqueViolation(error)) throw new ApiError(409, ALREADY_DECIDED);
    throw error;
  }
}

/** Hoàn duyệt: giữ dòng để truy vết, ngày trở về kết quả hệ thống. */
export async function revokeApproval(ctx: AuthContext, id: string) {
  const companyId = ctx.company.id;
  await getDb().transaction(async (tx) => {
    const [approval] = await tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, id), eq(approvals.companyId, companyId), isNull(approvals.revokedAt)))
      .for('update');
    if (!approval) throw notFound('bản ghi duyệt');
    const { employeeId, date, shiftId } = approval;
    await assertCanDecide(tx, ctx, employeeId);

    await tx.update(approvals).set({ revokedAt: new Date() }).where(eq(approvals.id, id));
    await setExplanationStatus(tx, { employeeId, date, shiftId }, 'pending');
    await writeAudit(tx, actorOf(ctx), {
      action: 'approval.revoke',
      entity: 'approval',
      entityId: id,
      before: approval,
    });
    await recomputeDays(tx, { companyId, employeeIds: [employeeId], from: date, to: date });
  });
}
