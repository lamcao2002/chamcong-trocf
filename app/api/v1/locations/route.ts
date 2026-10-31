import { withAuth } from '@/lib/auth/guard';
import { ADMIN_ONLY } from '@/lib/auth/roles';
import { ok, parseBody } from '@/lib/api/server';
import { createLocation, listLocations } from '@/lib/services/locations';
import { locationSchema } from '@/lib/validation/location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/locations — danh sách địa điểm (US07). */
export const GET = withAuth({ roles: ADMIN_ONLY }, async (ctx) =>
  ok({ locations: await listLocations(ctx) }),
);

/** POST /api/v1/locations — thêm địa điểm. */
export const POST = withAuth({ roles: ADMIN_ONLY }, async (ctx, request) => {
  const location = await createLocation(ctx, await parseBody(request, locationSchema));
  return ok({ location }, 201);
});
