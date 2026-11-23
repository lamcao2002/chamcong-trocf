import { ok, periodParam } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMyPenalties } from '@/lib/services/penalties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/penalties?period= — sẹo, tiền phạt và các phiếu phạt của chính mình trong kỳ. */
export const GET = withAuth({ kind: 'app' }, async (ctx, request) =>
  ok({ penalties: await getMyPenalties(ctx, periodParam(request)) }),
);
