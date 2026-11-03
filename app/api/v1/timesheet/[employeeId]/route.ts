import { notFound } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getEmployeeTimesheet } from '@/lib/services/timesheet';
import { uuid } from '@/lib/validation/common';
import { readTimesheetQuery } from '@/lib/validation/timesheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EmployeeRoute = { params: Promise<{ employeeId: string }> };

/** GET /api/v1/timesheet/:employeeId?period= — bảng công một người (US28). */
export const GET = withAuth<EmployeeRoute>({ roles: MANAGERS }, async (ctx, request, route) => {
  const { employeeId } = await route.params;
  if (!uuid.safeParse(employeeId).success) throw notFound('nhân viên');
  return ok({ timesheet: await getEmployeeTimesheet(ctx, employeeId, readTimesheetQuery(request)) });
});
