import { handleLogin } from '@/lib/auth/login-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/auth/admin/login — đăng nhập trang quản trị (US01). */
export function POST(request: Request) {
  return handleLogin('admin', request);
}
