import { vietnamToday } from './date';
import { addDays, atMinute, mondayOf } from '@/lib/engine/time';

/** [Đề xuất] Nhân viên sửa, xoá đơn trong chừng này phút kể từ lúc gửi, khi đơn còn chờ. */
export const REQUEST_EDIT_MINUTES = 10;

/** [Đề xuất] Đăng ký ca tuần sau mở từ 07:00 Thứ Năm tới 07:00 Thứ Bảy, giờ Việt Nam. */
export const REGISTRATION_OPEN = { weekday: 4, minute: 7 * 60 };
export const REGISTRATION_CLOSE = { weekday: 6, minute: 7 * 60 };

const MINUTE_MS = 60_000;

/** Ngày trong tuần bắt đầu từ Thứ Hai: Thứ Năm là +3, Thứ Bảy là +5. */
const fromMonday = (weekday: number) => (weekday + 6) % 7;

export type RegistrationWindow = {
  open: boolean;
  opensAt: Date;
  closesAt: Date;
  /** Thứ Hai của tuần được đăng ký trong đợt này. */
  week: string;
};

/** Đợt đăng ký đang mở, hoặc đợt sắp tới nếu đang đóng. */
export function registrationWindow(now: Date): RegistrationWindow {
  const of = (monday: string) => ({
    opensAt: atMinute(addDays(monday, fromMonday(REGISTRATION_OPEN.weekday)), REGISTRATION_OPEN.minute),
    closesAt: atMinute(addDays(monday, fromMonday(REGISTRATION_CLOSE.weekday)), REGISTRATION_CLOSE.minute),
    week: addDays(monday, 7),
  });
  const thisWeek = mondayOf(vietnamToday(now));
  const current = of(thisWeek);
  const window = now < current.closesAt ? current : of(addDays(thisWeek, 7));
  return { ...window, open: now >= window.opensAt && now < window.closesAt };
}

type EditableRequest = { type: string; status: string; fromDate: string; createdAt: Date };

/**
 * Hạn cuối nhân viên còn sửa, xoá được một đơn; null là đã khoá. Đơn đã được quyết định thì khoá ngay.
 * Đăng ký ca theo đợt mở đăng ký của tuần đó, các đơn khác theo 10 phút từ lúc gửi.
 */
export function editableUntil(
  request: EditableRequest,
  now: Date,
  window: RegistrationWindow = registrationWindow(now),
): Date | null {
  if (request.status !== 'pending') return null;
  if (request.type === 'shift_register') {
    const inWeek = request.fromDate >= window.week && request.fromDate <= addDays(window.week, 6);
    return window.open && inWeek ? window.closesAt : null;
  }
  const until = new Date(request.createdAt.getTime() + REQUEST_EDIT_MINUTES * MINUTE_MS);
  return now < until ? until : null;
}
