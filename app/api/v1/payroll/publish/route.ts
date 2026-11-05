import { ApiError } from '@/lib/api/errors';
import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY, HR_UP } from '@/lib/auth/roles';
import { publishPayroll, unpublishPayroll } from '@/lib/services/payroll';
import { publishPickSchema } from '@/lib/validation/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function periodParam(request: Request): string | undefined {
  const period = new URL(request.url).searchParams.get('period');
  if (period === null) return undefined;
  if (!periodKeySchema.safeParse(period).success) throw new ApiError(400, 'Kỳ không hợp lệ');
  return period;
}

/** Body `{ employeeIds }` để chọn người; không có body là cả kỳ. */
async function pickedIds(request: Request): Promise<string[] | undefined> {
  if (!(await request.clone().text()).trim()) return undefined;
  return (await parseBody(request, publishPickSchema))?.employeeIds;
}

/** POST /api/v1/payroll/publish?period= — công bố cả kỳ hoặc người đã chọn, tạo bản chụp phiếu (US36). */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) =>
  ok({ published: await publishPayroll(ctx, periodParam(request), await pickedIds(request)) }, 201),
);

/** DELETE /api/v1/payroll/publish?period= — huỷ công bố cả kỳ hoặc người đã chọn; chỉ Quản trị viên. */
export const DELETE = withAuth({ roles: ADMIN_ONLY }, async (ctx, request) =>
  ok({ unpublished: await unpublishPayroll(ctx, periodParam(request), await pickedIds(request)) }),
);
