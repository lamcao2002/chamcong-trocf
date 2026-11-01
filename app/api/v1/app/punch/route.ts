import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { punch } from '@/lib/services/attendance';
import { punchSchema } from '@/lib/validation/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/app/punch — chấm vào/ra; giờ và trong/ngoài vùng tính ở server (US18, US19). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  const result = await punch(ctx, await parseBody(request, punchSchema));
  return ok({ result }, 201);
});
