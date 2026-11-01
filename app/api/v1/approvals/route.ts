import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { saveApproval } from '@/lib/services/approvals';
import { approvalSchema } from '@/lib/validation/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/approvals — duyệt theo đề xuất hoặc điều chỉnh, gộp vào bản ghi đang có (US25, US26). */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const approval = await saveApproval(ctx, await parseBody(request, approvalSchema));
  return ok({ approval }, 201);
});
