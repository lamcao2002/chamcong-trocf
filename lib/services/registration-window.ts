import 'server-only';
import { vietnamToday } from '@/lib/domain/date';
import { registrationWindow, type RegistrationWindow } from '@/lib/domain/request-window';
import { addDays, mondayOf } from '@/lib/engine/time';
import { getServerEnv } from '@/lib/env';

/**
 * Đợt đăng ký ca lúc này. Test API chạy ở giờ bất kỳ nên máy local đặt `REGISTRATION_ALWAYS_OPEN=1`
 * để đợt luôn mở cho tuần sau; staging và production luôn theo giờ thật.
 */
export function currentRegistrationWindow(now: Date = new Date()): RegistrationWindow {
  const env = getServerEnv();
  if (env.APP_ENV !== 'local' || env.REGISTRATION_ALWAYS_OPEN !== '1') return registrationWindow(now);
  const week = addDays(mondayOf(vietnamToday(now)), 7);
  return { open: true, opensAt: now, closesAt: new Date(`${week}T00:00:00+07:00`), week };
}
