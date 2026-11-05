import { formatMoney } from '@/lib/format';

type PayType = 'month' | 'hour' | 'unit';

export const PAY_LABELS: Record<PayType, string> = {
  month: 'Lương tháng',
  hour: 'Lương giờ',
  unit: 'Lương công',
};

const PAY_UNITS: Record<PayType, string> = { month: 'tháng', hour: 'giờ', unit: 'công' };

/** "Lương giờ 25.000đ/giờ". */
export const payRate = (payType: PayType, amount: number) =>
  `${PAY_LABELS[payType]} ${formatMoney(amount)}/${PAY_UNITS[payType]}`;

/** Khoá kỳ `YYYY-MM` thành "Tháng 10/2026". */
export const periodTitle = (key: string) => `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** Phút thành "4g43", tròn giờ là "5g". */
export function hoursMinutes(minutes: number): string {
  // Giờ OT âm (trừ giờ) ghi dấu trừ ở đầu: "−1g30"
  const sign = minutes < 0 ? '−' : '';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  if (hours === 0) return `${sign}${rest}p`;
  return rest === 0 ? `${sign}${hours}g` : `${sign}${hours}g${String(rest).padStart(2, '0')}`;
}
