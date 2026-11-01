import 'server-only';
import { eq } from 'drizzle-orm';
import { notFound } from '@/lib/api/errors';
import { writeAudit } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { companies } from '@/lib/db/schema';
import type { CompanyInput } from '@/lib/validation/company';
import { actorOf } from './actor';
import { recomputeOpenPeriod, rulesChanged } from './recompute';

/** Quy tắc làm đổi ngày công; đổi tên hay địa chỉ thì khỏi tính lại. */
const COMPANY_RULES = ['graceMode', 'otBefore', 'otMin', 'otFromRequest'] as const;

export async function getCompany(ctx: AuthContext) {
  const [company] = await getDb().select().from(companies).where(eq(companies.id, ctx.company.id));
  if (!company) throw notFound('công ty');
  return company;
}

export type CompanyView = Awaited<ReturnType<typeof getCompany>>;

export async function updateCompany(ctx: AuthContext, input: Partial<CompanyInput>) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(companies).where(eq(companies.id, ctx.company.id)).for('update');
    if (!before) throw notFound('công ty');
    if (Object.keys(input).length === 0) return before;

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
