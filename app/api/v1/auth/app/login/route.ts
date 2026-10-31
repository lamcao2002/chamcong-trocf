import { handleLogin } from '@/lib/auth/login-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/auth/app/login — đăng nhập app nhân viên (US03). */
export function POST(request: Request) {
  return handleLogin('app', request);
}
