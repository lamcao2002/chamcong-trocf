import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createPosition, listPositions } from '@/lib/services/positions';
import { positionSchema } from '@/lib/validation/position';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/positions — danh sách vị trí (US06). */
export const GET = withAuth({ roles: HR_UP }, async (ctx) => ok({ positions: await listPositions(ctx) }));

/** POST /api/v1/positions — thêm vị trí. */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const position = await createPosition(ctx, await parseBody(request, positionSchema));
  return ok({ position }, 201);
});
