import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY, MANAGERS } from '@/lib/auth/roles';
import { createPenaltyRule, listPenaltyRules } from '@/lib/services/penalties';
import { penaltyRuleSchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/penalty-rules — quy định phạt còn dùng. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx) => ok({ rules: await listPenaltyRules(ctx) }));

/** POST /api/v1/penalty-rules — thêm quy định; chỉ Quản trị viên. */
export const POST = withAuth({ roles: ADMIN_ONLY }, async (ctx, request) => {
  const rule = await createPenaltyRule(ctx, await parseBody(request, penaltyRuleSchema));
  return ok({ rule }, 201);
});
