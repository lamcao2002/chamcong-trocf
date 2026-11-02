import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { decideRegistrations } from '@/lib/services/registrations';
import { registrationDecisionSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/schedule/registrations — nhận hoặc từ chối nhiều đăng ký; nhận là ghi vào lịch (SCH-12). */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ result: await decideRegistrations(ctx, await parseBody(request, registrationDecisionSchema)) }),
);
