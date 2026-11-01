import { z } from 'zod';
import { notFound } from '@/lib/api/errors';
import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { getDayDetail } from '@/lib/services/day';
import { isoDate, uuid } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DayRoute = { params: Promise<{ employeeId: string; date: string }> };

const paramsSchema = z.object({ employeeId: uuid, date: isoDate });

/** GET /api/v1/day/:employeeId/:date — lần chấm và ngày công hệ thống tính (US22, US28). */
export const GET = withAuth<DayRoute>({ roles: MANAGERS }, async (ctx, _request, route) => {
  const params = paramsSchema.safeParse(await route.params);
  if (!params.success) throw notFound('ngày công');
  return ok({ day: await getDayDetail(ctx, params.data.employeeId, params.data.date) });
});
