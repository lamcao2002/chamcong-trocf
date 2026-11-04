import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { publishSchedule } from '@/lib/services/schedule-publish';
import { scheduleWeekSchema } from '@/lib/validation/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/schedule/publish — công bố nháp của một tuần, người mình quản lý. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ result: await publishSchedule(ctx, await parseBody(request, scheduleWeekSchema)) }),
);
