import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { getPayroll } from '@/lib/services/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function periodParam(request: Request): string | undefined {
  const period = new URL(request.url).searchParams.get('period');
  if (period === null) return undefined;
  if (!periodKeySchema.safeParse(period).success) throw new ApiError(400, 'Kỳ không hợp lệ');
  return period;
}

/** GET /api/v1/payroll?period= — quỹ lương, trạng thái, danh sách (US34). */
export const GET = withAuth({ roles: HR_UP }, async (ctx, request) =>
  ok({ payroll: await getPayroll(ctx, periodParam(request)) }),
);
