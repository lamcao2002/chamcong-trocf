import type { DayStatus } from '@/lib/engine/types';
import { addDays } from '@/lib/engine/time';
import { formatClock } from '@/lib/format';
import { nextPeriod, periodByKey, periodOf, previousPeriod, type Period } from './period';

/** Trần của khoảng Tự chọn: lưới hai tháng còn đọc được, dài hơn thì nặng mà không ai xem hết. */
export const MAX_RANGE_DAYS = 62;
/** Ngày bắt đầu gợi ý cho Kỳ lệch khi công ty tính lương tròn tháng. */
const DEFAULT_SHIFTED_START = 26;

export type TimesheetQuery = {
  period?: string;
  /** Kỳ lệch: ngày bắt đầu kỳ, chỉ đổi khoảng xem, không đổi kỳ lương. */
  start?: number;
  from?: string;
  to?: string;
  view?: 'week';
  /** Ngày đầu của tuần đang xem. */
  week?: string;
};

export type RangeMode = 'payroll' | 'shifted' | 'custom';

const dayIndex = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

export const rangeDays = (from: string, to: string) => dayIndex(to) - dayIndex(from) + 1;

/** Ngày bắt đầu kỳ tương ứng ngày chốt: chốt 25 là bắt đầu 26, tròn tháng là ngày 1. */
const startOf = (cutoffDay: number | null) => (cutoffDay === null ? 1 : (cutoffDay % 31) + 1);

/** Kỳ lương giữ nguyên theo Cài đặt; hai chế độ còn lại chỉ là khoảng xem của Bảng công. */
export function resolveRange(query: TimesheetQuery, companyCutoff: number | null, today: string) {
  const companyStart = startOf(companyCutoff);
  const suggestedStart = companyCutoff === null ? DEFAULT_SHIFTED_START : companyStart;

  if (query.from && query.to) {
    const period: Period = { key: `${query.from}_${query.to}`, from: query.from, to: query.to };
    return {
      mode: 'custom' as RangeMode,
      period,
      previousKey: null,
      nextKey: null,
      start: null,
      suggestedStart,
      isPayrollRange: false,
    };
  }

  const shifted = query.start !== undefined;
  const cutoffDay = shifted ? (query.start === 1 ? null : query.start! - 1) : companyCutoff;
  const period = query.period ? periodByKey(query.period, cutoffDay) : periodOf(today, cutoffDay);
  const next = nextPeriod(period, cutoffDay);
  return {
    mode: (shifted ? 'shifted' : 'payroll') as RangeMode,
    period,
    previousKey: previousPeriod(period, cutoffDay).key,
    nextKey: next.from <= today ? next.key : null,
    start: query.start ?? null,
    suggestedStart,
    isPayrollRange: !shifted || query.start === companyStart,
  };
}

/** Tuần bắt đầu thứ Hai, hai đầu cắt theo khoảng đang xem. */
export function weeksIn(from: string, to: string) {
  const weeks: { from: string; to: string }[] = [];
  let start = from;
  while (start <= to) {
    const weekday = new Date(`${start}T00:00:00Z`).getUTCDay();
    const sunday = addDays(start, (7 - weekday) % 7);
    const end = sunday < to ? sunday : to;
    weeks.push({ from: start, to: end });
    start = addDays(end, 1);
  }
  return weeks;
}

/** Tuần được yêu cầu nếu có; không thì tuần chứa hôm nay; kỳ đã qua thì tuần đầu. */
export function pickWeek(
  weeks: readonly { from: string; to: string }[],
  wanted: string | undefined,
  today: string,
) {
  return (
    weeks.find(({ from }) => from === wanted) ??
    weeks.find(({ from, to }) => from <= today && today <= to) ??
    weeks[0]!
  );
}

type WeekRow = {
  status: DayStatus;
  inAt: Date | null;
  outAt: Date | null;
  cong: number;
  lateMin: number;
  earlyMin: number;
  otProposed: number;
};

const STATUS_TEXT: Partial<Record<DayStatus, string>> = {
  chua_toi: 'Chưa tới',
  vang: 'vắng',
  thieu_gio: 'thiếu giờ vào/ra',
  sai_ca: 'sai ca',
  ngoai_vung: 'ngoài vùng',
  ngoai_lich: 'ngoài lịch',
  nghi_phep: 'nghỉ phép',
  le: 'nghỉ lễ',
  nghi: 'nghỉ',
};

/** Trạng thái chữ thay cho giờ khi có điều cần chú ý; bình thường hiện giờ vào–ra. */
export function weekCellText({ status, inAt, outAt, cong, lateMin, earlyMin, otProposed }: WeekRow): string {
  if (status === 'dang_lam') return `${inAt ? formatClock(inAt) : '--:--'} · đang làm`;
  if (status === 'muon') {
    const late = lateMin > 0 ? `muộn ${lateMin}p` : `sớm ${earlyMin}p`;
    return `${late} · ${cong}c`;
  }
  if (status === 'ot_cho') return `sau ca ${otProposed}p`;
  const text = STATUS_TEXT[status];
  if (text) return text;
  return inAt && outAt ? `${formatClock(inAt)}–${formatClock(outAt)}` : `${cong}c`;
}

/** Tham số URL của Bảng công, dùng chung cho link, API, Excel và drawer một người. */
export function timesheetSearch(query: TimesheetQuery): string {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}
