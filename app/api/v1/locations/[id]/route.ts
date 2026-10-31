import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY } from '@/lib/auth/roles';
import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { deleteLocation, updateLocation } from '@/lib/services/locations';
import { locationSchema } from '@/lib/validation/location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/locations/:id — sửa địa điểm (US07). */
export const PATCH = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, request, route) => {
  const id = await routeId(route, 'địa điểm');
  const location = await updateLocation(ctx, id, await parseBody(request, locationSchema));
  return ok({ location });
});

/** DELETE /api/v1/locations/:id — xoá địa điểm. */
export const DELETE = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, _request, route) => {
  await deleteLocation(ctx, await routeId(route, 'địa điểm'));
  return ok({});
});
