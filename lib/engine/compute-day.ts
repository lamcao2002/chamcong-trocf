import { offsetFrom, toMinutes } from '@/lib/domain/shift';
import { expectedShifts, type ExpectedReason } from './expected-shifts';
import {
  matchPunches,
  shiftWindow,
  type ShiftPunches,
  type ShiftWindow,
  type TimedPunch,
} from './match-punches';
import { atMinute, clock, duration, minuteOfDay, weekDay } from './time';
import type { DayInput, DayRecord, DayStatus, EngineApproval, EngineShift, Suggestion } from './types';

const SATURDAY = 6;
const DAY_MINUTES = 24 * 60;
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

/** Đề xuất còn hiệu lực khi cờ tương ứng chưa được duyệt. */
const SUGGESTION_FLAGS: Record<Suggestion['kind'], readonly string[]> = {
  approve_cong: ['thieu_vao', 'thieu_ra'],
  approve_ot: ['ot_cho'],
  approve_gps: ['gps'],
  confirm_shift: ['sai_ca'],
  approve_shift: ['ngoai_lich'],
};

function finish(record: DayRecord): DayRecord {
  const { flags, otProposed, otApproved, suggestions } = record;
  const otDecided = otProposed > 0 || otApproved > 0;
  return {
    ...record,
    otState: flags.includes('ot_cho') ? 'cho_duyet' : otDecided ? 'da_duyet' : 'none',
    needsReview: flags.some((flag) => REVIEW_FLAGS.has(flag)),
    suggestions: suggestions.filter(({ kind }) =>
      SUGGESTION_FLAGS[kind].some((flag) => flags.includes(flag)),
    ),
  };
}

/** Cờ mà một quyết định của quản lý đóng lại. */
function closedFlags({
  otMinutes,
  approveGps,
  confirmShiftId,
  approveMissing,
  congOverride,
}: EngineApproval) {
  return [
    ...(otMinutes === null ? [] : ['ot_cho']),
    ...(approveGps ? ['gps'] : []),
    ...(confirmShiftId ? ['sai_ca', 'ngoai_lich'] : []),
    ...(approveMissing || congOverride !== null ? ['thieu_vao', 'thieu_ra', 'vang', 'ngoai_lich'] : []),
  ];
}

/** Duyệt không sửa lần chấm gốc: áp sau cùng lên kết quả đã tính, hoàn duyệt là bỏ khỏi đầu vào. */
function applyApproval(record: DayRecord, approvals: DayInput['approvals']): DayRecord {
  const approval = approvals.find(({ shiftId }) => shiftId === record.shiftId);
  if (!approval) return record;
  const closed = closedFlags(approval);
  return {
    ...record,
    flags: record.flags.filter((flag) => !closed.includes(flag)),
    cong: approval.congOverride ?? (approval.approveMissing ? 1 : record.cong),
    otApproved: approval.otMinutes ?? record.otApproved,
    waivedLate: approval.waiveLate,
    waivedEarly: approval.waiveEarly,
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

type Interval = [from: number, to: number];

type Overtime = { minutes: number; why: string; intervals: Interval[] };

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
  const intervals: Interval[] = [
    ...(countBefore ? [[inMinute, window.start] as Interval] : []),
    ...(countAfter ? [[window.end, outMinute] as Interval] : []),
  ];

  if (isHoliday) {
    const minutes = worked + extra;
    const inShift: Interval = [Math.max(inMinute, window.start), Math.min(outMinute, window.end)];
    return minutes > 0
      ? { minutes, why: `Đi làm ngày lễ, tính OT ${duration(minutes)}`, intervals: [inShift, ...intervals] }
      : null;
  }
  if (extra === 0) return null;
  if (countAfter && !countBefore) {
    const why = `Ra ca lúc ${clock(outMinute)}, sau giờ hết ca (${clock(window.end)}) ${duration(after)} — ${reason}`;
    return { minutes: extra, why, intervals };
  }
  if (countBefore && !countAfter) {
    const why = `Vào ca lúc ${clock(inMinute)}, trước giờ vào ca (${clock(window.start)}) ${duration(before)} — ${reason}`;
    return { minutes: extra, why, intervals };
  }
  return { minutes: extra, why: `Làm ngoài giờ ca ${duration(extra)} — ${reason}`, intervals };
}

/** Phút OT nằm trong khung của đơn làm thêm đã duyệt; phần vượt đơn vẫn chờ duyệt (T15). */
function minutesCoveredByRequest({ minutes, intervals }: Overtime, { company, requests }: DayInput): number {
  if (!company.otFromRequest) return 0;
  let covered = 0;
  for (const request of requests) {
    if (request.type !== 'overtime') continue;
    const from = toMinutes(request.from);
    const span = offsetFrom(request.from, request.to);
    // Mốc của ca đêm nằm trên trục sau nửa đêm nên xét khung đơn ở cả hai ngày
    for (const start of [from, from + DAY_MINUTES]) {
      for (const [intervalFrom, intervalTo] of intervals) {
        covered += Math.max(0, Math.min(intervalTo, start + span) - Math.max(intervalFrom, start));
      }
    }
  }
  return Math.min(minutes, covered);
}

function otSuggestion(pending: number, why: string): Suggestion {
  return { kind: 'approve_ot', label: `Duyệt ${pending} phút`, why, otMinutes: pending };
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
function pickStatus(record: DayRecord, open: boolean): DayStatus {
  const { flags, lateMin, earlyMin, waivedLate, waivedEarly, cong, offDay, inAt, outAt } = record;
  if (open) return 'dang_lam';
  if (flags.includes('vang')) return 'vang';
  if (flags.includes('thieu_vao') || flags.includes('thieu_ra')) return 'thieu_gio';
  if (flags.includes('sai_ca')) return 'sai_ca';
  if (flags.includes('gps')) return 'ngoai_vung';
  if (flags.includes('ngoai_lich')) return 'ngoai_lich';
  if (flags.includes('ot_cho')) return 'ot_cho';
  if ((lateMin > 0 && !waivedLate) || (earlyMin > 0 && !waivedEarly)) return 'muon';
  if (cong >= 1 || offDay) return 'du';
  return inAt || outAt ? 'nua_cong' : 'vang';
}

/** Áp duyệt rồi mới chốt phạt và trạng thái, để ngày đã duyệt không còn hiện là cần xử lý. */
function settle(record: DayRecord, input: DayInput, open = false): DayRecord {
  const applied = applyApproval(record, input.approvals);
  const lateMin = applied.waivedLate ? 0 : applied.lateMin;
  const earlyMin = applied.waivedEarly ? 0 : applied.earlyMin;
  return finish({
    ...applied,
    penalty: (lateMin + earlyMin) * input.penaltyPerMin,
    status: pickStatus(applied, open),
  });
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
  const leave = input.requests.find((request) => request.type === 'leave');
  if (leave) {
    const cong = leave.leaveType === 'annual' ? expectedCong : 0;
    return finish({ ...base, status: 'nghi_phep', cong });
  }
  if (nowMinute < end) return finish(base);
  const reason = input.explanations.find(({ shiftId }) => shiftId === shift.id)?.reason;
  return settle({ ...base, flags: ['vang'], notes: reason ? [`Giải trình: ${reason}`] : [] }, input);
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
  const otApproved = ot ? minutesCoveredByRequest(ot, input) : 0;
  const otPending = ot ? ot.minutes - otApproved : 0;
  const explanation = input.explanations.find(({ shiftId }) => shiftId === shift.id)?.reason;

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
    ...(otPending > 0 ? ['ot_cho'] : []),
  ];

  const suggestions: Suggestion[] = [
    ...(explanation
      ? [{ kind: 'approve_cong' as const, label: 'Duyệt 1 công', why: `Có giải trình: ${explanation}` }]
      : []),
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
    ...(ot ? [otSuggestion(otPending, ot.why)] : []),
  ];

  const shown = evidence(input.date, inMinute, outMinute);
  const record: DayRecord = {
    ...blankRecord(input, shift.id, 'du'),
    ...shown,
    notes: [...shown.notes, ...(explanation ? [`Giải trình: ${explanation}`] : [])],
    workedMin: worked,
    cong,
    expectedCong,
    lateMin,
    earlyMin,
    otProposed: ot?.minutes ?? 0,
    otApproved,
    otRate: ot ? otRate(input, false) : 0,
    missing: flags.filter((flag) => flag === 'thieu_vao' || flag === 'thieu_ra').length,
    flags,
    suggestions,
  };
  return settle(record, input, open);
}

/** Lần chấm không ghép được ca nào; gom một dòng không gắn ca để Hộp việc xử lý (T32). */
function unmatchedRecord(punches: readonly TimedPunch[], input: DayInput): DayRecord {
  const minutes = (type: TimedPunch['type']) =>
    punches.filter((punch) => punch.type === type).map(({ minute }) => minute);
  const ins = minutes('in');
  const outs = minutes('out');
  return settle(
    {
      ...blankRecord(input, null, 'ngoai_lich'),
      ...evidence(
        input.date,
        ins.length > 0 ? Math.min(...ins) : null,
        outs.length > 0 ? Math.max(...outs) : null,
      ),
      flags: ['ngoai_lich'],
    },
    input,
  );
}

/** Đi làm ngày nghỉ tuần: không có ca nên không có công, toàn bộ phút làm là OT đề xuất (T35). */
function offDayRecord(punches: readonly TimedPunch[], input: DayInput): DayRecord {
  const ins = punches.filter(({ type }) => type === 'in').map(({ minute }) => minute);
  const outs = punches.filter(({ type }) => type === 'out').map(({ minute }) => minute);
  const inMinute = ins.length > 0 ? Math.min(...ins) : null;
  const outMinute = outs.length > 0 ? Math.max(...outs) : null;
  const offDay = {
    ...blankRecord(input, null, 'ot_cho'),
    ...evidence(input.date, inMinute, outMinute),
    offDay: true,
  };

  if (inMinute === null || outMinute === null) {
    return settle({ ...offDay, flags: [inMinute === null ? 'thieu_vao' : 'thieu_ra'], missing: 1 }, input);
  }
  const minutes = Math.max(0, outMinute - inMinute);
  const why = `Đi làm ngày nghỉ tuần ${duration(minutes)}, tính toàn bộ là OT`;
  const ot: Overtime = { minutes, why, intervals: [[inMinute, outMinute]] };
  const otApproved = minutesCoveredByRequest(ot, input);
  const pending = minutes - otApproved;
  return settle(
    {
      ...offDay,
      workedMin: minutes,
      otProposed: minutes,
      otApproved,
      otRate: otRate(input, true),
      flags: pending > 0 ? ['ot_cho'] : [],
      suggestions: [otSuggestion(pending, why)],
    },
    input,
  );
}

/** Lần chấm không thuộc ca kỳ vọng nào: thành ca ngoài lịch theo ca đã chọn, không có ca thì dòng không gắn ca. */
function temporaryRecords(
  punches: readonly TimedPunch[],
  context: Context,
  fallbackShiftId: string | null,
  noCong: boolean,
  expectedIds: readonly string[] = [],
): DayRecord[] {
  const { input } = context;
  const chosenId = punches.find(({ chosenShiftId }) => chosenShiftId)?.chosenShiftId;
  const temporary = input.shifts.find(({ id }) => id === (chosenId ?? fallbackShiftId));
  // Chọn đúng ca có lịch nhưng chấm ngoài cửa sổ của ca đó: ca đã có dòng riêng, không tạo trùng
  if (!temporary || expectedIds.includes(temporary.id)) return [unmatchedRecord(punches, input)];
  const confirmed = input.approvals.some(
    ({ shiftId, confirmShiftId }) => shiftId === temporary.id && confirmShiftId,
  );

  const { slots, unmatched: outside } = matchPunches([shiftWindow(temporary)], punches, []);
  return [
    ...slots
      .filter(({ punches: matched }) => matched.length > 0)
      .map((slot) => shiftRecord(slot, context, { temporary: true, noCong: noCong && !confirmed })),
    ...(outside.length > 0 ? [unmatchedRecord(outside, input)] : []),
  ];
}

/**
 * Chọn ca ngoài lịch rồi làm đúng ca đó (US20): giờ chấm trùng ca đã chọn nhiều hơn ca kỳ vọng thì
 * đây là ca ngoài lịch, không phải chọn nhầm. Trả về ca đã chọn trong trường hợp này.
 */
function offScheduleChoice({ window, punches, inMinute, outMinute }: ShiftPunches, { input }: Context) {
  if (inMinute === null || outMinute === null) return null;
  const chosenId = punches.find(({ chosenShiftId }) => chosenShiftId)?.chosenShiftId;
  const chosen = input.shifts.find(({ id }) => id === chosenId);
  if (!chosen || chosen.id === window.shift.id) return null;
  const chosenMinutes = workedMinutes(shiftWindow(chosen), inMinute, outMinute);
  return chosenMinutes > workedMinutes(window, inMinute, outMinute) ? chosen : null;
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

  const fixedId = reason === 'off' ? input.employee.fixedShiftId : null;
  return temporaryRecords(unmatched, context, fixedId, reason === 'off');
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
  const expectedIds = expected.shifts.map(({ id }) => id);
  const loose = [...unmatched];
  const kept = slots.map((slot) => {
    const choice = offScheduleChoice(slot, context);
    if (!choice || expectedIds.includes(choice.id)) return slot;
    loose.push(...slot.punches);
    return { ...slot, punches: [], inMinute: null, outMinute: null };
  });
  return [
    ...kept.map((slot) => shiftRecord(slot, context)),
    ...(loose.length > 0 ? temporaryRecords(loose, context, null, false, expectedIds) : []),
  ];
}
