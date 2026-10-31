import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/login';
import { SESSION_POLICY } from '@/lib/auth/session-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/auth/logout — xoá cả hai phiên trên máy này (US04); chưa đăng nhập cũng trả ok. */
export async function POST() {
  const store = await cookies();
  const response = NextResponse.json({ ok: true });
  for (const { cookie } of Object.values(SESSION_POLICY)) {
    const token = store.get(cookie)?.value;
    if (!token) continue;
    await logout(token);
    response.cookies.delete(cookie);
  }
  return response;
}
