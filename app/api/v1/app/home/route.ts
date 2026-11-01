import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getAppHome } from '@/lib/services/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/home — ca hôm nay, ca được chọn, địa điểm, trạng thái (US17, US20). */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok({ home: await getAppHome(ctx) }));
