import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { respondPass } from '@/lib/services/shift-pass';
import { passResponseSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/app/requests/:id/respond — người được pass ca đồng ý (lịch đổi ngay) hoặc từ chối. */
export const POST = withAuth<IdRoute>({ kind: 'app' }, async (ctx, request, route) => {
  const id = await routeId(route, 'đơn');
  return ok({ request: await respondPass(ctx, id, await parseBody(request, passResponseSchema)) });
});
