import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { listMyInventoryReports } from '@/lib/services/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/inventory/reports — các lần kiểm kê gần đây của tôi. */
export const GET = withAuth({ kind: 'app' }, async (ctx) =>
  ok({ reports: await listMyInventoryReports(ctx) }),
);
