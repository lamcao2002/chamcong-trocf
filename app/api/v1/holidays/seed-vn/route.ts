import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok } from '@/lib/api/server';
import { seedVietnamHolidays } from '@/lib/services/holidays';
import { holidayYearSchema } from '@/lib/validation/holiday';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/holidays/seed-vn?year= — thêm ngày lễ Việt Nam cố định của năm (US08). */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const year = holidayYearSchema.safeParse(new URL(request.url).searchParams.get('year'));
  if (!year.success) throw new ApiError(400, 'Năm không hợp lệ');
  return ok({ added: await seedVietnamHolidays(ctx, year.data) });
});
