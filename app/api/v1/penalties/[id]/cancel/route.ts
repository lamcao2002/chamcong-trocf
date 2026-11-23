import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { cancelPenalty } from '@/lib/services/penalties';
import { penaltyCancelSchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/penalties/:id/cancel — huỷ có lý do; người đã phạt hoặc Quản trị viên. */
export const POST = withAuth<IdRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  const id = await routeId(route, 'phiếu phạt');
  return ok({ penalty: await cancelPenalty(ctx, id, await parseBody(request, penaltyCancelSchema)) });
});
