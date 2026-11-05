import { describe, expect, it } from 'vitest';
import { computePay, type PayDay, type PayProfile, type PayResult } from './compute-pay';

/** Bộ ca kiểm thử lương P01–P24 của docs/product/07-sprint-4.md; mỗi dòng một test. */

const RATES = { weekday: 150, saturday: null, offday: 200, holiday: 300 };
const WEDNESDAY = '2026-10-07';
const PV = 'phuc-vu';
const SATURDAY = '2026-10-10';

const day = (fields: Partial<PayDay> = {}): PayDay => ({
  date: WEDNESDAY,
  cong: 0,
  workedMin: 0,
  offDay: false,
  isHoliday: false,
  otProposed: 0,
  otApproved: 0,
  otState: 'none',
  payFactor: 1,
  lateMin: 0,
  waivedLate: false,
  earlyMin: 0,
  waivedEarly: false,
  missing: 0,
  stdHours: 7.5,
  ...fields,
});

const month = (payAmount: number): PayProfile => ({
  payType: 'month',
  payAmount,
  stdDays: 26,
  otRates: RATES,
});
const hour = (payAmount: number): PayProfile => ({ payType: 'hour', payAmount, stdDays: 26, otRates: RATES });
const unit = (payAmount: number): PayProfile => ({ payType: 'unit', payAmount, stdDays: 26, otRates: RATES });

const worked = (cong: number) => day({ cong });
const pending = (minutes: number) => day({ otProposed: minutes, otState: 'cho_duyet' });

type Case = { id: string; title: string; check: () => void };

const pay = (
  profile: PayProfile,
  days: PayDay[],
  adjustments: Parameters<typeof computePay>[0]['adjustments'] = [],
): PayResult => computePay({ profile, days, adjustments });

const P02_DAYS = [worked(26), day({ otProposed: 90, otApproved: 90, otState: 'da_duyet' })];

const CASES: Case[] = [
  {
    id: 'P01',
    title: 'lương tháng đủ công',
    check: () => {
      const result = pay({ ...month(11_000_000) }, [worked(26)]);
      expect(result.net).toBe(11_000_000);
      expect(result.lines[0]!.how).toBe('11.000.000đ ÷ 26 công chuẩn × 26 công');
    },
  },
  {
    id: 'P02',
    title: 'lương tháng cộng OT đã duyệt',
    check: () => {
      const result = pay(month(10_000_000), P02_DAYS);
      expect(result.net).toBe(10_115_385);
      expect(result.lines[1]).toMatchObject({
        amount: 115_385,
        how: '07/10: 90p × 51.282đ/giờ × 150% (ngày thường)',
      });
    },
  },
  {
    id: 'P03',
    title: 'OT chờ không vào thực lĩnh, có dự phóng',
    check: () => {
      const result = pay(month(10_000_000), [...P02_DAYS, pending(98), pending(100), pending(96)]);
      expect(result.net).toBe(10_115_385);
      expect(result.pendingOt).toMatchObject({ minutes: 294, amount: 376_923 });
      expect(result.projectedNet).toBe(10_492_308);
    },
  },
  {
    id: 'P04',
    title: 'lương giờ: giờ chuẩn của ca × công, không theo phút chấm',
    check: () => {
      const result = pay(hour(25_000), [day({ cong: 1, workedMin: 431 }), day({ cong: 1, workedMin: 452 })]);
      expect(result.net).toBe(375_000);
      expect(result.lines[0]!.how).toBe('2 ca · 15 giờ × 25.000đ');
    },
  },
  {
    id: 'P05',
    title: 'lương công',
    check: () => expect(pay(unit(60_000), [worked(27)]).net).toBe(1_620_000),
  },
  {
    id: 'P06',
    title: 'thưởng và phạt',
    check: () => {
      const result = pay(
        month(11_000_000),
        [worked(26)],
        [
          { kind: 'bonus', amount: 500_000, note: 'Doanh số' },
          { kind: 'penalty', amount: 200_000, note: 'Làm vỡ ly' },
        ],
      );
      expect(result.net).toBe(11_300_000);
      expect(result.lines.map(({ amount }) => amount)).toEqual([11_000_000, 500_000, -200_000]);
    },
  },
  {
    id: 'P07',
    title: 'thiếu công',
    check: () => expect(pay(month(7_000_000), [worked(25.5)]).net).toBe(6_865_385),
  },
  {
    id: 'P08',
    title: 'ngày nghỉ tuần của lương giờ chỉ trả qua OT, không nhân %',
    check: () => {
      const offDay = day({
        offDay: true,
        workedMin: 240,
        otProposed: 240,
        otApproved: 240,
        otState: 'da_duyet',
        stdHours: null,
      });
      const result = pay(hour(25_000), [offDay]);
      expect(result.net).toBe(100_000);
      expect(result.lines[0]).toMatchObject({ key: 'base', amount: 0 });
    },
  },
  {
    id: 'P09',
    title: 'ngày lễ đi làm: lương ngày cộng OT 300%',
    check: () => {
      const holiday = day({
        cong: 1,
        isHoliday: true,
        otProposed: 450,
        otApproved: 450,
        otState: 'da_duyet',
      });
      const result = pay(month(10_000_000), [holiday]);
      expect(result.lines.map(({ amount }) => amount)).toEqual([384_615, 1_153_846]);
    },
  },
  {
    id: 'P10',
    title: 'Thứ Bảy nghỉ để trống hệ số thì dùng hệ số ngày thường',
    check: () => {
      const saturday = day({
        date: SATURDAY,
        offDay: true,
        otProposed: 60,
        otApproved: 60,
        otState: 'da_duyet',
        stdHours: null,
      });
      expect(pay(month(10_400_000), [saturday]).lines[1]!.how).toContain('× 150% (ngày nghỉ)');
    },
  },
  {
    id: 'P11',
    title: 'ghi đè lương thắng vị trí',
    check: () => expect(pay(hour(27_000), [day({ cong: 1, workedMin: 60 })]).net).toBe(202_500),
  },
  {
    id: 'P12',
    title: 'thực lĩnh âm được giữ nguyên',
    check: () => {
      const result = pay(
        unit(60_000),
        [worked(1)],
        [{ kind: 'penalty', amount: 100_000, note: 'Thiếu quỹ' }],
      );
      expect(result.net).toBe(-40_000);
    },
  },
  {
    id: 'P13',
    title: 'không có ngày công vẫn có kết quả',
    check: () => expect(pay(month(10_000_000), []).net).toBe(0),
  },
  {
    id: 'P14',
    title: 'thực lĩnh bằng đúng tổng các dòng đã làm tròn',
    check: () => {
      const days = [
        worked(25.5),
        ...[33, 47, 71].map((minutes) =>
          day({ otProposed: minutes, otApproved: minutes, otState: 'da_duyet' }),
        ),
      ];
      const result = pay(month(7_000_000), days);
      expect(result.lines.every(({ amount }) => Number.isInteger(amount))).toBe(true);
      expect(result.net).toBe(result.lines.reduce((total, { amount }) => total + amount, 0));
    },
  },
  {
    id: 'P15',
    title: 'lương giờ: phép năm có trả, nghỉ ốm không',
    check: () => {
      const result = pay(hour(25_000), [day({ cong: 1 }), day({ cong: 0 })]);
      expect(result.lines).toEqual([
        { key: 'base', name: 'Lương theo giờ', amount: 187_500, how: '1 ca · 7,5 giờ × 25.000đ' },
      ]);
    },
  },
  {
    id: 'P16',
    title: 'lương giờ: ngày lễ không đi làm',
    check: () =>
      expect(pay(hour(25_000), [day({ cong: 1, isHoliday: true, stdHours: 8 })]).net).toBe(200_000),
  },
  {
    id: 'P17',
    title: 'lương tháng không có trần ở công chuẩn',
    check: () => expect(pay(month(10_000_000), [worked(28)]).net).toBe(10_769_231),
  },
  {
    id: 'P18',
    title: 'lương giờ: thiếu giờ được duyệt 1 công vẫn có tiền',
    check: () => expect(pay(hour(25_000), [day({ cong: 1, missing: 1, stdHours: 5 })]).net).toBe(125_000),
  },
  {
    id: 'P19',
    title: 'nhiều vị trí: mỗi ca theo mức của vị trí đã xếp',
    check: () => {
      const result = computePay({
        profile: hour(25_000),
        days: [day({ cong: 1, workedMin: 600 }), day({ cong: 1, workedMin: 300, roleId: PV })],
        adjustments: [],
        roles: { [PV]: { ...hour(22_000), payType: 'hour', name: 'Phục vụ' } },
      });
      expect(result.lines.map(({ key, amount }) => [key, amount])).toEqual([
        ['base', 187_500],
        [`base_${PV}`, 165_000],
      ]);
      expect(result.lines[1]!.name).toBe('Lương theo giờ · Phục vụ');
      expect(result.net).toBe(352_500);
    },
  },
  {
    id: 'P20',
    title: 'nhiều vị trí: OT của ca vị trí phụ theo đơn giá của vị trí đó',
    check: () => {
      const ot = day({
        cong: 1,
        workedMin: 300,
        otProposed: 60,
        otApproved: 60,
        otState: 'da_duyet',
        roleId: PV,
      });
      const result = computePay({
        profile: hour(25_000),
        days: [ot],
        adjustments: [],
        roles: {
          [PV]: { ...hour(20_000), payType: 'hour', name: 'Phục vụ', otRates: { ...RATES, weekday: 200 } },
        },
      });
      expect(result.lines.map(({ key }) => key)).toEqual([`base_${PV}`, `ot_${WEDNESDAY}`]);
      expect(result.lines.map(({ amount }) => amount)).toEqual([150_000, 20_000]);
    },
  },
  {
    id: 'P21',
    title: 'nhiều vị trí: vị trí chính lương tháng thì một mức chung',
    check: () => {
      const result = computePay({
        profile: month(10_400_000),
        days: [worked(1), day({ cong: 1, roleId: PV })],
        adjustments: [],
        roles: { [PV]: { ...hour(22_000), payType: 'hour', name: 'Phục vụ' } },
      });
      expect(result.lines).toHaveLength(1);
      expect(result.net).toBe(800_000);
    },
  },
  {
    id: 'P22',
    title: 'lương giờ: hệ số của ca nhân cả giờ ca và OT',
    check: () => {
      const shift = day({
        cong: 1,
        stdHours: 4,
        otProposed: 60,
        otApproved: 60,
        otState: 'da_duyet',
        payFactor: 1.5,
      });
      const result = pay(hour(25_000), [day({ cong: 1, stdHours: 4 }), shift]);
      expect(result.lines).toEqual([
        { key: 'base', name: 'Lương theo giờ', amount: 100_000, how: '1 ca · 4 giờ × 25.000đ' },
        {
          key: `base_factor_${WEDNESDAY}_0`,
          name: 'Ca hệ số 1,5',
          amount: 150_000,
          how: '07/10: 4 giờ × 25.000đ × 1,5',
        },
        {
          key: `ot_${WEDNESDAY}`,
          name: 'Tăng ca đã duyệt',
          amount: 37_500,
          how: '07/10: 60p × 25.000đ/giờ × hệ số 1,5',
        },
      ]);
      expect(result.dayAmounts).toEqual([100_000, 187_500]);
    },
  },
  {
    id: 'P23',
    title: 'lương giờ: OT ngày lễ không nhân %',
    check: () => {
      const holiday = day({
        cong: 1,
        isHoliday: true,
        stdHours: 8,
        otProposed: 120,
        otApproved: 120,
        otState: 'da_duyet',
      });
      expect(pay(hour(25_000), [holiday]).net).toBe(250_000);
    },
  },
  {
    id: 'P24',
    title: 'hệ số chỉ áp cho lương giờ',
    check: () => {
      expect(pay(month(11_000_000), [day({ cong: 26, payFactor: 2 })]).net).toBe(11_000_000);
      expect(pay(unit(60_000), [day({ cong: 1, payFactor: 2 })]).dayAmounts).toEqual([null]);
    },
  },
];

describe('bộ ca kiểm thử lương', () => {
  it('có đủ P01–P24', () => {
    const expected = Array.from({ length: 24 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`);
    expect(CASES.map(({ id }) => id)).toEqual(expected);
  });

  for (const { id, title, check } of CASES) it(`${id} ${title}`, check);
});

describe('ngoài bộ ca kiểm thử', () => {
  it('dòng không gắn ca dùng 8 giờ chuẩn', () => {
    const offDay = day({ offDay: true, stdHours: null, otProposed: 60, otApproved: 60, otState: 'da_duyet' });
    expect(pay(month(10_000_000), [offDay]).lines[1]!.amount).toBe(Math.round((10_000_000 / 26 / 8) * 2));
  });

  it('lương công quy đổi OT theo giờ chuẩn ca', () => {
    const shift = day({ cong: 1, stdHours: 2, otProposed: 60, otApproved: 60, otState: 'da_duyet' });
    expect(pay(unit(60_000), [shift]).lines[1]!.amount).toBe(45_000);
  });

  it('OT đã duyệt một phần: phần chờ chỉ tính phần còn lại', () => {
    const partial = day({ otProposed: 98, otApproved: 60, otState: 'cho_duyet' });
    expect(pay(hour(20_000), [partial]).pendingOt.minutes).toBe(38);
  });

  it('muộn đã tha không tính vào tổng', () => {
    const days = [day({ lateMin: 14, waivedLate: true }), day({ lateMin: 7 })];
    expect(pay(hour(20_000), days).summary.lateMin).toBe(7);
  });
});
