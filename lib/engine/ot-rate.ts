import { weekDay } from './time';
import type { OtRates } from './types';

const SATURDAY = 6;

type OtDay = { date: string; isHoliday: boolean; offDay: boolean };

/** Hệ số OT (%) của một ngày; `day_records` không lưu hệ số nên Lương cũng suy lại bằng hàm này. */
export function otRateOf({ date, isHoliday, offDay }: OtDay, rates: OtRates): number {
  if (isHoliday) return rates.holiday;
  if (!offDay) return rates.weekday;
  return weekDay(date) === SATURDAY ? (rates.saturday ?? rates.weekday) : rates.offday;
}
