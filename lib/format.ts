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

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({ value, label: DAY_LABELS[value]! }));

export function formatWorkDays(days: readonly number[]): string {
  if (days.length === 7) return 'Cả tuần';
  return WEEK_DAYS.filter(({ value }) => days.includes(value))
    .map(({ label }) => label)
    .join(', ');
}
