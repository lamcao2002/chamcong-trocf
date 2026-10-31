import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { getCompany, updateCompany } from '@/lib/services/company';
import { companyPatchSchema } from '@/lib/validation/company';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/company — thông tin và quy tắc công ty (US09, US10). */
export const GET = withAuth({ roles: ADMIN_ONLY }, async (ctx) => ok({ company: await getCompany(ctx) }));

/** PATCH /api/v1/company — chỉ gửi các trường đã đổi. */
export const PATCH = withAuth({ roles: ADMIN_ONLY }, async (ctx, request) =>
  ok({ company: await updateCompany(ctx, await parseBody(request, companyPatchSchema)) }),
);
