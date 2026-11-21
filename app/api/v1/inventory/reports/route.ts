import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { listInventoryReports } from '@/lib/services/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/inventory/reports — báo cáo kiểm kê chờ duyệt và đã xử lý gần đây. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx) =>
  ok({ reports: await listInventoryReports(ctx) }),
);
