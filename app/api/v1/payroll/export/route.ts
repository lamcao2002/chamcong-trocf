import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { payrollWorkbook } from '@/lib/export/payroll';
import { xlsxResponse } from '@/lib/export/xlsx';
import { getPayrollDocument } from '@/lib/services/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/payroll/export?period= — Excel bảng lương; kỳ đã công bố lấy bản chụp (PAY-09). */
export const GET = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const period = new URL(request.url).searchParams.get('period');
  if (period !== null && !periodKeySchema.safeParse(period).success)
    throw new ApiError(400, 'Kỳ không hợp lệ');
  const document = await getPayrollDocument(ctx, period ?? undefined);
  return xlsxResponse(payrollWorkbook(document, ctx.company.name), `bang-luong-${document.period.key}.xlsx`);
});
