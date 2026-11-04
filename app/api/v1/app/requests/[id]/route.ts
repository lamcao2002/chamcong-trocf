import { ok, parseBody, routeId, type IdRoute } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { deleteMyRequest, updateMyRequest } from '@/lib/services/requests';
import { requestSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/v1/app/requests/:id — sửa đơn của mình trong 10 phút đầu, khi còn chờ. */
export const PATCH = withAuth<IdRoute>({ kind: 'app' }, async (ctx, request, route) => {
  const id = await routeId(route, 'đơn');
  return ok({ request: await updateMyRequest(ctx, id, await parseBody(request, requestSchema)) });
});

/** DELETE /api/v1/app/requests/:id — xoá đơn còn chờ; đăng ký ca xoá được trong giờ mở đăng ký. */
export const DELETE = withAuth<IdRoute>({ kind: 'app' }, async (ctx, _request, route) => {
  await deleteMyRequest(ctx, await routeId(route, 'đơn'));
  return ok({});
});
