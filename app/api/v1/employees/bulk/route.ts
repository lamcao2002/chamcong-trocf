import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createEmployeesBulk } from '@/lib/services/employees';
import { employeeBulkSchema } from '@/lib/validation/employee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/employees/bulk — thêm cả lô; `pin` từng người chỉ trả về đúng lần này (STF-10). */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) =>
  ok({ employees: await createEmployeesBulk(ctx, await parseBody(request, employeeBulkSchema)) }, 201),
);
