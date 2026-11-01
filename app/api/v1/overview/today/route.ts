import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getInbox, getOverview } from '@/lib/services/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/overview/today — 4 thẻ số hôm nay (US23). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx) => {
  const { total } = await getInbox(ctx);
  return ok({ overview: await getOverview(ctx, total) });
});
