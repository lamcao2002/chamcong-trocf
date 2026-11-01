const VIETNAM_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

/** Ngày hiện tại theo giờ Việt Nam (`YYYY-MM-DD`), bất kể múi giờ của máy chủ. */
export function vietnamToday(now: Date = new Date()): string {
  return VIETNAM_DAY.format(now);
}
