import 'server-only';
import { and, eq, gte, lte } from 'drizzle-orm';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { companies, requests, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { nextPeriod, periodByKey, periodOf, previousPeriod } from '@/lib/domain/period';
import { shiftSpanMinutes, toMinutes } from '@/lib/domain/shift';
import { addDays, atMinute, minuteOfDay } from '@/lib/engine/time';
import type { Suggestion } from '@/lib/engine/types';
import { formatDecimal } from '@/lib/format';
import { canDecideOwn } from './approvals';
import { readDayRecords, staffInScope, type DayView } from './day';

/** Quá mốc này sau giờ vào ca mà chưa chấm thì tính là Chưa chấm công (US23). */
const MISSING_AFTER_MINUTES = 15;

export type InboxKind = 'vang' | 'thieu_gio' | 'sai_ca' | 'ngoai_vung' | 'ngoai_lich' | 'ot_cho' | 'don';

const KIND_LABELS: Record<InboxKind, string> = {
  vang: 'Vắng',
  thieu_gio: 'Thiếu giờ',
  sai_ca: 'Sai ca',
  ngoai_vung: 'Ngoài vùng',
  ngoai_lich: 'Ngoài lịch',
  ot_cho: 'OT chờ duyệt',
  don: 'Đơn',
};

type FlagKind = { flag: string; kind: InboxKind; suggestion?: Suggestion['kind']; text: string };

/** Mỗi cờ cần duyệt là một việc; cờ thiếu vào và thiếu ra gộp một loại. */
const FLAG_KINDS: FlagKind[] = [
  { flag: 'vang', kind: 'vang', text: 'Có ca nhưng không có lần chấm nào' },
  { flag: 'thieu_vao', kind: 'thieu_gio', suggestion: 'approve_cong', text: 'Thiếu lần vào' },
  { flag: 'thieu_ra', kind: 'thieu_gio', suggestion: 'approve_cong', text: 'Thiếu lần ra' },
  { flag: 'sai_ca', kind: 'sai_ca', suggestion: 'confirm_shift', text: 'Ca đã chọn khác ca khớp giờ' },
  { flag: 'gps', kind: 'ngoai_vung', suggestion: 'approve_gps', text: 'Có lần chấm ngoài vùng' },
  { flag: 'ngoai_lich', kind: 'ngoai_lich', suggestion: 'approve_shift', text: 'Chấm khi không có ca' },
  { flag: 'ot_cho', kind: 'ot_cho', suggestion: 'approve_ot', text: 'Có OT đề xuất chưa duyệt' },
];

const LEAVE_LABELS: Record<string, string> = {
  annual: 'Phép năm',
  sick: 'Nghỉ ốm',
  unpaid: 'Không lương',
};

function requestSummary(type: string, payload: Record<string, unknown>): string {
  if (type === 'leave')
    return `Nghỉ phép · ${LEAVE_LABELS[String(payload.leaveType)] ?? ''} · ${formatDecimal(Number(payload.days))} ngày`;
  if (type === 'forgot')
    return `Quên chấm · vào ${String(payload.inTime ?? '—')}, ra ${String(payload.outTime ?? '—')}`;
  return `Làm thêm ${String(payload.from)}–${String(payload.to)}`;
}

export type ApprovableItem = { key: string; label: string; otMinutes: number };

/** Việc của một dòng ngày công duyệt được theo đề xuất; Bảng công chọn ô bằng đúng các khoá này. */
export function approvableItems(
  record: Pick<DayView, 'employeeId' | 'date' | 'shiftId' | 'flags' | 'suggestions'>,
): ApprovableItem[] {
  return FLAG_KINDS.filter(({ flag }) => record.flags.includes(flag)).flatMap(({ flag, suggestion }) => {
    const proposal = record.suggestions.find((row) => row.kind === suggestion);
    if (!proposal) return [];
    return [
      {
        key: itemKey(record, flag),
        label: proposal.label,
        otMinutes: proposal.otMinutes ?? 0,
      },
    ];
  });
}

const itemKey = (
  { employeeId, date, shiftId }: Pick<DayView, 'employeeId' | 'date' | 'shiftId'>,
  flag: string,
) => `${employeeId}|${date}|${shiftId ?? ''}|${flag}`;

type ShiftClock = { id: string; name: string; startTime: string; endTime: string };

/** Việc từ một dòng ngày công; khoá không dùng `day_records.id` vì id đổi sau mỗi lần tính lại. */
function recordItems(
  record: DayView,
  employee: { name: string; positionName: string | null },
  library: readonly ShiftClock[],
) {
  const shift = library.find(({ id }) => id === record.shiftId);
  const start = shift ? toMinutes(shift.startTime) : null;
  return FLAG_KINDS.filter(({ flag }) => record.flags.includes(flag)).map(
    ({ flag, kind, suggestion, text }) => {
      const proposal = record.suggestions.find((row) => row.kind === suggestion) ?? null;
      return {
        key: itemKey(record, flag),
        kind,
        kindLabel: KIND_LABELS[kind],
        employeeId: record.employeeId,
        employeeName: employee.name,
        positionName: employee.positionName,
        date: record.date,
        toDate: record.date,
        shiftId: record.shiftId,
        shiftName: shift?.name ?? null,
        description: text,
        suggestion: proposal,
        evidence: record.notes,
        inAt: record.inAt,
        outAt: record.outAt,
        shiftStartAt: start === null ? null : atMinute(record.date, start),
        shiftEndAt: start === null ? null : atMinute(record.date, start + shiftSpanMinutes(shift!)),
        requestId: null as string | null,
        /** OT đã duyệt là con số tổng, gồm cả phần đơn làm thêm đã duyệt sẵn. */
        otProposed: record.otProposed,
      };
    },
  );
}

export type InboxItem = ReturnType<typeof recordItems>[number];

/** Việc cần xử lý của một kỳ: dòng ngày công có cờ và đơn đang chờ (US24, US33). */
export async function getInbox(ctx: AuthContext, periodKey?: string, now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const [company] = await db
    .select({ cutoffDay: companies.cutoffDay })
    .from(companies)
    .where(eq(companies.id, ctx.company.id));
  const cutoffDay = company?.cutoffDay ?? null;
  const period = periodKey ? periodByKey(periodKey, cutoffDay) : periodOf(today, cutoffDay);
  const next = nextPeriod(period, cutoffDay);
  return {
    period,
    /** Đầu tháng quản lý vẫn cần xử lý tồn của kỳ trước, nên phải chuyển kỳ được. */
    previousKey: previousPeriod(period, cutoffDay).key,
    nextKey: next.from <= today ? next.key : null,
    ...(await inboxBetween(ctx, period.from, period.to, now)),
  };
}

export type InboxView = Awaited<ReturnType<typeof getInbox>>;

/** Việc trong một khoảng ngày; duyệt hàng loạt từ Bảng công dùng được cả khoảng không trùng kỳ lương. */
export async function inboxBetween(ctx: AuthContext, from: string, to: string, now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const [allStaff, library, ownAllowed] = await Promise.all([
    staffInScope(ctx, from),
    db
      .select({ id: shifts.id, name: shifts.name, startTime: shifts.startTime, endTime: shifts.endTime })
      .from(shifts)
      .where(scopeToCompany(ctx, shifts.companyId)),
    canDecideOwn(db, ctx),
  ]);
  const staff = ownAllowed ? allStaff : allStaff.filter(({ id }) => id !== ctx.employee.id);
  const ids = staff.map(({ id }) => id);

  const [records, pending] = await Promise.all([
    readDayRecords(db, ctx.company.id, ids, from, to < today ? to : today, now),
    db
      .select()
      .from(requests)
      .where(
        and(
          scopeToStaff(ctx, { companyId: requests.companyId, employeeId: requests.employeeId }),
          eq(requests.status, 'pending'),
          lte(requests.fromDate, to),
          gte(requests.toDate, from),
        ),
      ),
  ]);

  const dayItems = records.flatMap((record) => {
    const employee = staff.find(({ id }) => id === record.employeeId);
    return employee ? recordItems(record, employee, library) : [];
  });
  const requestItems = pending.flatMap((request): InboxItem[] => {
    const employee = staff.find(({ id }) => id === request.employeeId);
    if (!employee) return [];
    return [
      {
        key: `request|${request.id}`,
        kind: 'don',
        kindLabel: KIND_LABELS.don,
        employeeId: request.employeeId,
        employeeName: employee.name,
        positionName: employee.positionName,
        date: request.fromDate,
        toDate: request.toDate,
        shiftId: null,
        shiftName: null,
        description: requestSummary(request.type, request.payload as Record<string, unknown>),
        suggestion: null,
        evidence: request.reason ? [`Lý do: ${request.reason}`] : [],
        inAt: null,
        outAt: null,
        shiftStartAt: null,
        shiftEndAt: null,
        requestId: request.id,
        otProposed: 0,
      },
    ];
  });

  const items = [...dayItems, ...requestItems].sort(
    (a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName),
  );
  const counts = items.reduce<Partial<Record<InboxKind, number>>>((all, { kind }) => {
    all[kind] = (all[kind] ?? 0) + 1;
    return all;
  }, {});

  return { total: items.length, counts, items };
}

/** 4 thẻ số hôm nay (US23); tính tại chỗ vì đổi theo đồng hồ. */
export async function getOverview(ctx: AuthContext, pending: number, now: Date = new Date()) {
  const db = getDb();
  const today = vietnamToday(now);
  const yesterday = addDays(today, -1);
  const [staff, library] = await Promise.all([
    staffInScope(ctx, yesterday),
    db
      .select({ id: shifts.id, startTime: shifts.startTime })
      .from(shifts)
      .where(scopeToCompany(ctx, shifts.companyId)),
  ]);
  const records = await readDayRecords(
    db,
    ctx.company.id,
    staff.map(({ id }) => id),
    yesterday,
    today,
    now,
  );

  const todayRecords = records.filter(({ date }) => date === today);
  const nowMinute = minuteOfDay(now, today);
  const startMinute = (shiftId: string | null) => {
    const shift = library.find(({ id }) => id === shiftId);
    return shift ? toMinutes(shift.startTime) : null;
  };
  const distinct = (rows: DayView[]) => new Set(rows.map(({ employeeId }) => employeeId)).size;
  const scheduled = todayRecords.filter(
    ({ shiftId, status }) => shiftId !== null && !['nghi_phep', 'le', 'ngoai_lich'].includes(status),
  );

  return {
    /** Gồm cả ca đêm bắt đầu từ hôm qua. */
    onShift: distinct(records.filter(({ status }) => status === 'dang_lam')),
    scheduled: distinct(scheduled),
    late: distinct(todayRecords.filter(({ lateMin, waivedLate }) => lateMin > 0 && !waivedLate)),
    missing: distinct(
      todayRecords.filter(({ status, shiftId }) => {
        if (status === 'vang') return true;
        const start = startMinute(shiftId);
        return status === 'chua_toi' && start !== null && nowMinute >= start + MISSING_AFTER_MINUTES;
      }),
    ),
    pending,
  };
}

export type OverviewView = Awaited<ReturnType<typeof getOverview>>;
