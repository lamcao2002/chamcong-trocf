import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getInventoryReport } from '@/lib/services/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/inventory/reports/:id — từng dòng của một lần kiểm kê. */
export const GET = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, _request, route) =>
  ok({ report: await getInventoryReport(ctx, await routeId(route, 'báo cáo kiểm kê')) }),
);
