const MINUTE_MS = 60_000;
/** Việt Nam không đổi giờ theo mùa nên cố định UTC+7, không cần thư viện múi giờ. */
const VIETNAM_OFFSET_MS = 7 * 60 * MINUTE_MS;
const DAY_MINUTES = 24 * 60;

function dayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - VIETNAM_OFFSET_MS;
}

/** Số phút tính từ 00:00 của `date`; âm là hôm trước, từ 1440 là hôm sau. Bỏ phần giây. */
export function minuteOfDay(at: Date, date: string): number {
  return Math.floor((at.getTime() - dayStartMs(date)) / MINUTE_MS);
}

export function atMinute(date: string, minute: number): Date {
  return new Date(dayStartMs(date) + minute * MINUTE_MS);
}

/** 0 = Chủ nhật, 6 = Thứ Bảy, khớp `work_days`. */
export function weekDay(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** "23:38"; phút vượt qua nửa đêm quay về đầu ngày. */
export function clock(minute: number): string {
  const wrapped = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const minutes = String(wrapped % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** "1 giờ 38", "45 phút", "2 giờ". */
export function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest}`;
}
