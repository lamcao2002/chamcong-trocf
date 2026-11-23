import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY } from '@/lib/auth/roles';
import { deletePenaltyRule, updatePenaltyRule } from '@/lib/services/penalties';
import { penaltyRuleSchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/penalty-rules/:id — sửa quy định; phiếu đã phạt giữ số cũ. */
export const PATCH = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, request, route) => {
  const id = await routeId(route, 'quy định');
  return ok({ rule: await updatePenaltyRule(ctx, id, await parseBody(request, penaltyRuleSchema)) });
});

/** DELETE /api/v1/penalty-rules/:id — đã có phiếu phạt thì lưu trữ, chưa thì xoá hẳn. */
export const DELETE = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, _request, route) =>
  ok(await deletePenaltyRule(ctx, await routeId(route, 'quy định'))),
);
