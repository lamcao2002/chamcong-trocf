import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, routeId, type IdRoute } from '@/lib/api/server';
import { resetEmployeePin } from '@/lib/services/employees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/employees/:id/reset-pin — tạo PIN mới, trả về đúng một lần (US12). */
export const POST = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) =>
  ok({ pin: await resetEmployeePin(ctx, await routeId(route, 'nhân viên')) }),
);
