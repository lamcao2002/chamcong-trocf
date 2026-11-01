import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { revokeApproval } from '@/lib/services/approvals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/approvals/:id — hoàn duyệt (US28). */
export const DELETE = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, _request, route) => {
  await revokeApproval(ctx, await routeId(route, 'bản ghi duyệt'));
  return ok({});
});
