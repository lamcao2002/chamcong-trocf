import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { markNotificationsRead } from '@/lib/services/notifications';
import { notificationReadSchema } from '@/lib/validation/notification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/app/notifications/read — đánh dấu đã đọc (EMP-17). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  await markNotificationsRead(ctx, await parseBody(request, notificationReadSchema));
  return ok({});
});
