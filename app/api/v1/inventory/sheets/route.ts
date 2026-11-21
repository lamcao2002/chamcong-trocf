import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { createInventorySheet } from '@/lib/services/inventory';
import { inventorySheetSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/inventory/sheets — tạo phiếu kiểm kê: tên, vị trí dùng phiếu, món lấy từ danh mục. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const sheet = await createInventorySheet(ctx, await parseBody(request, inventorySheetSchema));
  return ok({ sheet }, 201);
});
