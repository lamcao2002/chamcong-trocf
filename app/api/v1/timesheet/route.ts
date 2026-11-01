import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getTimesheet } from '@/lib/services/timesheet';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/timesheet?period= — lưới công kỳ và cột tổng (US27). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const period = new URL(request.url).searchParams.get('period');
  if (period !== null && !periodKeySchema.safeParse(period).success)
    throw new ApiError(400, 'Kỳ không hợp lệ');
  return ok({ timesheet: await getTimesheet(ctx, period ?? undefined) });
});
