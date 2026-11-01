import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { createRequest, listMyRequests } from '@/lib/services/requests';
import { requestSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/requests — đơn của tôi, phép còn lại (US29, US33). */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok(await listMyRequests(ctx)));

/** POST /api/v1/app/requests — gửi đơn nghỉ phép, quên chấm, làm thêm (US29–US31). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  const created = await createRequest(ctx, await parseBody(request, requestSchema));
  return ok({ request: created }, 201);
});
