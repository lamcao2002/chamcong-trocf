import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { dismissIssue } from '@/lib/services/penalties';
import { penaltyIssueSchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/penalty-dismissals — Bỏ qua một lỗi chấm công trong gợi ý phạt. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const dismissal = await dismissIssue(ctx, await parseBody(request, penaltyIssueSchema));
  return ok({ dismissal }, 201);
});
