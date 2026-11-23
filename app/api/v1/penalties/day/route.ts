import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { penaltiesOfDay } from '@/lib/services/penalties';
import { penaltyDaySchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/penalties/day?employeeId=&date= — phiếu phạt một ngày và quy định, cho Bảng công. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const day = penaltyDaySchema.safeParse({ employeeId: params.get('employeeId'), date: params.get('date') });
  if (!day.success) throw new ApiError(400, 'Ngày hoặc nhân viên không hợp lệ');
  return ok(await penaltiesOfDay(ctx, day.data.employeeId, day.data.date));
});
