import { expectedShifts, type ExpectedReason } from './expected-shifts';
import {
  matchPunches,
  shiftWindow,
  type ShiftPunches,
  type ShiftWindow,
  type TimedPunch,
} from './match-punches';
import { atMinute, clock, duration, minuteOfDay, weekDay } from './time';
import type { DayInput, DayRecord, DayStatus, EngineShift, Suggestion } from './types';

const SATURDAY = 6;
/** Sau mốc này lần vào chưa có lần ra mới thành thiếu giờ, khớp cửa sổ ghép lần ra. */
const OPEN_SHIFT_MINUTES = 6 * 60;

const REVIEW_FLAGS = new Set(['thieu_vao', 'thieu_ra', 'vang', 'sai_ca', 'gps', 'ngoai_lich', 'ot_cho']);

type Context = { input: DayInput; nowMinute: number };

/** Dòng ngày công chưa có số liệu; mỗi nhánh chỉ ghi đè phần của mình. */
function blankRecord({ date, isHoliday }: DayInput, shiftId: string | null, status: DayStatus): DayRecord {
  return {
    date,
    shiftId,
    status,
    inAt: null,
    outAt: null,
    workedMin: 0,
    cong: 0,
    expectedCong: 0,
    lateMin: 0,
    earlyMin: 0,
    waivedLate: false,
    waivedEarly: false,
    otProposed: 0,
    otApproved: 0,
    otState: 'none',
    otRate: 0,
    penalty: 0,
    missing: 0,
    offDay: false,
    isHoliday,
    flags: [],
    needsReview: false,
    suggestions: [],
    notes: [],
  };
}

function finish(record: DayRecord): DayRecord {
  const otPending = record.otProposed > 0;
  return {
    ...record,
    otState: otPending ? 'cho_duyet' : 'none',
    needsReview: record.flags.some((flag) => REVIEW_FLAGS.has(flag)),
  };
}

function evidence(date: string, inMinute: number | null, outMinute: number | null) {
  return {
    inAt: inMinute === null ? null : atMinute(date, inMinute),
    outAt: outMinute === null ? null : atMinute(date, outMinute),
    notes: [
      ...(inMinute === null ? [] : [`Vào ${clock(inMinute)}`]),
      ...(outMinute === null ? [] : [`Ra ${clock(outMinute)}`]),
    ],
  };
}

function otRate({ date, isHoliday, otRates }: DayInput, offDay: boolean): number {
  if (isHoliday) return otRates.holiday;
  if (!offDay) return otRates.weekday;
  return weekDay(date) === SATURDAY ? (otRates.saturday ?? otRates.weekday) : otRates.offday;
}

/** Bước C: phút làm chỉ đếm phần trong khung ca, trừ phần giao với giờ nghỉ. */
function workedMinutes(window: ShiftWindow, inMinute: number, outMinute: number): number {
  const from = Math.max(inMinute, window.start);
  const to = Math.min(outMinute, window.end);
  if (to <= from) return 0;
  const onBreak = window.break
    ? Math.max(0, Math.min(to, window.break.end) - Math.max(from, window.break.start))
    : 0;
  return to - from - onBreak;
}

function congOf(shift: EngineShift, worked: number): number {
  if (shift.calc === 'block') {
    if (worked >= shift.minFull) return 1;
    return worked >= shift.minHalf ? 0.5 : 0;
  }
  return Math.min(1, Math.round((worked / (shift.stdHours * 60)) * 100) / 100);
}

/** Bước D: phút muộn hoặc về sớm thô, theo mức cho phép và chế độ công ty. */
function latenessMinutes(shift: EngineShift, raw: number, graceMode: DayInput['company']['graceMode']) {
  if (shift.noLateCheck || shift.calc === 'actual' || raw <= shift.graceMin) return 0;
  return graceMode === 'toan_bo' ? raw : raw - shift.graceMin;
}

type Overtime = { minutes: number; why: string };

/** Bước E: OT luôn chỉ là đề xuất. Lễ tính toàn bộ phút làm, phần trước/sau ca đủ ngưỡng cộng thêm. */
function overtime(
  { window, inMinute, outMinute }: ShiftPunches,
  worked: number,
  { company, isHoliday }: DayInput,
): Overtime | null {
  if (inMinute === null || outMinute === null) return null;
  const threshold = window.shift.minOt ?? company.otMin;
  const before = window.start - inMinute;
  const after = outMinute - window.end;
  const countBefore = company.otBefore && before >= threshold;
  const countAfter = after >= threshold;
  const extra = (countBefore ? before : 0) + (countAfter ? after : 0);
  const reason = `vượt mức tối thiểu tính OT`;

  if (isHoliday) {
    const minutes = worked + extra;
    return minutes > 0 ? { minutes, why: `Đi làm ngày lễ, tính OT ${duration(minutes)}` } : null;
  }
  if (extra === 0) return null;
  if (countAfter && !countBefore) {
    const why = `Ra ca lúc ${clock(outMinute)}, sau giờ hết ca (${clock(window.end)}) ${duration(after)} — ${reason}`;
    return { minutes: extra, why };
  }
  if (countBefore && !countAfter) {
    const why = `Vào ca lúc ${clock(inMinute)}, trước giờ vào ca (${clock(window.start)}) ${duration(before)} — ${reason}`;
    return { minutes: extra, why };
  }
  return { minutes: extra, why: `Làm ngoài giờ ca ${duration(extra)} — ${reason}` };
}

function otSuggestion({ minutes, why }: Overtime): Suggestion {
  return { kind: 'approve_ot', label: `Duyệt ${minutes} phút`, why, otMinutes: minutes };
}

const GPS_SUGGESTION: Suggestion = {
  kind: 'approve_gps',
  label: 'Duyệt vị trí',
  why: 'Có lần chấm ngoài vùng cho phép',
};

function shiftSuggestion(shift: EngineShift): Suggestion {
  return {
    kind: 'approve_shift',
    label: `Duyệt ca ${shift.name}`,
    why: 'Chấm công khi không có ca trong lịch',
    shiftId: shift.id,
  };
}

/** Bước F: dòng trên thắng, theo bảng trạng thái của đặc tả. */
function pickStatus(record: DayRecord, open: boolean, cong: number): DayStatus {
  const { flags, lateMin, earlyMin } = record;
  if (open) return 'dang_lam';
  if (flags.includes('thieu_vao') || flags.includes('thieu_ra')) return 'thieu_gio';
  if (flags.includes('sai_ca')) return 'sai_ca';
  if (flags.includes('gps')) return 'ngoai_vung';
  if (flags.includes('ngoai_lich')) return 'ngoai_lich';
  if (flags.includes('ot_cho')) return 'ot_cho';
  if (lateMin > 0 || earlyMin > 0) return 'muon';
  return cong >= 1 ? 'du' : 'nua_cong';
}

type ShiftRecordOptions = {
  /** Ca không có trong lịch, tạo từ ca đã chọn khi chấm. */
  temporary?: boolean;
  /** Ngày Cho nghỉ: chưa có công cho tới khi quản lý duyệt (T27). */
  noCong?: boolean;
};

function noPunchRecord(slot: ShiftPunches, { input, nowMinute }: Context, expectedCong: number): DayRecord {
  const { shift, end } = slot.window;
  const base = { ...blankRecord(input, shift.id, 'chua_toi'), expectedCong };
  if (input.isHoliday && input.employee.shiftMode === 'fixed') {
    return finish({ ...base, status: 'le', cong: expectedCong });
  }
  if (nowMinute < end) return finish(base);
  return finish({ ...base, status: 'vang', flags: ['vang'] });
}

function shiftRecord(slot: ShiftPunches, context: Context, options: ShiftRecordOptions = {}): DayRecord {
  const { input, nowMinute } = context;
  const { window, punches, inMinute, outMinute } = slot;
  const { shift } = window;
  const expectedCong = shift.isPart ? 0.5 : 1;
  // Ca giữa của cặp vào/ra phủ nhiều ca không có lần chấm riêng nhưng đã có mốc tách
  if (inMinute === null && outMinute === null) return noPunchRecord(slot, context, expectedCong);

  const hasBoth = inMinute !== null && outMinute !== null;
  const open = inMinute !== null && outMinute === null && nowMinute < window.end + OPEN_SHIFT_MINUTES;
  const worked = hasBoth ? workedMinutes(window, inMinute, outMinute) : 0;
  const cong = options.noCong ? 0 : congOf(shift, worked);
  const { graceMode } = input.company;
  const lateMin = inMinute === null ? 0 : latenessMinutes(shift, inMinute - window.start, graceMode);
  const earlyMin = outMinute === null ? 0 : latenessMinutes(shift, window.end - outMinute, graceMode);
  const ot = overtime(slot, worked, input);

  const chosenElsewhere = punches.some(
    ({ chosenShiftId }) => chosenShiftId !== null && chosenShiftId !== shift.id,
  );
  const outOfZone = punches.some(({ inZone }) => inZone === false);
  const flags = [
    ...(inMinute === null ? ['thieu_vao'] : []),
    ...(outMinute === null && !open ? ['thieu_ra'] : []),
    ...(chosenElsewhere && !options.temporary ? ['sai_ca'] : []),
    ...(outOfZone ? ['gps'] : []),
    ...(options.temporary ? ['ngoai_lich'] : []),
    ...(ot ? ['ot_cho'] : []),
  ];

  const suggestions: Suggestion[] = [
    ...(flags.includes('sai_ca')
      ? [
          {
            kind: 'confirm_shift' as const,
            label: `Xác nhận ca ${shift.name}`,
            why: `Giờ chấm khớp ${shift.name}, khác ca đã chọn`,
            shiftId: shift.id,
          },
        ]
      : []),
    ...(outOfZone ? [GPS_SUGGESTION] : []),
    ...(options.temporary ? [shiftSuggestion(shift)] : []),
    ...(ot ? [otSuggestion(ot)] : []),
  ];

  const record: DayRecord = {
    ...blankRecord(input, shift.id, 'du'),
    ...evidence(input.date, inMinute, outMinute),
    workedMin: worked,
    cong,
    expectedCong,
    lateMin,
    earlyMin,
    otProposed: ot?.minutes ?? 0,
    otRate: ot ? otRate(input, false) : 0,
    penalty: (lateMin + earlyMin) * input.penaltyPerMin,
    missing: flags.filter((flag) => flag === 'thieu_vao' || flag === 'thieu_ra').length,
    flags,
    suggestions,
  };
  return finish({ ...record, status: pickStatus(record, open, cong) });
}

/** Lần chấm không ghép được ca nào; gom một dòng không gắn ca để Hộp việc xử lý (T32). */
function unmatchedRecord(punches: readonly TimedPunch[], input: DayInput): DayRecord {
  const minutes = (type: TimedPunch['type']) =>
    punches.filter((punch) => punch.type === type).map(({ minute }) => minute);
  const ins = minutes('in');
  const outs = minutes('out');
  return finish({
    ...blankRecord(input, null, 'ngoai_lich'),
    ...evidence(
      input.date,
      ins.length > 0 ? Math.min(...ins) : null,
      outs.length > 0 ? Math.max(...outs) : null,
    ),
    flags: ['ngoai_lich'],
  });
}

/** Đi làm ngày nghỉ tuần: không có ca nên không có công, toàn bộ phút làm là OT đề xuất (T35). */
function offDayRecord(punches: readonly TimedPunch[], input: DayInput): DayRecord {
  const ins = punches.filter(({ type }) => type === 'in').map(({ minute }) => minute);
  const outs = punches.filter(({ type }) => type === 'out').map(({ minute }) => minute);
  const inMinute = ins.length > 0 ? Math.min(...ins) : null;
  const outMinute = outs.length > 0 ? Math.max(...outs) : null;
  const base = { ...blankRecord(input, null, 'ot_cho'), ...evidence(input.date, inMinute, outMinute) };
  const offDay = { ...base, offDay: true };

  if (inMinute === null || outMinute === null) {
    const flag = inMinute === null ? 'thieu_vao' : 'thieu_ra';
    return finish({ ...offDay, status: 'thieu_gio', flags: [flag], missing: 1 });
  }
  const minutes = Math.max(0, outMinute - inMinute);
  const why = `Đi làm ngày nghỉ tuần ${duration(minutes)}, tính toàn bộ là OT`;
  return finish({
    ...offDay,
    workedMin: minutes,
    otProposed: minutes,
    otRate: otRate(input, true),
    flags: ['ot_cho'],
    suggestions: [otSuggestion({ minutes, why })],
  });
}

/** Ngày không có ca kỳ vọng: lần chấm nếu có thành OT ngày nghỉ hoặc ca ngoài lịch. */
function withoutExpectedShift(
  reason: ExpectedReason,
  punches: readonly TimedPunch[],
  previous: readonly ShiftWindow[],
  context: Context,
): DayRecord[] {
  const { input } = context;
  const { unmatched } = matchPunches([], punches, previous);

  if (unmatched.length === 0) return reason === 'off' ? [finish(blankRecord(input, null, 'nghi'))] : [];
  if (reason === 'off_day') return [offDayRecord(unmatched, input)];

  const chosenId = unmatched.find(({ chosenShiftId }) => chosenShiftId)?.chosenShiftId;
  const fixedId = reason === 'off' ? input.employee.fixedShiftId : null;
  const temporary = input.shifts.find(({ id }) => id === (chosenId ?? fixedId));
  if (!temporary) return [unmatchedRecord(unmatched, input)];

  const { slots, unmatched: outside } = matchPunches([shiftWindow(temporary)], unmatched, []);
  return [
    ...slots.map((slot) => shiftRecord(slot, context, { temporary: true, noCong: reason === 'off' })),
    ...(outside.length > 0 ? [unmatchedRecord(outside, input)] : []),
  ];
}

/**
 * Tính ngày công của một nhân viên trong một ngày, bước A–F của đặc tả. Hàm thuần: không đọc đồng hồ
 * ngoài `now`, cùng đầu vào luôn ra cùng kết quả. Trả về một dòng mỗi ca, không dòng nào nếu không
 * có ca và không có lần chấm.
 */
export function computeDay(input: DayInput, now: Date): DayRecord[] {
  const { date } = input;
  const expected = expectedShifts(input);
  const context: Context = { input, nowMinute: minuteOfDay(now, date) };
  const punches = input.punches.map((punch) => ({ ...punch, minute: minuteOfDay(punch.at, date) }));
  const previous = input.previousDayShifts.map(shiftWindow);

  if (expected.shifts.length === 0) {
    return withoutExpectedShift(expected.reason, punches, previous, context);
  }

  const { slots, unmatched } = matchPunches(expected.shifts.map(shiftWindow), punches, previous);
  return [
    ...slots.map((slot) => shiftRecord(slot, context)),
    ...(unmatched.length > 0 ? [unmatchedRecord(unmatched, input)] : []),
  ];
}
