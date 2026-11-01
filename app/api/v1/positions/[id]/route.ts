import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { deletePosition, updatePosition } from '@/lib/services/positions';
import { positionSchema } from '@/lib/validation/position';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/positions/:id — sửa vị trí (US06). */
export const PATCH = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, request, route) => {
  const id = await routeId(route, 'vị trí');
  const position = await updatePosition(ctx, id, await parseBody(request, positionSchema));
  return ok({ position });
});

/** DELETE /api/v1/positions/:id — xoá vị trí. */
export const DELETE = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) => {
  await deletePosition(ctx, await routeId(route, 'vị trí'));
  return ok({});
});
