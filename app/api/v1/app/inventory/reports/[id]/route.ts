import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import {
  deleteMyInventoryReport,
  getMyInventoryReport,
  updateMyInventoryReport,
} from '@/lib/services/inventory';
import { inventoryReportEditSchema } from '@/lib/validation/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/inventory/reports/:id — một lần kiểm kê của tôi. */
export const GET = withAuth<IdRoute>({ kind: 'app' }, async (ctx, _request, route) =>
  ok({ report: await getMyInventoryReport(ctx, await routeId(route, 'báo cáo kiểm kê')) }),
);

/** PATCH /api/v1/app/inventory/reports/:id — sửa số đếm trong 10 phút đầu, khi còn chờ. */
export const PATCH = withAuth<IdRoute>({ kind: 'app' }, async (ctx, request, route) => {
  const id = await routeId(route, 'báo cáo kiểm kê');
  return ok({
    report: await updateMyInventoryReport(ctx, id, await parseBody(request, inventoryReportEditSchema)),
  });
});

/** DELETE /api/v1/app/inventory/reports/:id — xoá trong 10 phút đầu, khi còn chờ; xoá rồi gửi lại được. */
export const DELETE = withAuth<IdRoute>({ kind: 'app' }, async (ctx, _request, route) => {
  await deleteMyInventoryReport(ctx, await routeId(route, 'báo cáo kiểm kê'));
  return ok({});
});
