import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { createInventoryItem, listInventory } from '@/lib/services/inventory';
import { inventoryItemSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/inventory/items — danh mục món, các phiếu kiểm kê và vị trí. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx) => ok(await listInventory(ctx)));

/** POST /api/v1/inventory/items — thêm một món vào danh mục. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const item = await createInventoryItem(ctx, await parseBody(request, inventoryItemSchema));
  return ok({ item }, 201);
});
