import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { deleteAdjustment } from '@/lib/services/payroll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/adjustments/:id — xoá thưởng/phạt (US35). */
export const DELETE = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) => {
  await deleteAdjustment(ctx, await routeId(route, 'khoản thưởng/phạt'));
  return ok({});
});
