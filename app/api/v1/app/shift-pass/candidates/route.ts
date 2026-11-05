import { ApiError } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { passCandidates } from '@/lib/services/shift-pass';
import { passSlotSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/shift-pass/candidates?date=&shiftId= — người nhận được một ca của tôi. */
export const GET = withAuth({ kind: 'app' }, async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const slot = passSlotSchema.safeParse({ date: params.get('date'), shiftId: params.get('shiftId') });
  if (!slot.success) throw new ApiError(400, 'Ca không hợp lệ');
  return ok({ candidates: await passCandidates(ctx, slot.data.date, slot.data.shiftId) });
});
