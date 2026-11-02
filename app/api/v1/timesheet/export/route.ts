import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { timesheetWorkbook } from '@/lib/export/timesheet';
import { xlsxResponse } from '@/lib/export/xlsx';
import { getTimesheet } from '@/lib/services/timesheet';
import { readTimesheetQuery } from '@/lib/validation/timesheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/timesheet/export — Excel theo đúng khoảng và phạm vi người đang xem trên lưới (TS-09). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const timesheet = await getTimesheet(ctx, readTimesheetQuery(request));
  return xlsxResponse(
    timesheetWorkbook(timesheet, ctx.company.name),
    `bang-cong-${timesheet.period.key}.xlsx`,
  );
});
