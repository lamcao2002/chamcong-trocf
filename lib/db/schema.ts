/**
 * Lược đồ CSDL (Drizzle) — 21 bảng theo PRD MVP.
 *
 * Quy ước:
 * - Mọi bảng có `company_id`, trừ `companies` và 4 bảng nối thuần (lọc qua bảng cha).
 * - Thời điểm `timestamptz`, ngày `date`, tiền `bigint` đồng, hệ số OT là số nguyên phần trăm.
 * - Bật RLS, không có policy: Data API của Supabase không đọc được, app vẫn đọc vì là chủ bảng.
 *
 * Phần thêm so với bảng cột của PRD (ghi vào PRD khi review schema):
 * - employees.failed_pin_attempts, locked_until: khoá 15 phút sau 5 lần sai (US01).
 * - employees.left_date: ngày cuối còn làm; tính lại công không xoá ngày trước đó (US13, T52, T53).
 * - day_records.off_day, is_holiday, waived_late, waived_early, suggestion: đầu ra bước D–F của
 *   đặc tả ngày công; Lương và Hộp việc chỉ đọc `day_records`.
 * - `shift_id` của day_records, explanations, approvals được NULL: dòng theo ngày không gắn ca
 *   (lần chấm ngoài cửa sổ ghép — T32). Unique dùng NULLS NOT DISTINCT, cần PostgreSQL 15+.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const graceModeEnum = pgEnum('grace_mode', ['toan_bo', 'phan_vuot']);
export const shiftCalcEnum = pgEnum('shift_calc', ['block', 'actual', 'actual_strict']);
export const shiftModeEnum = pgEnum('shift_mode', ['fixed', 'flexible']);
export const payTypeEnum = pgEnum('pay_type', ['month', 'hour', 'unit']);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'left']);
export const contractTypeEnum = pgEnum('contract_type', ['full_time', 'part_time', 'intern', 'collaborator']);
export const roleEnum = pgEnum('role', ['app', 'manager', 'hr', 'admin']);
export const sessionKindEnum = pgEnum('session_kind', ['admin', 'app']);
export const punchTypeEnum = pgEnum('punch_type', ['in', 'out']);
export const requestTypeEnum = pgEnum('request_type', [
  'leave',
  'forgot',
  'overtime',
  'late_early',
  'shift_swap',
  'shift_register',
]);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected']);
export const dayStatusEnum = pgEnum('day_status', [
  'chua_toi',
  'dang_lam',
  'vang',
  'thieu_gio',
  'sai_ca',
  'ngoai_vung',
  'ngoai_lich',
  'ot_cho',
  'muon',
  'nua_cong',
  'du',
  'nghi_phep',
  'le',
  'nghi',
]);
export const otStateEnum = pgEnum('ot_state', ['none', 'cho_duyet', 'da_duyet']);
export const adjustmentKindEnum = pgEnum('adjustment_kind', ['bonus', 'penalty']);

/** Phần lương ghi đè riêng của nhân viên; trường bỏ trống thì theo vị trí. */
export type PayOverride = {
  payType?: (typeof payTypeEnum.enumValues)[number];
  payAmount?: number;
  stdDays?: number;
  leaveDays?: number;
  otWeekday?: number;
  otSaturday?: number;
  otOffday?: number;
  otHoliday?: number;
};

const ALL_WEEK = sql`'{0,1,2,3,4,5,6}'::integer[]`;

const id = () => uuid('id').primaryKey().defaultRandom();
const companyId = () =>
  uuid('company_id')
    .notNull()
    .references(() => companies.id);
const employeeId = () =>
  uuid('employee_id')
    .notNull()
    .references(() => employees.id);
const money = (name: string) => bigint(name, { mode: 'number' });
const cong = (name: string) => numeric(name, { precision: 4, scale: 2, mode: 'number' });
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();

export const companies = pgTable(
  'companies',
  {
    id: id(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    address: text('address'),
    appName: text('app_name'),
    brandColor: text('brand_color'),
    workDays: integer('work_days').array().notNull().default(ALL_WEEK),
    graceMode: graceModeEnum('grace_mode').notNull().default('toan_bo'),
    otBefore: boolean('ot_before').notNull().default(false),
    otMin: integer('ot_min').notNull().default(30),
    otFromRequest: boolean('ot_from_request').notNull().default(true),
    /** NULL = kỳ lương tròn tháng. */
    cutoffDay: integer('cutoff_day'),
    createdAt: createdAt(),
  },
  (t) => [check('companies_cutoff_day_range', sql`${t.cutoffDay} between 1 and 31`)],
).enableRLS();

export const locations = pgTable(
  'locations',
  {
    id: id(),
    companyId: companyId(),
    name: text('name').notNull(),
    address: text('address'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    radiusM: integer('radius_m').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('locations_company_idx').on(t.companyId),
    check('locations_radius_range', sql`${t.radiusM} between 30 and 500`),
  ],
).enableRLS();

export const shifts = pgTable(
  'shifts',
  {
    id: id(),
    companyId: companyId(),
    /** Bất biến khi đã có lịch hoặc lần chấm (kiểm ở API, US05). */
    code: text('code').notNull(),
    name: text('name').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakStart: time('break_start'),
    breakEnd: time('break_end'),
    overnight: boolean('overnight').notNull().default(false),
    calc: shiftCalcEnum('calc').notNull().default('block'),
    stdHours: numeric('std_hours', { precision: 4, scale: 2, mode: 'number' }).notNull(),
    minFull: integer('min_full').notNull(),
    minHalf: integer('min_half').notNull(),
    graceMin: integer('grace_min').notNull().default(0),
    /** NULL = lấy `companies.ot_min`. */
    minOt: integer('min_ot'),
    isPart: boolean('is_part').notNull().default(false),
    noLateCheck: boolean('no_late_check').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique('shifts_company_code_unique').on(t.companyId, t.code),
    check('shifts_min_half_le_full', sql`${t.minHalf} <= ${t.minFull}`),
  ],
).enableRLS();

export const positions = pgTable(
  'positions',
  {
    id: id(),
    companyId: companyId(),
    name: text('name').notNull(),
    shiftMode: shiftModeEnum('shift_mode').notNull(),
    fixedShiftId: uuid('fixed_shift_id').references(() => shifts.id),
    workDays: integer('work_days').array().notNull().default(ALL_WEEK),
    anyLocation: boolean('any_location').notNull().default(false),
    payType: payTypeEnum('pay_type').notNull(),
    payAmount: money('pay_amount').notNull(),
    stdDays: integer('std_days').notNull().default(26),
    leaveDays: integer('leave_days').notNull().default(12),
    otWeekday: integer('ot_weekday').notNull().default(150),
    /** NULL = dùng `ot_weekday` (đặc tả: Thứ Bảy nghỉ để trống là 150%). */
    otSaturday: integer('ot_saturday'),
    otOffday: integer('ot_offday').notNull().default(200),
    otHoliday: integer('ot_holiday').notNull().default(300),
    createdAt: createdAt(),
  },
  (t) => [
    index('positions_company_idx').on(t.companyId),
    check('positions_fixed_shift', sql`(${t.shiftMode} = 'fixed') = (${t.fixedShiftId} is not null)`),
  ],
).enableRLS();

export const positionShifts = pgTable(
  'position_shifts',
  {
    positionId: uuid('position_id')
      .notNull()
      .references(() => positions.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
  },
  (t) => [primaryKey({ columns: [t.positionId, t.shiftId] })],
).enableRLS();

export const positionLocations = pgTable(
  'position_locations',
  {
    positionId: uuid('position_id')
      .notNull()
      .references(() => positions.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.positionId, t.locationId] })],
).enableRLS();

export const employees = pgTable(
  'employees',
  {
    id: id(),
    companyId: companyId(),
    /** Luôn lưu chữ thường để đăng nhập không phân biệt hoa thường. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    pinHash: text('pin_hash').notNull(),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    lockedUntil: timestamptz('locked_until'),
    status: employeeStatusEnum('status').notNull().default('active'),
    leftDate: date('left_date'),
    contract: contractTypeEnum('contract').notNull().default('full_time'),
    onboardDate: date('onboard_date').notNull(),
    role: roleEnum('role').notNull().default('app'),
    managerId: uuid('manager_id').references((): AnyPgColumn => employees.id),
    positionId: uuid('position_id').references(() => positions.id),
    payOverride: jsonb('pay_override').$type<PayOverride>(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('employees_company_email_unique').on(t.companyId, t.email),
    index('employees_manager_idx').on(t.managerId),
    check('employees_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('employees_left_date', sql`(${t.status} = 'left') = (${t.leftDate} is not null)`),
  ],
).enableRLS();

export const employeeShifts = pgTable(
  'employee_shifts',
  {
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.shiftId] })],
).enableRLS();

export const employeeLocations = pgTable(
  'employee_locations',
  {
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.locationId] })],
).enableRLS();

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    companyId: companyId(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    kind: sessionKindEnum('kind').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_employee_idx').on(t.employeeId)],
).enableRLS();

export const holidays = pgTable(
  'holidays',
  {
    id: id(),
    companyId: companyId(),
    date: date('date').notNull(),
    name: text('name').notNull(),
  },
  (t) => [unique('holidays_company_date_unique').on(t.companyId, t.date)],
).enableRLS();

export const scheduleCells = pgTable(
  'schedule_cells',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    date: date('date').notNull(),
    shiftIds: uuid('shift_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    isOff: boolean('is_off').notNull().default(false),
  },
  (t) => [
    unique('schedule_cells_employee_date_unique').on(t.employeeId, t.date),
    index('schedule_cells_company_date_idx').on(t.companyId, t.date),
  ],
).enableRLS();

export const requests = pgTable(
  'requests',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    type: requestTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    reason: text('reason'),
    status: requestStatusEnum('status').notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => employees.id),
    decidedAt: timestamptz('decided_at'),
    rejectNote: text('reject_note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('requests_company_status_idx').on(t.companyId, t.status),
    index('requests_employee_from_idx').on(t.employeeId, t.fromDate),
  ],
).enableRLS();

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    at: timestamptz('at').notNull(),
    type: punchTypeEnum('type').notNull(),
    chosenShiftId: uuid('chosen_shift_id').references(() => shifts.id),
    // Toạ độ để trống với lần chấm tổng hợp từ đơn quên chấm
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    accuracyM: doublePrecision('accuracy_m'),
    inZone: boolean('in_zone'),
    distanceM: doublePrecision('distance_m'),
    locationId: uuid('location_id').references(() => locations.id),
    synthetic: boolean('synthetic').notNull().default(false),
    sourceRequestId: uuid('source_request_id').references(() => requests.id),
  },
  (t) => [
    index('attendance_logs_employee_at_idx').on(t.employeeId, t.at),
    index('attendance_logs_company_at_idx').on(t.companyId, t.at),
  ],
).enableRLS();

export const explanations = pgTable(
  'explanations',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    date: date('date').notNull(),
    shiftId: uuid('shift_id').references(() => shifts.id),
    reason: text('reason').notNull(),
    status: requestStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('explanations_employee_date_shift_unique').on(t.employeeId, t.date, t.shiftId).nullsNotDistinct(),
  ],
).enableRLS();

export const approvals = pgTable(
  'approvals',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    date: date('date').notNull(),
    shiftId: uuid('shift_id').references(() => shifts.id),
    /** NULL = theo hệ thống. */
    congOverride: cong('cong_override'),
    /** NULL = không đổi; 0 = không tính OT. */
    otMinutes: integer('ot_minutes'),
    approveMissing: boolean('approve_missing').notNull().default(false),
    waiveLate: boolean('waive_late').notNull().default(false),
    waiveEarly: boolean('waive_early').notNull().default(false),
    confirmShiftId: uuid('confirm_shift_id').references(() => shifts.id),
    approveGps: boolean('approve_gps').notNull().default(false),
    note: text('note'),
    by: uuid('by')
      .notNull()
      .references(() => employees.id),
    at: timestamptz('at').notNull().defaultNow(),
    /** Hoàn duyệt: giữ dòng để truy vết, chỉ dòng chưa thu hồi mới có hiệu lực. */
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    // Index thay cho unique NULLS NOT DISTINCT vì Drizzle chưa hỗ trợ tuỳ chọn này trên index
    uniqueIndex('approvals_active_unique')
      .on(t.employeeId, t.date, sql`coalesce(${t.shiftId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`${t.revokedAt} is null`),
  ],
).enableRLS();

export const dayRecords = pgTable(
  'day_records',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    date: date('date').notNull(),
    shiftId: uuid('shift_id').references(() => shifts.id),
    status: dayStatusEnum('status').notNull(),
    inAt: timestamptz('in_at'),
    outAt: timestamptz('out_at'),
    workedMin: integer('worked_min').notNull().default(0),
    cong: cong('cong').notNull().default(0),
    expectedCong: cong('expected_cong').notNull().default(0),
    lateMin: integer('late_min').notNull().default(0),
    earlyMin: integer('early_min').notNull().default(0),
    waivedLate: boolean('waived_late').notNull().default(false),
    waivedEarly: boolean('waived_early').notNull().default(false),
    otProposed: integer('ot_proposed').notNull().default(0),
    otApproved: integer('ot_approved').notNull().default(0),
    otState: otStateEnum('ot_state').notNull().default('none'),
    missing: integer('missing').notNull().default(0),
    offDay: boolean('off_day').notNull().default(false),
    isHoliday: boolean('is_holiday').notNull().default(false),
    flags: text('flags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    needsReview: boolean('needs_review').notNull().default(false),
    suggestion: jsonb('suggestion'),
    notes: jsonb('notes').notNull().default([]),
    computedAt: timestamptz('computed_at').notNull().defaultNow(),
  },
  (t) => [
    unique('day_records_employee_date_shift_unique').on(t.employeeId, t.date, t.shiftId).nullsNotDistinct(),
    index('day_records_company_date_idx').on(t.companyId, t.date),
  ],
).enableRLS();

export const adjustments = pgTable(
  'adjustments',
  {
    id: id(),
    companyId: companyId(),
    periodKey: text('period_key').notNull(),
    employeeId: employeeId(),
    kind: adjustmentKindEnum('kind').notNull(),
    amount: money('amount').notNull(),
    note: text('note').notNull(),
    by: uuid('by')
      .notNull()
      .references(() => employees.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('adjustments_company_period_idx').on(t.companyId, t.periodKey),
    check('adjustments_amount_positive', sql`${t.amount} > 0`),
  ],
).enableRLS();

export const payrollPeriods = pgTable(
  'payroll_periods',
  {
    id: id(),
    companyId: companyId(),
    periodKey: text('period_key').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamptz('published_at'),
    publishedBy: uuid('published_by').references(() => employees.id),
    stale: boolean('stale').notNull().default(false),
  },
  (t) => [unique('payroll_periods_company_key_unique').on(t.companyId, t.periodKey)],
).enableRLS();

export const payslips = pgTable(
  'payslips',
  {
    id: id(),
    companyId: companyId(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => payrollPeriods.id),
    employeeId: employeeId(),
    net: money('net').notNull(),
    lines: jsonb('lines').notNull(),
    summary: jsonb('summary').notNull(),
    publishedAt: timestamptz('published_at').notNull(),
  },
  (t) => [unique('payslips_period_employee_unique').on(t.periodId, t.employeeId)],
).enableRLS();

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    companyId: companyId(),
    employeeId: employeeId(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Tab cần mở trong app nhân viên. */
    href: text('href').notNull(),
    readAt: timestamptz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_employee_created_idx').on(t.employeeId, t.createdAt)],
).enableRLS();

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    companyId: companyId(),
    /** NULL = hệ thống. */
    actorId: uuid('actor_id').references(() => employees.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [index('audit_logs_company_at_idx').on(t.companyId, t.at)],
).enableRLS();
