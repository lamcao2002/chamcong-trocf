import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createShift, listShifts } from '@/lib/services/shifts';
import { shiftSchema } from '@/lib/validation/shift';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/shifts — danh sách ca (US05). */
export const GET = withAuth({ roles: HR_UP }, async (ctx) => ok({ shifts: await listShifts(ctx) }));

/** POST /api/v1/shifts — thêm ca. */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const shift = await createShift(ctx, await parseBody(request, shiftSchema));
  return ok({ shift }, 201);
});
