import 'server-only';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { loginSchema } from '@/lib/validation/auth';
import { login } from './login';
import { SESSION_POLICY, sessionCookieOptions, type SessionKind } from './session-policy';

const INVALID_CREDENTIALS = 'Thông tin đăng nhập không đúng';
const NO_ADMIN_ACCESS = 'Tài khoản này không có quyền vào trang quản trị';

/** Xử lý chung POST /auth/admin/login và /auth/app/login. Lỗi không nói rõ trường nào sai (US01). */
export async function handleLogin(kind: SessionKind, request: Request): Promise<NextResponse> {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: INVALID_CREDENTIALS }, { status: 401 });

  try {
    const result = await login(kind, parsed.data);
    if (!result.ok) {
      return result.reason === 'no_admin_access'
        ? NextResponse.json({ ok: false, error: NO_ADMIN_ACCESS }, { status: 403 })
        : NextResponse.json({ ok: false, error: INVALID_CREDENTIALS }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user: result.user, company: result.company });
    response.cookies.set(
      SESSION_POLICY[kind].cookie,
      result.token,
      sessionCookieOptions(kind, getServerEnv().NODE_ENV === 'production'),
    );
    return response;
  } catch (error) {
    console.error('Đăng nhập lỗi:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'Không đăng nhập được, vui lòng thử lại' }, { status: 500 });
  }
}
