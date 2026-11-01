import { notFound } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMyPayslip } from '@/lib/services/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SlipRoute = { params: Promise<{ periodKey: string }> };

/** GET /api/v1/app/payslips/:periodKey — phiếu một kỳ, đọc từ bản chụp (US36). */
export const GET = withAuth<SlipRoute>({ kind: 'app' }, async (ctx, _request, route) => {
  const { periodKey } = await route.params;
  if (!periodKeySchema.safeParse(periodKey).success) throw notFound('phiếu lương');
  return ok({ payslip: await getMyPayslip(ctx, periodKey) });
});
