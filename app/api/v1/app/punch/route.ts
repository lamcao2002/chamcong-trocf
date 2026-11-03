import { cookies } from 'next/headers';
import { ok, parseBody } from '@/lib/api/server';
import { DEVICE_COOKIE, deviceCookieOptions } from '@/lib/auth/device';
import { withAuth } from '@/lib/auth/guard';
import { getServerEnv } from '@/lib/env';
import { punch } from '@/lib/services/attendance';
import { checkPunchDevice } from '@/lib/services/device';
import { punchSchema } from '@/lib/validation/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/app/punch — chấm vào/ra; giờ và trong/ngoài vùng tính ở server (US18, US19). */
export const POST = withAuth({ kind: 'app' }, async (ctx, request) => {
  const input = await parseBody(request, punchSchema);
  const device = await checkPunchDevice(ctx, (await cookies()).get(DEVICE_COOKIE)?.value);
  const result = await punch(ctx, input, device);

  const response = ok({ result }, 201);
  if (device) {
    const secure = getServerEnv().NODE_ENV === 'production';
    response.cookies.set(DEVICE_COOKIE, device.token, deviceCookieOptions(secure));
  }
  return response;
});
