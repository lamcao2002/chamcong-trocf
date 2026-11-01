import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getInbox } from '@/lib/services/inbox';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/inbox?period= — việc cần xử lý và đếm theo loại (US24). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const period = new URL(request.url).searchParams.get('period');
  if (period !== null && !periodKeySchema.safeParse(period).success)
    throw new ApiError(400, 'Kỳ không hợp lệ');
  return ok({ inbox: await getInbox(ctx, period ?? undefined) });
});
