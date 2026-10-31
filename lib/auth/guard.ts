import 'server-only';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { ADMIN_NAV, type AdminNavKey } from '@/lib/navigation/admin';
import { hasRole, type AuthContext } from './policy';
import type { Role } from './roles';
import { getSession } from './session';
import type { SessionKind } from './session-policy';

const ADMIN_LOGIN_PATH = '/app/login';
const ADMIN_HOME_PATH = '/app';

type AuthOptions = {
  /** Mặc định `admin`; các route `/app/*` của nhân viên truyền `app`. */
  kind?: SessionKind;
  /** Bỏ trống: ai có phiên hợp lệ cũng dùng được. */
  roles?: readonly Role[];
};

/**
 * Bọc route handler: 401 khi không có phiên, 403 khi sai quyền. Company lấy từ `ctx`, không bao
 * giờ từ tham số request. Next.js truyền `params` qua `route`.
 */
export function withAuth<Route>(
  { kind = 'admin', roles }: AuthOptions,
  handler: (ctx: AuthContext, request: Request, route: Route) => Promise<Response>,
) {
  return async (request: Request, route: Route): Promise<Response> => {
    const ctx = await getSession(kind);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
    }
    if (roles && !hasRole(ctx.employee.role, roles)) {
      return NextResponse.json(
        { ok: false, error: 'Bạn không có quyền thực hiện việc này' },
        { status: 403 },
      );
    }
    return handler(ctx, request, route);
  };
}

/**
 * Chặn một trang quản trị theo cấu hình menu. Gọi ở từng page chứ không ở layout, vì layout không
 * chạy lại khi chuyển trang phía client.
 */
export async function requireAdminPage(key?: AdminNavKey): Promise<AuthContext> {
  const ctx = await getSession('admin');
  if (!ctx) redirect(ADMIN_LOGIN_PATH);

  const item = ADMIN_NAV.find((entry) => entry.key === key);
  if (item && !hasRole(ctx.employee.role, item.roles)) redirect(ADMIN_HOME_PATH);
  return ctx;
}
