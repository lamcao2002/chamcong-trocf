import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { recomputeRecentDays } from '@/lib/services/recompute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/internal/recompute — Vercel Cron gọi 00:30 giờ Việt Nam, gửi kèm `CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Không có quyền' }, { status: 401 });
  }
  const result = await recomputeRecentDays();
  return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 500 : 200 });
}
