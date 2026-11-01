import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { publishPayroll } from '@/lib/services/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function periodParam(request: Request): string | undefined {
  const period = new URL(request.url).searchParams.get('period');
  if (period === null) return undefined;
  if (!periodKeySchema.safeParse(period).success) throw new ApiError(400, 'Kỳ không hợp lệ');
  return period;
}

/** POST /api/v1/payroll/publish?period= — công bố, tạo bản chụp phiếu (US36). */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) =>
  ok({ published: await publishPayroll(ctx, periodParam(request)) }, 201),
);
