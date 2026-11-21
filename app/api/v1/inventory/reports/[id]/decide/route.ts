import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { decideInventoryReport } from '@/lib/services/inventory';
import { decisionSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/inventory/reports/:id/decide — duyệt thì số đếm thành số hiện có, từ chối thì giữ số cũ. */
export const POST = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  const id = await routeId(route, 'báo cáo kiểm kê');
  await decideInventoryReport(ctx, id, await parseBody(request, decisionSchema));
  return ok({});
});
