import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { decideRequest } from '@/lib/services/requests';
import { decisionSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/requests/:id/decide — duyệt hoặc từ chối đơn (US33). */
export const POST = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  await decideRequest(ctx, await routeId(route, 'đơn'), await parseBody(request, decisionSchema));
  return ok({});
});
