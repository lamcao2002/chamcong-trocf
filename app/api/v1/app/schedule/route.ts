import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMySchedule } from '@/lib/services/timesheet';
import { weekSchema } from '@/lib/validation/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/schedule?week= — lịch một tuần của tôi, `week` là ngày Thứ Hai (M3). */
export const GET = withAuth({ kind: 'app' }, async (ctx, request) => {
  const week = weekSchema.safeParse(new URL(request.url).searchParams.get('week'));
  if (!week.success) throw new ApiError(400, 'Tuần không hợp lệ');
  return ok({ schedule: await getMySchedule(ctx, week.data) });
});
