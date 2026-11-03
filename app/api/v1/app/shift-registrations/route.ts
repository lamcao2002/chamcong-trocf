import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { getMyRegistration, saveRegistration } from '@/lib/services/registrations';
import { registrationSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/shift-registrations — lưới đăng ký ca tuần sau (EMP-12). */
export const GET = withAuth({ kind: 'app' }, async (ctx) =>
  ok({ registration: await getMyRegistration(ctx) }),
);

/** POST /api/v1/app/shift-registrations — gửi đăng ký; mỗi ô là một đơn riêng (EMP-12). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) =>
  ok({ result: await saveRegistration(ctx, await parseBody(request, registrationSchema)) }, 201),
);
