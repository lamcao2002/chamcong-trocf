import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMyInventory, submitInventoryReport } from '@/lib/services/inventory';
import { inventoryReportSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/inventory — danh sách kiểm kê của ca đang làm, hoặc báo cáo đã gửi trong ca. */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok({ inventory: await getMyInventory(ctx) }));

/** POST /api/v1/app/inventory — gửi số đếm của ca đang làm; số lệch phải có lý do. */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  const report = await submitInventoryReport(ctx, await parseBody(request, inventoryReportSchema));
  return ok({ report }, 201);
});
