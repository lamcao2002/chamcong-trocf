import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { timesheetWorkbook } from '@/lib/export/timesheet';
import { xlsxResponse } from '@/lib/export/xlsx';
import { getTimesheet } from '@/lib/services/timesheet';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/timesheet/export?period= — Excel bảng công, cùng phạm vi người với lưới (TS-09). */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const period = new URL(request.url).searchParams.get('period');
  if (period !== null && !periodKeySchema.safeParse(period).success)
    throw new ApiError(400, 'Kỳ không hợp lệ');
  const timesheet = await getTimesheet(ctx, period ?? undefined);
  return xlsxResponse(
    timesheetWorkbook(timesheet, ctx.company.name),
    `bang-cong-${timesheet.period.key}.xlsx`,
  );
});
