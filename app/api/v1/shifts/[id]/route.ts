import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { deleteShift, updateShift } from '@/lib/services/shifts';
import { shiftSchema } from '@/lib/validation/shift';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/shifts/:id — sửa ca (US05). */
export const PATCH = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, request, route) => {
  const id = await routeId(route, 'ca');
  const shift = await updateShift(ctx, id, await parseBody(request, shiftSchema));
  return ok({ shift });
});

/** DELETE /api/v1/shifts/:id — xoá ca. */
export const DELETE = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) => {
  await deleteShift(ctx, await routeId(route, 'ca'));
  return ok({});
});
