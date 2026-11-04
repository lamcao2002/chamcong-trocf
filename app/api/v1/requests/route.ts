import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { listRequestHistory } from '@/lib/services/request-history';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/requests?period= — lịch sử đơn của một kỳ, mọi trạng thái, người mình quản lý. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const parsed = periodKeySchema.safeParse(new URL(request.url).searchParams.get('period') ?? undefined);
  return ok({ history: await listRequestHistory(ctx, parsed.success ? parsed.data : undefined) });
});
