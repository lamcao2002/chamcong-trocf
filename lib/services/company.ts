import 'server-only';
import { and, eq } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb, type Db } from '@/lib/db/client';
import { companies, payrollPeriods } from '@/lib/db/schema';
import type { CompanyInput } from '@/lib/validation/company';
import { actorOf } from './actor';
import { recomputeOpenPeriod, rulesChanged } from './recompute';

/** Quy tắc làm đổi ngày công; đổi tên hay địa chỉ thì khỏi tính lại. */
const COMPANY_RULES = ['graceMode', 'otBefore', 'otMin', 'otFromRequest'] as const;

/** Đổi ngày chốt thì kỳ mới chồng lên kỳ đã trả lương (D13), nên khoá từ lần công bố đầu tiên. */
async function isCutoffLocked(db: Pick<Db, 'select'>, companyId: string) {
  const [published] = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.companyId, companyId), eq(payrollPeriods.published, true)))
    .limit(1);
  return Boolean(published);
}

export async function getCompany(ctx: AuthContext) {
  const db = getDb();
  const [[company], cutoffLocked] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, ctx.company.id)),
    isCutoffLocked(db, ctx.company.id),
  ]);
  if (!company) throw notFound('công ty');
  return { ...company, cutoffLocked };
}

export type CompanyView = Awaited<ReturnType<typeof getCompany>>;

export async function updateCompany(ctx: AuthContext, input: Partial<CompanyInput>) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(companies).where(eq(companies.id, ctx.company.id)).for('update');
    if (!before) throw notFound('công ty');
    if (Object.keys(input).length === 0) return before;
    const cutoffChanged = input.cutoffDay !== undefined && input.cutoffDay !== before.cutoffDay;
    if (cutoffChanged && (await isCutoffLocked(tx, ctx.company.id))) {
      const message = 'Đã có kỳ công bố nên không đổi được ngày chốt';
      throw new ApiError(409, message, { cutoffDay: message });
    }

    const [company] = await tx
      .update(companies)
      .set(input)
      .where(eq(companies.id, ctx.company.id))
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'company.update',
      entity: 'company',
      entityId: ctx.company.id,
      before,
      after: company,
    });
    if (rulesChanged(before, company!, COMPANY_RULES)) await recomputeOpenPeriod(tx, ctx.company.id);
    return company!;
  });
}
