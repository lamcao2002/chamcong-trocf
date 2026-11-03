import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { unlockDevice } from '@/lib/services/device';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/employees/:id/unlock-device — gỡ điện thoại đã gắn (SH-28). */
export const POST = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) => {
  await unlockDevice(ctx, await routeId(route, 'nhân viên'));
  return ok({});
});
