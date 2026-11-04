import { ok, parseBody } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { MANAGERS } from '@/lib/auth/roles';
import { discardDrafts } from '@/lib/services/schedule-publish';
import { scheduleWeekSchema } from '@/lib/validation/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/schedule/discard — bỏ nháp của một tuần, lịch quay về bản đã công bố. */
export const POST = withAuth({ roles: MANAGERS }, async (ctx, request) =>
  ok({ result: await discardDrafts(ctx, await parseBody(request, scheduleWeekSchema)) }),
);
