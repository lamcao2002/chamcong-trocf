import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getTimesheet } from '@/lib/services/timesheet';
import { readTimesheetQuery } from '@/lib/validation/timesheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/timesheet?period=&start=&from=&to=&view=&week= — lưới công, kỳ lệch, tự chọn, theo tuần (US27). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ timesheet: await getTimesheet(ctx, readTimesheetQuery(request)) }),
);
