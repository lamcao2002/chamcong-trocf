import { describe, expect, it } from 'vitest';
import { computeDay } from './compute-day';
import type { DayInput, DayRecord, EngineApproval, EnginePunch, EngineShift } from './types';

/** Bộ ca kiểm thử T01–T59 của docs/product/02-dac-ta-engine-ngay-cong.md; mỗi dòng một test. */

const DATE = '2026-10-07'; // Thứ Tư
const NEXT_DATE = '2026-10-08';

const blockShift = (fields: Partial<EngineShift> & Pick<EngineShift, 'code' | 'name'>): EngineShift => ({
  id: fields.code,
  startTime: '06:00',
  endTime: '14:00',
  breakStart: null,
  breakEnd: null,
  calc: 'block',
  stdHours: 7.5,
  minFull: 420,
  minHalf: 210,
  graceMin: 5,
  minOt: null,
  isPart: false,
  noLateCheck: false,
  ...fields,
});

const partShift = (code: string, name: string, startTime: string, endTime: string) =>
  blockShift({ code, name, startTime, endTime, stdHours: 5, minFull: 270, minHalf: 150, isPart: true });

const CA1 = blockShift({ code: 'CA1', name: 'Ca 1', breakStart: '10:00', breakEnd: '10:30' });
const CA2 = blockShift({
  code: 'CA2',
  name: 'Ca 2',
  startTime: '14:00',
  endTime: '22:00',
  breakStart: '18:00',
  breakEnd: '18:30',
});
const SANG = partShift('SANG', 'Ca sáng', '07:00', '12:00');
const CHIEU = partShift('CHIEU', 'Ca chiều', '12:00', '17:00');
const TOI = partShift('TOI', 'Ca tối', '17:00', '22:00');
const TV2 = blockShift({
  code: 'TV2',
  name: 'Tạp vụ',
  endTime: '08:00',
  stdHours: 2,
  minFull: 90,
  minHalf: 45,
  graceMin: 0,
  noLateCheck: true,
});
const DEM = blockShift({ code: 'DEM', name: 'Ca đêm', startTime: '22:00', endTime: '06:00', stdHours: 8 });
const LH = blockShift({
  code: 'LH',
  name: 'Linh hoạt',
  startTime: '08:00',
  endTime: '18:00',
  stdHours: 8,
  calc: 'actual',
});
const LH_STRICT = { ...LH, code: 'LHS', id: 'LHS', calc: 'actual_strict' as const };

const LIBRARY = [CA1, CA2, SANG, CHIEU, TOI, TV2, DEM, LH, LH_STRICT];

const time = (clock: string, date = DATE) => new Date(`${date}T${clock}:00+07:00`);

const punch = (type: EnginePunch['type'], clock: string, extra: Partial<EnginePunch> = {}): EnginePunch => ({
  at: time(clock),
  type,
  chosenShiftId: null,
  inZone: true,
  ...extra,
});
const pair = (inClock: string, outClock: string) => [punch('in', inClock), punch('out', outClock)];

const input = (fields: Partial<DayInput> = {}): DayInput => ({
  date: DATE,
  employee: {
    onboardDate: '2026-01-01',
    leftDate: null,
    shiftMode: 'flexible',
    fixedShiftId: null,
    workDays: [0, 1, 2, 3, 4, 5, 6],
  },
  company: { graceMode: 'toan_bo', otBefore: false, otMin: 30, otFromRequest: false },
  shifts: LIBRARY,
  schedule: null,
  previousDayShifts: [],
  isHoliday: false,
  punches: [],
  otRates: { weekday: 150, saturday: null, offday: 200, holiday: 300 },
  penaltyPerMin: 0,
  requests: [],
  explanations: [],
  approvals: [],
  ...fields,
});

const onShift = (
  shifts: EngineShift | EngineShift[],
  punches: EnginePunch[],
  fields: Partial<DayInput> = {},
) =>
  input({
    schedule: { shiftIds: [shifts].flat().map(({ id }) => id), isOff: false },
    punches,
    ...fields,
  });

const fixed = (shift: EngineShift, punches: EnginePunch[], fields: Partial<DayInput> = {}) =>
  input({
    employee: { ...input().employee, shiftMode: 'fixed', fixedShiftId: shift.id },
    punches,
    ...fields,
  });

const approval = (fields: Partial<EngineApproval>): EngineApproval => ({
  shiftId: CA1.id,
  congOverride: null,
  otMinutes: null,
  approveMissing: false,
  waiveLate: false,
  waiveEarly: false,
  confirmShiftId: null,
  approveGps: false,
  ...fields,
});

const offCell = { shiftIds: [], isOff: true };
const AFTER_WINDOW = new Date('2026-10-09T12:00:00+07:00');

type Case = {
  id: string;
  title: string;
  input: DayInput;
  now?: Date;
  check: (records: DayRecord[]) => void;
};

const only = (records: DayRecord[]) => {
  expect(records).toHaveLength(1);
  return records[0]!;
};
const expectOne = (expected: Partial<DayRecord>) => (records: DayRecord[]) =>
  expect(only(records)).toMatchObject(expected);
const label = (record: DayRecord | undefined) => record?.suggestions[0]?.label;

const T10 = onShift(CA2, pair('13:59', '23:38'));
const T17 = onShift(SANG, [punch('in', '06:59')]);
const T19 = onShift(CA1, []);
const T03 = onShift(CA1, pair('06:14', '14:00'));
const annualLeave = { type: 'leave', leaveType: 'annual' } as const;

const CASES: Case[] = [
  {
    id: 'T01',
    title: 'đúng giờ',
    input: onShift(CA1, pair('05:59', '14:05')),
    check: expectOne({ status: 'du', workedMin: 450, cong: 1, lateMin: 0, otProposed: 0 }),
  },
  {
    id: 'T02',
    title: 'muộn trong mức cho phép',
    input: onShift(CA1, pair('06:04', '14:00')),
    check: expectOne({ status: 'du', lateMin: 0, workedMin: 446, cong: 1 }),
  },
  {
    id: 'T03',
    title: 'muộn, tính cả số phút',
    input: T03,
    check: expectOne({ status: 'muon', lateMin: 14, workedMin: 436, cong: 1 }),
  },
  {
    id: 'T04',
    title: 'muộn, chỉ tính phần vượt',
    input: { ...T03, company: { ...T03.company, graceMode: 'phan_vuot' } },
    check: expectOne({ lateMin: 9, cong: 1 }),
  },
  {
    id: 'T05',
    title: 'về sớm',
    input: onShift(CA1, pair('06:00', '13:50')),
    check: expectOne({ earlyMin: 10, workedMin: 440, cong: 1 }),
  },
  {
    id: 'T06',
    title: 'nửa công',
    input: onShift(CA1, pair('07:00', '14:00')),
    check: expectOne({ lateMin: 60, workedMin: 390, cong: 0.5 }),
  },
  {
    id: 'T07',
    title: 'không công, không cần duyệt',
    input: onShift(CA1, pair('06:00', '09:00')),
    check: expectOne({ earlyMin: 300, workedMin: 180, cong: 0, needsReview: false }),
  },
  {
    id: 'T08',
    title: 'đến sớm, OT trước ca tắt',
    input: onShift(CA1, pair('05:30', '14:00')),
    check: expectOne({ workedMin: 450, otProposed: 0 }),
  },
  {
    id: 'T09',
    title: 'OT trước ca bật',
    input: onShift(CA1, pair('05:20', '14:00'), {
      company: { ...input().company, otBefore: true },
    }),
    check: expectOne({ status: 'ot_cho', otProposed: 40 }),
  },
  {
    id: 'T10',
    title: 'OT sau ca',
    input: T10,
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'ot_cho', otProposed: 98, workedMin: 450, cong: 1 });
      expect(label(records[0])).toBe('Duyệt 98 phút');
      expect(records[0]!.suggestions[0]!.why).toBe(
        'Ra ca lúc 23:38, sau giờ hết ca (22:00) 1 giờ 38 — vượt mức tối thiểu tính OT',
      );
    },
  },
  {
    id: 'T11',
    title: 'dưới OT tối thiểu',
    input: onShift(TV2, pair('05:59', '08:07')),
    check: expectOne({ status: 'du', workedMin: 120, otProposed: 0 }),
  },
  {
    id: 'T12',
    title: 'dưới OT tối thiểu một phút',
    input: onShift(CA2, pair('14:00', '22:29')),
    check: expectOne({ otProposed: 0 }),
  },
  {
    id: 'T13',
    title: 'đúng ngưỡng OT',
    input: onShift(CA2, pair('14:00', '22:30')),
    check: expectOne({ status: 'ot_cho', otProposed: 30 }),
  },
  {
    id: 'T14',
    title: 'duyệt OT khác đề xuất',
    input: { ...T10, approvals: [approval({ shiftId: CA2.id, otMinutes: 90 })] },
    check: expectOne({ otApproved: 90, needsReview: false }),
  },
  {
    id: 'T15',
    title: 'OT theo đơn đã duyệt',
    input: {
      ...T10,
      company: { ...T10.company, otFromRequest: true },
      requests: [{ type: 'overtime', from: '22:00', to: '23:00' }],
    },
    check: expectOne({ otProposed: 98, otApproved: 60, otState: 'cho_duyet' }),
  },
  {
    id: 'T16',
    title: 'không tính OT',
    input: { ...T10, approvals: [approval({ shiftId: CA2.id, otMinutes: 0 })] },
    check: expectOne({ otApproved: 0, needsReview: false }),
  },
  {
    id: 'T17',
    title: 'thiếu lần ra',
    input: T17,
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'thieu_gio', cong: 0, missing: 1 });
      expect(records[0]!.flags).toContain('thieu_ra');
    },
  },
  {
    id: 'T18',
    title: 'thiếu lần vào',
    input: onShift(CA1, [punch('out', '14:02')]),
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'thieu_gio', cong: 0, missing: 1 });
      expect(records[0]!.flags).toContain('thieu_vao');
    },
  },
  {
    id: 'T19',
    title: 'vắng',
    input: T19,
    check: expectOne({ status: 'vang', cong: 0, needsReview: true, suggestions: [] }),
  },
  {
    id: 'T20',
    title: 'thiếu giờ có giải trình',
    input: { ...T17, explanations: [{ shiftId: SANG.id, reason: 'ra 12:05 quên bấm' }] },
    check: (records) => expect(label(records[0])).toBe('Duyệt 1 công'),
  },
  {
    id: 'T21',
    title: 'đơn quên chấm thêm lần ra tổng hợp',
    input: onShift(SANG, [punch('in', '06:59'), punch('out', '12:05', { inZone: null })]),
    check: expectOne({ status: 'du', workedMin: 300, cong: 1, otProposed: 0 }),
  },
  {
    id: 'T22',
    title: 'chưa tới giờ',
    input: onShift(CA1, []),
    now: time('05:50'),
    check: expectOne({ status: 'chua_toi' }),
  },
  {
    id: 'T23',
    title: 'đang làm',
    input: onShift(CA1, [punch('in', '05:59')]),
    now: time('09:00'),
    check: expectOne({ status: 'dang_lam', cong: 0 }),
  },
  {
    id: 'T24',
    title: 'ngoài vùng',
    input: onShift(TOI, [punch('in', '16:59', { inZone: false }), punch('out', '22:05')]),
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'ngoai_vung', cong: 1 });
      expect(label(records[0])).toBe('Duyệt vị trí');
    },
  },
  {
    id: 'T25',
    title: 'sai ca',
    input: onShift(SANG, [
      punch('in', '06:59', { chosenShiftId: CHIEU.id }),
      punch('out', '12:04', { chosenShiftId: CHIEU.id }),
    ]),
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'sai_ca', shiftId: SANG.id, cong: 1 });
      expect(label(records[0])).toBe('Xác nhận ca Ca sáng');
    },
  },
  {
    id: 'T26',
    title: 'ngoài lịch, linh hoạt',
    input: input({
      punches: [
        punch('in', '06:58', { chosenShiftId: SANG.id }),
        punch('out', '12:01', { chosenShiftId: SANG.id }),
      ],
    }),
    check: expectOne({ status: 'ngoai_lich', shiftId: SANG.id, cong: 1, needsReview: true }),
  },
  {
    id: 'T27',
    title: 'làm ngày Cho nghỉ',
    input: fixed(CA1, pair('06:00', '14:00'), { schedule: offCell }),
    check: expectOne({ status: 'ngoai_lich', cong: 0, needsReview: true }),
  },
  {
    id: 'T28',
    title: 'chấm trùng lấy lần vào sớm nhất',
    input: onShift(CA1, [punch('in', '05:58'), punch('in', '06:02'), punch('out', '14:00')]),
    check: (records) => {
      expect(only(records)).toMatchObject({ status: 'du', cong: 1 });
      expect(records[0]!.inAt).toEqual(time('05:58'));
    },
  },
  {
    id: 'T29',
    title: 'ca liền nhau tách tại mốc giao',
    input: onShift([SANG, CHIEU], pair('07:13', '17:00')),
    check: (records) => {
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({ lateMin: 13, workedMin: 287, cong: 1, outAt: time('12:00') });
      expect(records[1]).toMatchObject({ lateMin: 0, workedMin: 300, cong: 1, inAt: time('12:00') });
    },
  },
  {
    id: 'T30',
    title: 'hai cặp chấm chồng mốc giao, lần ra trong 15 phút thuộc ca trước',
    input: onShift([SANG, CHIEU], [...pair('06:58', '12:02'), ...pair('12:01', '17:03')]),
    check: (records) => {
      expect(records.map(({ status, cong }) => [status, cong])).toEqual([
        ['du', 1],
        ['du', 1],
      ]);
    },
  },
  {
    id: 'T31',
    title: 'ca đêm thuộc ngày bắt đầu',
    input: onShift(DEM, [punch('in', '21:55'), { ...punch('out', '06:03'), at: time('06:03', NEXT_DATE) }]),
    check: expectOne({ date: DATE, workedMin: 480, cong: 1 }),
  },
  {
    id: 'T32',
    title: 'ngoài cửa sổ ghép',
    input: onShift(CA1, pair('03:50', '14:00')),
    check: (records) => {
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({ status: 'thieu_gio', shiftId: CA1.id });
      expect(records[0]!.flags).toContain('thieu_vao');
      expect(records[1]).toMatchObject({ status: 'ngoai_lich', shiftId: null, inAt: time('03:50') });
    },
  },
  {
    id: 'T33',
    title: 'lễ, không đi làm',
    input: fixed(CA1, [], { isHoliday: true }),
    check: expectOne({ status: 'le', cong: 1, isHoliday: true, needsReview: false }),
  },
  {
    id: 'T34',
    title: 'lễ, đi làm',
    input: fixed(CA1, pair('06:00', '14:00'), { isHoliday: true }),
    check: expectOne({ status: 'ot_cho', cong: 1, otProposed: 450, otRate: 300 }),
  },
  {
    id: 'T35',
    title: 'đi làm ngày nghỉ tuần',
    input: fixed(CA1, pair('08:00', '12:00'), {
      employee: {
        ...fixed(CA1, []).employee,
        workDays: [1, 2, 4, 5],
      },
    }),
    check: expectOne({
      status: 'ot_cho',
      offDay: true,
      shiftId: null,
      cong: 0,
      otProposed: 240,
      otRate: 200,
    }),
  },
  {
    id: 'T36',
    title: 'phép năm',
    input: onShift(CA1, [], { requests: [annualLeave] }),
    check: expectOne({ status: 'nghi_phep', cong: 1 }),
  },
  {
    id: 'T37',
    title: 'phép năm, ca ghép',
    input: onShift(SANG, [], { requests: [annualLeave] }),
    check: expectOne({ status: 'nghi_phep', cong: 0.5 }),
  },
  {
    id: 'T38',
    title: 'nghỉ ốm',
    input: onShift(CA1, [], { requests: [{ type: 'leave', leaveType: 'sick' }] }),
    check: expectOne({ status: 'nghi_phep', cong: 0, needsReview: false }),
  },
  {
    id: 'T39',
    title: 'Cho nghỉ',
    input: fixed(CA1, [], { schedule: offCell }),
    check: expectOne({ status: 'nghi', cong: 0, needsReview: false }),
  },
  {
    id: 'T40',
    title: 'trước ngày vào làm',
    input: fixed(CA1, [], {
      employee: { ...fixed(CA1, []).employee, onboardDate: NEXT_DATE },
    }),
    check: (records) => expect(records).toEqual([]),
  },
  {
    id: 'T41',
    title: 'linh hoạt không lịch',
    input: input(),
    check: (records) => expect(records).toEqual([]),
  },
  {
    id: 'T42',
    title: 'giờ thực tế, trần 1 công',
    input: onShift(LH, pair('08:30', '17:00')),
    check: expectOne({ workedMin: 510, cong: 1, lateMin: 0 }),
  },
  {
    id: 'T43',
    title: 'giờ thực tế',
    input: onShift(LH, pair('09:00', '13:00')),
    check: expectOne({ workedMin: 240, cong: 0.5, lateMin: 0 }),
  },
  {
    id: 'T44',
    title: 'giờ thực tế có bắt lỗi',
    input: onShift(LH_STRICT, pair('08:20', '18:00')),
    check: expectOne({ lateMin: 20, cong: 1 }),
  },
  {
    id: 'T45',
    title: 'ca không bắt lỗi',
    input: onShift(TV2, pair('06:20', '08:00')),
    check: expectOne({ lateMin: 0, workedMin: 100, cong: 1 }),
  },
  {
    id: 'T46',
    title: 'nửa công ca ghép',
    input: onShift(SANG, pair('07:00', '09:40')),
    check: expectOne({ earlyMin: 140, workedMin: 160, cong: 0.5 }),
  },
  {
    id: 'T47',
    title: 'tha muộn',
    input: { ...T03, penaltyPerMin: 1000, approvals: [approval({ waiveLate: true })] },
    check: expectOne({ lateMin: 14, waivedLate: true, penalty: 0 }),
  },
  {
    id: 'T48',
    title: 'duyệt vắng thành 1 công',
    input: { ...T19, approvals: [approval({ congOverride: 1 })] },
    check: expectOne({ cong: 1, needsReview: false }),
  },
  {
    id: 'T49',
    title: 'phạt muộn',
    input: { ...T03, penaltyPerMin: 1000 },
    check: expectOne({ penalty: 14_000 }),
  },
  {
    id: 'T50',
    title: 'hoàn duyệt trở về kết quả hệ thống',
    // Dòng duyệt đã thu hồi không được service truyền vào engine
    input: T19,
    check: expectOne({ status: 'vang', cong: 0, needsReview: true }),
  },
  {
    id: 'T51',
    title: 'lần ra quá 15 phút sau mốc giao không thuộc ca trước',
    input: onShift([SANG, CHIEU], [...pair('06:58', '12:16'), ...pair('12:01', '17:03')]),
    check: (records) => {
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({ status: 'thieu_gio', missing: 1 });
      expect(records[0]!.flags).toContain('thieu_ra');
      expect(records[1]).toMatchObject({ status: 'du' });
    },
  },
  {
    id: 'T52',
    title: 'sau ngày nghỉ việc',
    input: fixed(CA1, [], {
      date: NEXT_DATE,
      employee: { ...fixed(CA1, []).employee, leftDate: DATE },
    }),
    check: (records) => expect(records).toEqual([]),
  },
  {
    id: 'T53',
    title: 'đến hết ngày nghỉ việc vẫn giữ công',
    input: fixed(CA1, pair('06:00', '14:00'), {
      employee: { ...fixed(CA1, []).employee, leftDate: DATE },
    }),
    check: expectOne({ status: 'du', cong: 1 }),
  },
  {
    id: 'T54',
    title: 'gộp nhiều quyết định trong một bản ghi duyệt',
    input: onShift(CA2, [punch('in', '14:00', { inZone: false }), punch('out', '23:00')], {
      approvals: [approval({ shiftId: CA2.id, approveGps: true, otMinutes: 60 })],
    }),
    check: expectOne({ status: 'du', otApproved: 60, otState: 'da_duyet', needsReview: false }),
  },
  {
    id: 'T55',
    title: 'đơn phép ngày không có lịch không sinh dòng ngày công',
    input: input({ requests: [annualLeave] }),
    check: (records) => expect(records).toEqual([]),
  },
  {
    id: 'T56',
    title: 'duyệt thiếu giờ có giải trình',
    input: {
      ...T17,
      explanations: [{ shiftId: SANG.id, reason: 'ra 12:05 quên bấm' }],
      approvals: [approval({ shiftId: SANG.id, approveMissing: true })],
    },
    check: expectOne({ cong: 1, needsReview: false, suggestions: [] }),
  },
  {
    id: 'T57',
    title: 'tha về sớm',
    input: onShift(CA1, pair('06:00', '13:50'), {
      penaltyPerMin: 1000,
      approvals: [approval({ waiveEarly: true })],
    }),
    check: expectOne({ status: 'du', earlyMin: 10, waivedEarly: true, penalty: 0 }),
  },
  {
    id: 'T58',
    title: 'tha muộn nhưng chưa tha sớm',
    input: onShift(CA1, pair('06:14', '13:50'), {
      penaltyPerMin: 1000,
      approvals: [approval({ waiveLate: true })],
    }),
    check: expectOne({ status: 'muon', lateMin: 14, earlyMin: 10, penalty: 10_000 }),
  },
  {
    id: 'T59',
    title: 'điều chỉnh nửa công cho ngày thiếu giờ',
    input: { ...T17, approvals: [approval({ shiftId: SANG.id, congOverride: 0.5 })] },
    check: expectOne({ status: 'nua_cong', cong: 0.5, needsReview: false }),
  },
];

describe('bộ ca kiểm thử của đặc tả', () => {
  it('có đủ T01–T59', () => {
    const expected = Array.from({ length: 59 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
    expect(CASES.map(({ id }) => id)).toEqual(expected);
  });

  for (const { id, title, input: dayInput, now, check } of CASES) {
    it(`${id} ${title}`, () => check(computeDay(dayInput, now ?? AFTER_WINDOW)));
  }
});

describe('ngoài bộ ca kiểm thử', () => {
  it('cùng đầu vào luôn ra cùng kết quả', () => {
    const first = computeDay(T10, AFTER_WINDOW);
    expect(computeDay(T10, AFTER_WINDOW)).toEqual(first);
  });

  it('chấm dở sau cửa sổ 6 giờ mới thành thiếu giờ', () => {
    const open = onShift(SANG, [punch('in', '06:59')]);
    expect(computeDay(open, time('17:59'))[0]).toMatchObject({ status: 'dang_lam', needsReview: false });
    expect(computeDay(open, time('18:00'))[0]).toMatchObject({ status: 'thieu_gio', needsReview: true });
  });

  it('chưa chấm trong giờ ca chưa phải vắng, hết ca mới vắng', () => {
    const none = onShift(CA1, []);
    expect(computeDay(none, time('13:59'))[0]).toMatchObject({ status: 'chua_toi' });
    expect(computeDay(none, time('14:00'))[0]).toMatchObject({ status: 'vang' });
  });

  it('lần ra sáng nay của ca đêm hôm trước không thành ngoài lịch', () => {
    const today = input({
      date: NEXT_DATE,
      previousDayShifts: [DEM],
      punches: [{ ...punch('out', '06:03'), at: time('06:03', NEXT_DATE) }],
    });
    expect(computeDay(today, AFTER_WINDOW)).toEqual([]);
  });

  it('lần chấm ca kế tiếp hôm nay không bị ca đêm hôm trước giữ lại', () => {
    const today = onShift(CA1, [], {
      date: NEXT_DATE,
      previousDayShifts: [DEM],
      punches: [
        { ...punch('in', '06:00'), at: time('06:00', NEXT_DATE) },
        { ...punch('out', '14:00'), at: time('14:00', NEXT_DATE) },
      ],
    });
    expect(computeDay(today, AFTER_WINDOW)[0]).toMatchObject({ status: 'du', cong: 1 });
  });

  it('một cặp vào/ra phủ ba ca liền nhau', () => {
    const records = computeDay(onShift([SANG, CHIEU, TOI], pair('07:00', '22:00')), AFTER_WINDOW);
    expect(records.map(({ status, workedMin }) => [status, workedMin])).toEqual([
      ['du', 300],
      ['du', 300],
      ['du', 300],
    ]);
  });

  it('Thứ Bảy nghỉ để trống hệ số thì dùng hệ số ngày thường', () => {
    const saturday = '2026-10-10';
    const record = computeDay(
      fixed(
        CA1,
        [
          { ...punch('in', '08:00'), at: time('08:00', saturday) },
          { ...punch('out', '12:00'), at: time('12:00', saturday) },
        ],
        { date: saturday, employee: { ...fixed(CA1, []).employee, workDays: [1, 2, 3, 4, 5] } },
      ),
      new Date('2026-10-12T12:00:00+07:00'),
    );
    expect(record[0]).toMatchObject({ offDay: true, otRate: 150 });
  });

  it('T14, T16, T47, T48 chốt trạng thái sau khi áp duyệt', () => {
    const decided = (dayInput: DayInput) => computeDay(dayInput, AFTER_WINDOW)[0];
    const approved = { ...T10, approvals: [approval({ shiftId: CA2.id, otMinutes: 90 })] };
    expect(decided(approved)).toMatchObject({ status: 'du', otState: 'da_duyet', suggestions: [] });
    const waived = { ...T03, approvals: [approval({ waiveLate: true })] };
    expect(decided(waived)).toMatchObject({ status: 'du' });
    const paid = { ...T19, approvals: [approval({ congOverride: 1 })] };
    expect(decided(paid)).toMatchObject({ status: 'du' });
    const unpaid = { ...T19, approvals: [approval({ congOverride: 0 })] };
    expect(decided(unpaid)).toMatchObject({ status: 'vang', cong: 0, needsReview: false });
    const half = { ...T19, approvals: [approval({ congOverride: 0.5 })] };
    expect(decided(half)).toMatchObject({ status: 'nua_cong', cong: 0.5, needsReview: false });
  });

  it('duyệt vị trí chỉ đóng cờ GPS, OT vẫn chờ', () => {
    const both = onShift(CA2, [punch('in', '14:00', { inZone: false }), punch('out', '23:00')]);
    const record = computeDay(
      { ...both, approvals: [approval({ shiftId: CA2.id, approveGps: true })] },
      AFTER_WINDOW,
    )[0];
    expect(record).toMatchObject({ status: 'ot_cho', needsReview: true });
    expect(record!.flags).toEqual(['ot_cho']);
  });

  it('duyệt thiếu giờ coi như đủ công', () => {
    const record = computeDay(
      { ...T17, approvals: [approval({ shiftId: SANG.id, approveMissing: true })] },
      AFTER_WINDOW,
    )[0];
    expect(record).toMatchObject({ cong: 1, needsReview: false, suggestions: [] });
  });

  it('xác nhận ca đã làm ngày Cho nghỉ thì có công', () => {
    const offDay = fixed(CA1, pair('06:00', '14:00'), {
      schedule: offCell,
      approvals: [approval({ confirmShiftId: CA1.id })],
    });
    expect(computeDay(offDay, AFTER_WINDOW)[0]).toMatchObject({ cong: 1, needsReview: false });
  });

  it('đơn làm thêm phủ hết OT thì không còn chờ duyệt', () => {
    const covered = {
      ...T10,
      company: { ...T10.company, otFromRequest: true },
      requests: [{ type: 'overtime', from: '22:00', to: '23:45' } as const],
    };
    expect(computeDay(covered, AFTER_WINDOW)[0]).toMatchObject({
      status: 'du',
      otApproved: 98,
      otState: 'da_duyet',
      needsReview: false,
    });
  });

  it('đơn làm thêm sau nửa đêm phủ được OT của ca đêm', () => {
    const night = onShift(
      DEM,
      [punch('in', '22:00'), { ...punch('out', '07:00'), at: time('07:00', NEXT_DATE) }],
      {
        company: { ...input().company, otFromRequest: true },
        requests: [{ type: 'overtime', from: '06:00', to: '06:30' }],
      },
    );
    expect(computeDay(night, AFTER_WINDOW)[0]).toMatchObject({ otProposed: 60, otApproved: 30 });
  });

  it('có đơn phép nhưng vẫn đi làm thì tính theo lần chấm', () => {
    const worked = onShift(CA1, pair('06:00', '14:00'), { requests: [annualLeave] });
    expect(computeDay(worked, AFTER_WINDOW)[0]).toMatchObject({ status: 'du', cong: 1 });
  });

  it('chọn ca ngoài lịch và làm đúng ca đó thì thành ngoài lịch, ca có lịch thành vắng', () => {
    const chosen = { chosenShiftId: CHIEU.id };
    const records = computeDay(
      onShift(SANG, [punch('in', '12:00', chosen), punch('out', '17:00', chosen)]),
      AFTER_WINDOW,
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ shiftId: SANG.id, status: 'vang' });
    expect(records[1]).toMatchObject({ shiftId: CHIEU.id, status: 'ngoai_lich', cong: 1, needsReview: true });
    expect(label(records[1])).toBe('Duyệt ca Ca chiều');
  });

  it('vào quá giờ ca có lịch, lần chấm vẫn về ca ngoài lịch đã chọn', () => {
    const chosen = { chosenShiftId: TOI.id };
    const records = computeDay(
      onShift(SANG, [punch('in', '17:00', chosen), punch('out', '22:00', chosen)]),
      AFTER_WINDOW,
    );
    expect(records[1]).toMatchObject({ shiftId: TOI.id, status: 'ngoai_lich', workedMin: 300 });
  });

  it('chọn ca ngoài lịch nhưng chấm ngoài giờ ca đó không sinh dòng vắng', () => {
    const records = computeDay(
      input({ punches: [punch('in', '20:23', { chosenShiftId: SANG.id })] }),
      AFTER_WINDOW,
    );
    expect(records.map(({ shiftId, status }) => [shiftId, status])).toEqual([[null, 'ngoai_lich']]);
  });

  it.each(Array.from({ length: 24 }, (_, hour) => hour))('chấm lúc %i giờ luôn ra kết quả hợp lệ', (hour) => {
    const at = `${String(hour).padStart(2, '0')}:30`;
    const chosen = { chosenShiftId: SANG.id };
    const noSchedule = computeDay(input({ punches: [punch('in', at, chosen)] }), AFTER_WINDOW);
    expect(noSchedule).toHaveLength(1);
    expect(noSchedule[0]!.needsReview).toBe(true);

    const scheduled = computeDay(onShift(SANG, [punch('in', at, chosen)]), AFTER_WINDOW);
    expect(scheduled.filter(({ shiftId }) => shiftId === SANG.id)).toHaveLength(1);
  });

  it('chọn đúng ca có lịch nhưng chấm sau giờ ra không tạo hai dòng cùng ca', () => {
    const chosen = { chosenShiftId: SANG.id };
    const records = computeDay(onShift(SANG, [punch('in', '20:21', chosen)]), AFTER_WINDOW);
    expect(records.map(({ shiftId, status }) => [shiftId, status])).toEqual([
      [SANG.id, 'vang'],
      [null, 'ngoai_lich'],
    ]);
  });

  it('không bao giờ có hai dòng cùng ca trong một ngày, ràng buộc unique của day_records', () => {
    let seed = 20261101;
    const next = (limit: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed % limit;
    };
    const pick = <T>(items: readonly T[]) => items[next(items.length)]!;
    const clockAt = (minute: number) =>
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

    for (let round = 0; round < 2000; round += 1) {
      const scheduled = LIBRARY.filter(() => next(4) === 0).slice(0, 3);
      const punches = Array.from({ length: next(6) }, () =>
        punch(pick(['in', 'out'] as const), clockAt(next(1440)), {
          chosenShiftId: pick([null, ...LIBRARY.map(({ id }) => id)]),
          inZone: pick([true, false]),
        }),
      );
      const day = onShift(scheduled, punches, {
        previousDayShifts: pick([[], [DEM], [TOI]]),
        isHoliday: next(5) === 0,
      });
      const ids = computeDay(day, AFTER_WINDOW).map(({ shiftId }) => shiftId);
      expect(new Set(ids).size, JSON.stringify({ round, ids })).toBe(ids.length);
    }
  });

  it('muộn đúng bằng mức cho phép chưa tính muộn', () => {
    expect(computeDay(onShift(CA1, pair('06:05', '14:00')), AFTER_WINDOW)[0]).toMatchObject({ lateMin: 0 });
    expect(computeDay(onShift(CA1, pair('06:06', '14:00')), AFTER_WINDOW)[0]).toMatchObject({ lateMin: 6 });
  });

  it('làm tròn 2 chữ số khi tính theo giờ thực tế', () => {
    expect(computeDay(onShift(LH, pair('08:00', '13:13')), AFTER_WINDOW)[0]).toMatchObject({ cong: 0.65 });
  });
});
