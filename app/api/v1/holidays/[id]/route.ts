import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { deleteHoliday } from '@/lib/services/holidays';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/holidays/:id — xoá một ngày lễ (US08). */
export const DELETE = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) => {
  await deleteHoliday(ctx, await routeId(route, 'ngày lễ'));
  return ok({});
});
