import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { saveExplanation } from '@/lib/services/requests';
import { explanationSchema } from '@/lib/validation/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/app/explanations — gửi giải trình cho một ngày (US32). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  const explanation = await saveExplanation(ctx, await parseBody(request, explanationSchema));
  return ok({ explanation }, 201);
});
