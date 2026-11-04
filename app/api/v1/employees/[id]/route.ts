import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY, HR_UP } from '@/lib/auth/roles';
import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { deleteEmployee, getEmployee, updateEmployee } from '@/lib/services/employees';
import { employeeDeleteSchema, employeePatchSchema } from '@/lib/validation/employee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/employees/:id — hồ sơ, không có PIN (US12). */
export const GET = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, _request, route) =>
  ok({ employee: await getEmployee(ctx, await routeId(route, 'nhân viên')) }),
);

/** PATCH /api/v1/employees/:id — sửa hồ sơ, ghi đè riêng, chuyển Đã nghỉ (US12, US13). */
export const PATCH = withAuth<IdRoute>({ roles: HR_UP }, async (ctx, request, route) => {
  const id = await routeId(route, 'nhân viên');
  await updateEmployee(ctx, id, await parseBody(request, employeePatchSchema));
  return ok({ employee: await getEmployee(ctx, id) });
});

/** DELETE /api/v1/employees/:id — xoá hẳn nhân viên và dữ liệu của người đó; chỉ Quản trị viên. */
export const DELETE = withAuth<IdRoute>({ roles: ADMIN_ONLY }, async (ctx, request, route) => {
  await deleteEmployee(
    ctx,
    await routeId(route, 'nhân viên'),
    await parseBody(request, employeeDeleteSchema),
  );
  return ok({});
});
