import { ok, parseBody, periodParam } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { createPenalty, listPenalties } from '@/lib/services/penalties';
import { penaltySchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/penalties?period= — phiếu phạt của kỳ trong phạm vi quản lý, tổng theo người. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ penalties: await listPenalties(ctx, periodParam(request)) }),
);

/** POST /api/v1/penalties — phạt một người mình quản lý; ghi chú bằng chứng bắt buộc. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const result = await createPenalty(ctx, await parseBody(request, penaltySchema));
  return ok(result, 201);
});
