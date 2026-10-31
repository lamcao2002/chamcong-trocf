import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createEmployee, listEmployees } from '@/lib/services/employees';
import { employeeCreateSchema } from '@/lib/validation/employee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filterSchema = z.object({
  status: z.enum(['active', 'left']).optional(),
  positionId: z.string().uuid().optional(),
});

/** GET /api/v1/employees?status=&positionId= — danh sách nhân viên (US11). */
export const GET = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const filters = filterSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!filters.success) throw new ApiError(400, 'Bộ lọc không hợp lệ');
  return ok({ employees: await listEmployees(ctx, filters.data) });
});

/** POST /api/v1/employees — thêm nhân viên; `pin` chỉ trả về đúng lần này. */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const employee = await createEmployee(ctx, await parseBody(request, employeeCreateSchema));
  return ok({ employee }, 201);
});
