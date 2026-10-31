import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/db/client';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/health — kiểm tra app và kết nối CSDL (dùng sau mỗi lần triển khai). */
export async function GET() {
  let appEnv = 'unknown';
  try {
    appEnv = getServerEnv().APP_ENV;
  } catch (error) {
    return NextResponse.json(
      { ok: false, db: 'not_configured', error: error instanceof Error ? error.message : 'Env lỗi' },
      { status: 500 },
    );
  }

  const db = await pingDb();
  return NextResponse.json(
    {
      ok: db.ok,
      env: appEnv,
      db: db.ok ? 'up' : 'down',
      dbLatencyMs: db.latencyMs,
      time: new Date().toISOString(),
    },
    { status: db.ok ? 200 : 503 },
  );
}
