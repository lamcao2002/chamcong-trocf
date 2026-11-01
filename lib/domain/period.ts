import { addDays } from '@/lib/engine/time';

export type Period = {
  /** `YYYY-MM` của tháng chứa ngày cuối kỳ, khớp `payroll_periods.period_key`. */
  key: string;
  from: string;
  to: string;
};

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Ngày chốt của một tháng; tháng ngắn hơn `cutoffDay` thì chốt vào ngày cuối tháng. */
function cutoffOf(year: number, month: number, cutoffDay: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(cutoffDay, lastDayOfMonth(year, month)))}`;
}

/** Tháng liền kề, month đếm từ 1. */
function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

function periodEndingIn(year: number, month: number, cutoffDay: number | null): Period {
  const key = `${year}-${pad(month)}`;
  if (cutoffDay === null) {
    return { key, from: `${key}-01`, to: `${key}-${pad(lastDayOfMonth(year, month))}` };
  }
  const [previousYear, previousMonth] = shiftMonth(year, month, -1);
  return {
    key,
    from: addDays(cutoffOf(previousYear, previousMonth, cutoffDay), 1),
    to: cutoffOf(year, month, cutoffDay),
  };
}

/** Kỳ chứa `date`; `cutoffDay` trống là tròn tháng, ngày 25 là kỳ 26 tháng trước – 25 tháng này. */
export function periodOf(date: string, cutoffDay: number | null): Period {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const current = periodEndingIn(year, month, cutoffDay);
  if (date <= current.to) return current;
  const [nextYear, nextMonth] = shiftMonth(year, month, 1);
  return periodEndingIn(nextYear, nextMonth, cutoffDay);
}

export function periodByKey(key: string, cutoffDay: number | null): Period {
  return periodEndingIn(Number(key.slice(0, 4)), Number(key.slice(5, 7)), cutoffDay);
}

export const previousPeriod = ({ from }: Period, cutoffDay: number | null) =>
  periodOf(addDays(from, -1), cutoffDay);

export const nextPeriod = ({ to }: Period, cutoffDay: number | null) => periodOf(addDays(to, 1), cutoffDay);
