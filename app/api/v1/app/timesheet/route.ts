import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMyTimesheet } from '@/lib/services/timesheet';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/timesheet?month= — bảng công một kỳ của tôi (M3). */
export const GET = withAuth({ kind: 'app' }, async (ctx, request) => {
  const month = new URL(request.url).searchParams.get('month');
  if (month !== null && !periodKeySchema.safeParse(month).success)
    throw new ApiError(400, 'Tháng không hợp lệ');
  return ok({ timesheet: await getMyTimesheet(ctx, month ?? undefined) });
});
