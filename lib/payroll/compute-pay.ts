import { otRateOf } from '@/lib/engine/ot-rate';
import type { DayRecord, OtRates } from '@/lib/engine/types';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';

/** Dòng ngày nghỉ tuần không gắn ca và người không có ca cố định: chưa có giờ chuẩn nào để dùng (D3). */
const DEFAULT_STD_HOURS = 8;
const ROUND_HOURS = 100;

export type PayProfile = {
  payType: 'month' | 'hour' | 'unit';
  payAmount: number;
  stdDays: number;
  otRates: OtRates;
};

/** Mức lương của một vị trí phụ, chỉ trả theo giờ hoặc theo công. */
export type RoleProfile = PayProfile & { payType: 'hour' | 'unit'; name: string };

export type PayDay = Pick<
  DayRecord,
  | 'date'
  | 'cong'
  | 'workedMin'
  | 'offDay'
  | 'isHoliday'
  | 'otProposed'
  | 'otApproved'
  | 'otState'
  | 'lateMin'
  | 'waivedLate'
  | 'earlyMin'
  | 'waivedEarly'
  | 'missing'
> & {
  /** Giờ chuẩn của ca trên dòng; NULL thì dùng mặc định. */
  stdHours: number | null;
  /** Vị trí phụ của ca trên dòng; trống là vị trí chính. */
  roleId?: string | null;
};

export type PayAdjustment = { kind: 'bonus' | 'penalty'; amount: number; note: string };

export type PayLine = { key: string; name: string; amount: number; how: string };

export type PayResult = {
  lines: PayLine[];
  /** Tổng các dòng đã làm tròn, nên sao kê, quỹ lương và phiếu luôn khớp (D1). */
  net: number;
  pendingOt: { minutes: number; amount: number; days: { date: string; minutes: number }[] };
  projectedNet: number;
  summary: {
    cong: number;
    workedMin: number;
    lateMin: number;
    earlyMin: number;
    missing: number;
    otApprovedMin: number;
    otPendingMin: number;
  };
};

/** Gom các dòng theo cột của bảng lương; tổng các nhóm luôn bằng thực lĩnh. */
export function splitPayLines(lines: readonly PayLine[]) {
  const pick = (test: (line: PayLine) => boolean) => sum(lines.filter(test), ({ amount }) => amount);
  const manual = ({ key }: PayLine) => key.startsWith('adjustment_');
  return {
    base: pick(({ key }) => key === 'base' || key.startsWith('base_')),
    paidLeave: pick(({ key }) => key.startsWith('paid_leave')),
    ot: pick(({ key }) => key.startsWith('ot_')),
    bonus: pick((line) => manual(line) && line.amount > 0),
    penalty: pick((line) => manual(line) && line.amount < 0),
  };
}

export type PayInput = {
  profile: PayProfile;
  days: readonly PayDay[];
  adjustments: readonly PayAdjustment[];
  /**
   * Vị trí phụ theo mã, cho người làm nhiều vị trí: ca nào tính theo mức của vị trí đã xếp cho ca đó.
   * Lương tháng luôn một mức chung, nên bỏ qua khi vị trí chính trả theo tháng.
   */
  roles?: Readonly<Record<string, RoleProfile>>;
};

const stdHoursOf = ({ stdHours }: PayDay) => stdHours ?? DEFAULT_STD_HOURS;

/** Đơn giá một giờ để tính OT: lương tháng và lương công quy đổi theo giờ chuẩn của ca (D2, D4). */
function hourlyRate({ payType, payAmount, stdDays }: PayProfile, stdHours: number): number {
  if (payType === 'hour') return payAmount;
  return payType === 'month' ? payAmount / stdDays / stdHours : payAmount / stdHours;
}

const sum = <T>(items: readonly T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const round2 = (value: number) => Math.round(value * ROUND_HOURS) / ROUND_HOURS;

const shortDate = (date: string) => formatDate(date).slice(0, 5);

function baseLines(profile: PayProfile, days: readonly PayDay[]): PayLine[] {
  const { payType, payAmount, stdDays } = profile;
  const cong = round2(sum(days, (day) => day.cong));

  if (payType === 'month') {
    const how = `${formatMoney(payAmount)} ÷ ${stdDays} công chuẩn × ${formatDecimal(cong)} công`;
    return [{ key: 'base', name: 'Lương theo công', amount: Math.round((payAmount / stdDays) * cong), how }];
  }
  if (payType === 'unit') {
    const how = `${formatMoney(payAmount)} × ${formatDecimal(cong)} công`;
    return [{ key: 'base', name: 'Lương theo công', amount: Math.round(payAmount * cong), how }];
  }

  // Ngày nghỉ tuần chỉ trả qua OT đã duyệt, cộng vào đây là trả hai lần (D5)
  const workedMin = sum(
    days.filter(({ offDay }) => !offDay),
    (day) => day.workedMin,
  );
  const hours = round2(workedMin / 60);
  const lines: PayLine[] = [
    {
      key: 'base',
      name: 'Lương theo giờ',
      amount: Math.round((workedMin / 60) * payAmount),
      how: `${formatDecimal(hours)} giờ × ${formatMoney(payAmount)}`,
    },
  ];

  // Ngày có công mà không có phút làm: phép năm, lễ, thiếu giờ được duyệt (Q3)
  const paidDays = days.filter(({ workedMin: minutes, cong: value }) => minutes === 0 && value > 0);
  if (paidDays.length > 0) {
    const paidHours = sum(paidDays, (day) => day.cong * stdHoursOf(day));
    lines.push({
      key: 'paid_leave',
      name: 'Nghỉ có lương, công được duyệt',
      amount: Math.round(paidHours * payAmount),
      how: `${formatDecimal(round2(paidHours))} giờ × ${formatMoney(payAmount)}`,
    });
  }
  return lines;
}

function otPrice(profile: PayProfile, day: PayDay, minutes: number) {
  const rate = hourlyRate(profile, stdHoursOf(day));
  const percent = otRateOf(day, profile.otRates);
  return { rate, percent, amount: Math.round((minutes / 60) * rate * (percent / 100)) };
}

const dayKindLabel = ({ isHoliday, offDay }: PayDay) =>
  isHoliday ? 'ngày lễ' : offDay ? 'ngày nghỉ' : 'ngày thường';

/** Đổi tên và khoá của dòng lương cơ bản cho một vị trí phụ, để sao kê ghi rõ từng vị trí. */
function roleLines(lines: PayLine[], roleId: string, name: string): PayLine[] {
  return lines.map((line) => ({ ...line, key: `${line.key}_${roleId}`, name: `${line.name} · ${name}` }));
}

/** Tiền lương một kỳ: hàm thuần, mỗi dòng có công thức chữ để giải thích "Vì sao ra số này" (US34). */
export function computePay({ profile, days, adjustments, roles = {} }: PayInput): PayResult {
  const roleOf = ({ roleId }: PayDay) =>
    profile.payType !== 'month' && roleId && roles[roleId] ? roleId : null;
  const profileOf = (day: PayDay): PayProfile => {
    const roleId = roleOf(day);
    return roleId ? roles[roleId]! : profile;
  };
  const used = [...new Set(days.map(roleOf).filter((id): id is string => id !== null))];
  const primaryDays = days.filter((day) => roleOf(day) === null);
  const base = [
    // Cả kỳ chỉ làm vị trí phụ thì không in dòng 0đ của vị trí chính
    ...(primaryDays.length > 0 || used.length === 0 ? baseLines(profile, primaryDays) : []),
    ...used.flatMap((roleId) =>
      roleLines(
        baseLines(
          roles[roleId]!,
          days.filter((day) => roleOf(day) === roleId),
        ),
        roleId,
        roles[roleId]!.name,
      ),
    ),
  ];

  const otLines = days
    .filter(({ otApproved }) => otApproved > 0)
    .map((day): PayLine => {
      const { rate, percent, amount } = otPrice(profileOf(day), day, day.otApproved);
      return {
        key: `ot_${day.date}`,
        name: 'Tăng ca đã duyệt',
        amount,
        how: `${shortDate(day.date)}: ${day.otApproved}p × ${formatMoney(Math.round(rate))}/giờ × ${percent}% (${dayKindLabel(day)})`,
      };
    });
  const adjustmentLines = adjustments.map(({ kind, amount, note }, index): PayLine => {
    const bonus = kind === 'bonus';
    return {
      key: `adjustment_${index}`,
      name: bonus ? 'Thưởng' : 'Phạt',
      amount: bonus ? amount : -amount,
      how: note,
    };
  });

  const lines = [...base, ...otLines, ...adjustmentLines];
  const net = sum(lines, ({ amount }) => amount);

  const pendingDays = days
    .filter(({ otState }) => otState === 'cho_duyet')
    .map((day) => ({ day, minutes: day.otProposed - day.otApproved }));
  const pendingAmount = sum(pendingDays, ({ day, minutes }) => otPrice(profileOf(day), day, minutes).amount);
  const otPendingMin = sum(pendingDays, ({ minutes }) => minutes);

  return {
    lines,
    net,
    pendingOt: {
      minutes: otPendingMin,
      amount: pendingAmount,
      days: pendingDays.map(({ day, minutes }) => ({ date: day.date, minutes })),
    },
    projectedNet: net + pendingAmount,
    summary: {
      cong: round2(sum(days, (day) => day.cong)),
      workedMin: sum(days, (day) => day.workedMin),
      lateMin: sum(days, (day) => (day.waivedLate ? 0 : day.lateMin)),
      earlyMin: sum(days, (day) => (day.waivedEarly ? 0 : day.earlyMin)),
      missing: sum(days, (day) => day.missing),
      otApprovedMin: sum(days, (day) => day.otApproved),
      otPendingMin,
    },
  };
}
