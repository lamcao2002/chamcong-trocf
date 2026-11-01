import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createHoliday, listHolidays } from '@/lib/services/holidays';
import { holidaySchema } from '@/lib/validation/holiday';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/holidays — danh sách ngày lễ (US08). */
export const GET = withAuth({ roles: HR_UP }, async (ctx) => ok({ holidays: await listHolidays(ctx) }));

/** POST /api/v1/holidays — thêm một ngày lễ. */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const holiday = await createHoliday(ctx, await parseBody(request, holidaySchema));
  return ok({ holiday }, 201);
});
