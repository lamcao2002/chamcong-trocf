import type {
  dayStatusEnum,
  graceModeEnum,
  otStateEnum,
  shiftCalcEnum,
  shiftModeEnum,
} from '@/lib/db/schema';

export type DayStatus = (typeof dayStatusEnum.enumValues)[number];
export type OtState = (typeof otStateEnum.enumValues)[number];

export type EngineShift = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  calc: (typeof shiftCalcEnum.enumValues)[number];
  stdHours: number;
  minFull: number;
  minHalf: number;
  graceMin: number;
  /** NULL = lấy `otMin` của công ty. */
  minOt: number | null;
  isPart: boolean;
  noLateCheck: boolean;
};

export type EnginePunch = {
  at: Date;
  type: 'in' | 'out';
  chosenShiftId: string | null;
  /** NULL với lần chấm tổng hợp từ đơn quên chấm. */
  inZone: boolean | null;
};

export type EngineEmployee = {
  onboardDate: string;
  leftDate: string | null;
  shiftMode: (typeof shiftModeEnum.enumValues)[number];
  fixedShiftId: string | null;
  workDays: readonly number[];
};

export type EngineCompany = {
  graceMode: (typeof graceModeEnum.enumValues)[number];
  otBefore: boolean;
  otMin: number;
  otFromRequest: boolean;
};

export type OtRates = {
  weekday: number;
  /** NULL = dùng `weekday`. */
  saturday: number | null;
  offday: number;
  holiday: number;
};

export type EngineRequest =
  { type: 'leave'; leaveType: 'annual' | 'sick' | 'unpaid' } | { type: 'overtime'; from: string; to: string };

export type EngineExplanation = { shiftId: string | null; reason: string };

export type EngineApproval = {
  shiftId: string | null;
  congOverride: number | null;
  otMinutes: number | null;
  approveMissing: boolean;
  waiveLate: boolean;
  waiveEarly: boolean;
  confirmShiftId: string | null;
  approveGps: boolean;
};

export type DayInput = {
  date: string;
  employee: EngineEmployee;
  company: EngineCompany;
  /** Mọi ca của công ty mà nhân viên có thể gặp trong ngày, gồm cả ca đã chọn khi chấm. */
  shifts: readonly EngineShift[];
  schedule: { shiftIds: readonly string[]; isOff: boolean } | null;
  /** Ca kỳ vọng hôm trước: lần chấm sáng nay có thể thuộc về chúng (ca đêm, ở lại muộn). */
  previousDayShifts: readonly EngineShift[];
  isHoliday: boolean;
  /** Lần chấm từ hôm trước đến hôm sau của `date`; engine tự chọn lần thuộc về ngày này. */
  punches: readonly EnginePunch[];
  otRates: OtRates;
  /** Phạt nằm ngoài MVP: service truyền 0 (đặc tả, quyết định B3). */
  penaltyPerMin: number;
  /** Đơn đã duyệt phủ ngày này. */
  requests: readonly EngineRequest[];
  explanations: readonly EngineExplanation[];
  approvals: readonly EngineApproval[];
};

export type Suggestion = {
  kind: 'approve_cong' | 'approve_ot' | 'approve_gps' | 'confirm_shift' | 'approve_shift';
  label: string;
  why: string;
  otMinutes?: number;
  shiftId?: string;
};

export type DayRecord = {
  date: string;
  shiftId: string | null;
  status: DayStatus;
  inAt: Date | null;
  outAt: Date | null;
  workedMin: number;
  cong: number;
  expectedCong: number;
  lateMin: number;
  earlyMin: number;
  waivedLate: boolean;
  waivedEarly: boolean;
  otProposed: number;
  otApproved: number;
  otState: OtState;
  /** Hệ số OT (%) của ngày; không lưu, Lương suy lại từ `offDay`, `isHoliday`. */
  otRate: number;
  /** Không lưu, xem `penaltyPerMin`. */
  penalty: number;
  missing: number;
  offDay: boolean;
  isHoliday: boolean;
  flags: string[];
  needsReview: boolean;
  suggestions: Suggestion[];
  /** Dòng bằng chứng cho Hộp việc: "Vào 13:59", "Ra 23:38". */
  notes: string[];
};
