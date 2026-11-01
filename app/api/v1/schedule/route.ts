import { ApiError } from '@/lib/api/errors';
import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getSchedule, saveSchedule } from '@/lib/services/schedule';
import { scheduleSaveSchema, weekSchema } from '@/lib/validation/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/schedule?week= — lưới lịch một tuần, `week` là ngày Thứ Hai (US14). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const week = weekSchema.safeParse(new URL(request.url).searchParams.get('week'));
  if (!week.success) throw new ApiError(400, 'Tuần không hợp lệ');
  return ok({ schedule: await getSchedule(ctx, week.data) });
});

/** PUT /api/v1/schedule — lưu danh sách ô thay đổi (US15, US16). */
export const PUT = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  await saveSchedule(ctx, await parseBody(request, scheduleSaveSchema));
  return ok({});
});
