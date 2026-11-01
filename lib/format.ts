import { weekDay } from '@/lib/engine/time';
import type { DayStatus } from '@/lib/engine/types';

/** Tiền kiểu 1.234.567đ. */
export function formatMoney(amount: number): string {
  return `${formatNumber(amount)}đ`;
}

export function formatNumber(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Ngày ISO yyyy-mm-dd thành dd/mm/yyyy. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  chua_toi: 'Chưa tới',
  dang_lam: 'Đang làm',
  vang: 'Vắng',
  thieu_gio: 'Thiếu giờ',
  sai_ca: 'Sai ca',
  ngoai_vung: 'Ngoài vùng',
  ngoai_lich: 'Ngoài lịch',
  ot_cho: 'OT chờ duyệt',
  muon: 'Muộn/sớm',
  nua_cong: 'Thiếu công',
  du: 'Đủ công',
  nghi_phep: 'Nghỉ phép',
  le: 'Ngày lễ',
  nghi: 'Nghỉ',
};

export function dayStatusLabel(status: DayStatus): string {
  return DAY_STATUS_LABELS[status];
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({ value, label: DAY_LABELS[value]! }));

/** Ngày ISO thành "T2 02/11". */
export function formatDayLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${DAY_LABELS[weekDay(iso)]} ${day}/${month}`;
}

const VIETNAM_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
});

/** Giờ theo Việt Nam, bất kể múi giờ của máy: "06:59". */
export function formatClock(at: Date | string): string {
  return VIETNAM_CLOCK.format(new Date(at));
}

export function formatWorkDays(days: readonly number[]): string {
  if (days.length === 7) return 'Cả tuần';
  return WEEK_DAYS.filter(({ value }) => days.includes(value))
    .map(({ label }) => label)
    .join(', ');
}
