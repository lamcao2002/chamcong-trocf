import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { listMyNotifications } from '@/lib/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/notifications — 50 thông báo gần nhất và số chưa đọc (EMP-17). */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok(await listMyNotifications(ctx)));
