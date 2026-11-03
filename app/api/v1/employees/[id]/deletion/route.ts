import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY } from '@/lib/auth/roles';
import { deletionImpact } from '@/lib/services/employees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/employees/:id/deletion — số dữ liệu sẽ mất nếu xoá, cho hộp cảnh báo. */
export const GET = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, _request, route) =>
  ok({ impact: await deletionImpact(ctx, await routeId(route, 'nhân viên')) }),
);
