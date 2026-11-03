import { ApiError, notFound } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { getPayStatement } from '@/lib/services/payroll';
import { uuid } from '@/lib/validation/common';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EmployeeRoute = { params: Promise<{ employeeId: string }> };

function periodParam(request: Request): string | undefined {
  const period = new URL(request.url).searchParams.get('period');
  if (period === null) return undefined;
  if (!periodKeySchema.safeParse(period).success) throw new ApiError(400, 'Kỳ không hợp lệ');
  return period;
}

/** GET /api/v1/payroll/:employeeId?period= — sao kê một người (US34). */
export const GET = withAuth<EmployeeRoute>({ roles: HR_UP }, async (ctx, request, route) => {
  const { employeeId } = await route.params;
  if (!uuid.safeParse(employeeId).success) throw notFound('nhân viên');
  return ok({ statement: await getPayStatement(ctx, employeeId, periodParam(request)) });
});
