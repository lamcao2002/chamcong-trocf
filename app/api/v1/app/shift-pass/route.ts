import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { myPassableShifts } from '@/lib/services/shift-pass';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/shift-pass — ca của tôi pass được: 14 ngày tới, chưa bắt đầu, chưa có đơn đang chờ. */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok({ shifts: await myPassableShifts(ctx) }));
