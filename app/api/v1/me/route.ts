import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/guard';
import { canSeePay, type AuthContext } from '@/lib/auth/policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function me({ employee, company }: AuthContext) {
  return NextResponse.json({
    ok: true,
    user: employee,
    company: {
      code: company.code,
      name: company.name,
      appName: company.appName,
      brandColor: company.brandColor,
    },
    permissions: { canSeePay: canSeePay(employee.role) },
  });
}

const adminMe = withAuth({ kind: 'admin' }, me);
const appMe = withAuth({ kind: 'app' }, me);

/** GET /api/v1/me — người dùng, công ty, quyền (US02). App nhân viên gọi với `?kind=app`. */
export function GET(request: Request, route: unknown) {
  const kind = new URL(request.url).searchParams.get('kind');
  return (kind === 'app' ? appMe : adminMe)(request, route);
}
