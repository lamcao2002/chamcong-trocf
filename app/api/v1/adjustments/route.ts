import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { HR_UP } from '@/lib/auth/roles';
import { createAdjustment } from '@/lib/services/payroll';
import { adjustmentSchema } from '@/lib/validation/payroll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/adjustments — thêm thưởng/phạt kỳ (US35). */
export const POST = withAuth({ roles: HR_UP }, async (ctx, request) => {
  const adjustment = await createAdjustment(ctx, await parseBody(request, adjustmentSchema));
  return ok({ adjustment }, 201);
});
