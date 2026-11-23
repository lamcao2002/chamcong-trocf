import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { deleteInventorySheet, updateInventorySheet } from '@/lib/services/inventory';
import { inventorySheetSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/inventory/sheets/:id — đổi tên, vị trí, thêm bớt món của phiếu. */
export const PATCH = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  const id = await routeId(route, 'phiếu kiểm kê');
  return ok({ sheet: await updateInventorySheet(ctx, id, await parseBody(request, inventorySheetSchema)) });
});

/** DELETE /api/v1/inventory/sheets/:id — xoá phiếu; báo cáo đã gửi giữ tên phiếu. */
export const DELETE = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, _request, route) => {
  await deleteInventorySheet(ctx, await routeId(route, 'phiếu kiểm kê'));
  return ok({});
});
