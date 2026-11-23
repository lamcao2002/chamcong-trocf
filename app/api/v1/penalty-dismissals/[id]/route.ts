import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { restoreIssue } from '@/lib/services/penalties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/penalty-dismissals/:id — Khôi phục lỗi đã bỏ qua về gợi ý phạt. */
export const DELETE = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, _request, route) => {
  const id = await routeId(route, 'lỗi đã bỏ qua');
  return ok(await restoreIssue(ctx, id));
});
