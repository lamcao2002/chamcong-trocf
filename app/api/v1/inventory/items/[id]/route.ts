import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { deleteInventoryItem, updateInventoryItem } from '@/lib/services/inventory';
import { inventoryItemSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/inventory/items/:id — sửa loại, tên, đơn vị, số hiện có, ghi chú của một món. */
export const PATCH = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  const id = await routeId(route, 'món kiểm kê');
  return ok({ item: await updateInventoryItem(ctx, id, await parseBody(request, inventoryItemSchema)) });
});

/** DELETE /api/v1/inventory/items/:id — xoá món khỏi danh mục và mọi phiếu; báo cáo cũ vẫn giữ tên món. */
export const DELETE = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, _request, route) => {
  await deleteInventoryItem(ctx, await routeId(route, 'món kiểm kê'));
  return ok({});
});
