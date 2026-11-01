import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import { writeAudit } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { holidays } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { vietnamHolidays } from '@/lib/domain/holiday';
import type { HolidayInput } from '@/lib/validation/holiday';
import { actorOf } from './actor';
import { assertNotPublished, recomputeCompanyDay, recomputeOpenPeriod } from './recompute';

export function listHolidays(ctx: AuthContext) {
  return getDb()
    .select({ id: holidays.id, date: holidays.date, name: holidays.name })
    .from(holidays)
    .where(scopeToCompany(ctx, holidays.companyId))
    .orderBy(asc(holidays.date));
}

export type HolidayView = Awaited<ReturnType<typeof listHolidays>>[number];

export async function createHoliday(ctx: AuthContext, input: HolidayInput) {
  try {
    return await getDb().transaction(async (tx) => {
      await assertNotPublished(tx, ctx.company.id, input.date, input.date);
      const [holiday] = await tx
        .insert(holidays)
        .values({ ...input, companyId: ctx.company.id })
        .returning();
      await writeAudit(tx, actorOf(ctx), {
        action: 'holiday.create',
        entity: 'holiday',
        entityId: holiday!.id,
        after: holiday,
      });
      await recomputeCompanyDay(tx, ctx.company.id, holiday!.date);
      return holiday!;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw new ApiError(409, 'Ngày này đã có trong danh sách', { date: 'Ngày này đã có trong danh sách' });
  }
}

export async function deleteHoliday(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [holiday] = await tx
      .delete(holidays)
      .where(and(eq(holidays.id, id), scopeToCompany(ctx, holidays.companyId)))
      .returning();
    if (!holiday) throw notFound('ngày lễ');
    await assertNotPublished(tx, ctx.company.id, holiday.date, holiday.date);
    await writeAudit(tx, actorOf(ctx), {
      action: 'holiday.delete',
      entity: 'holiday',
      entityId: id,
      before: holiday,
    });
    await recomputeCompanyDay(tx, ctx.company.id, holiday.date);
  });
}

/** Thêm ngày lễ cố định của năm; ngày đã có thì giữ nguyên, chạy lại không tạo trùng (US08). */
export async function seedVietnamHolidays(ctx: AuthContext, year: number) {
  return getDb().transaction(async (tx) => {
    const added = await tx
      .insert(holidays)
      .values(vietnamHolidays(year).map((holiday) => ({ ...holiday, companyId: ctx.company.id })))
      .onConflictDoNothing()
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'holiday.seed_vn',
      entity: 'holiday',
      after: { year, added: added.length },
    });
    // Thêm năm sau thì chưa có gì để tính; thêm năm nay thì có thể trúng ngày đã qua
    if (added.some(({ date }) => date <= vietnamToday())) await recomputeOpenPeriod(tx, ctx.company.id);
    return added;
  });
}
