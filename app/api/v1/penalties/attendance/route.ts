import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { attendanceOfDay } from '@/lib/services/penalties';
import { penaltyDaySchema } from '@/lib/validation/penalty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/penalties/attendance?employeeId=&date= — chấm công một ngày làm bằng chứng phạt. */
export const GET = withAuth({ roles: MANAGERS }, async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const day = penaltyDaySchema.safeParse({ employeeId: params.get('employeeId'), date: params.get('date') });
  if (!day.success) throw new ApiError(400, 'Ngày hoặc nhân viên không hợp lệ');
  return ok({ shifts: await attendanceOfDay(ctx, day.data.employeeId, day.data.date) });
});
