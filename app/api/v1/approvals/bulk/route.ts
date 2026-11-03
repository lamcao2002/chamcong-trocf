import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { approveSuggested } from '@/lib/services/bulk-approval';
import { bulkApprovalSchema } from '@/lib/validation/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/approvals/bulk — duyệt nhiều việc theo đề xuất; `skipped` là việc đã đổi (INB-08, TS-08). */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ result: await approveSuggested(ctx, await parseBody(request, bulkApprovalSchema)) }, 201),
);
