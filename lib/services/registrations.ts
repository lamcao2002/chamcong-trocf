import 'server-only';
import { and, asc, between, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { writeAudit } from '@/lib/audit';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { employees, requests, shifts } from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { formatClock, formatDate } from '@/lib/format';
import { addDays, weekDay } from '@/lib/engine/time';
import type { RegistrationDecisionInput, RegistrationInput } from '@/lib/validation/request';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { notify } from './notifications';
import { loadEmployeeRules, lockEmployees, recomputeDays } from './recompute';
import { applyDecision } from './requests';
import { allowedShiftIds, expectedShiftIds, firstDraftDate } from './schedule';
import { acceptIntoDraft } from './schedule-drafts';
import { currentRegistrationWindow } from './registration-window';

const WEEK_DAYS = 7;

const weekDates = (monday: string) => Array.from({ length: WEEK_DAYS }, (_, index) => addDays(monday, index));

/** "07:00 Thứ Năm 05/11", cho câu báo đợt đăng ký. */
const windowTime = (at: Date) => {
  const date = vietnamToday(at);
  return `${formatClock(at)} ${WEEKDAY_NAMES[weekDay(date)]} ${formatDate(date).slice(0, 5)}`;
};

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const cellKey = (date: string, shiftId: unknown) => `${date}|${String(shiftId)}`;

/** Đơn đăng ký còn hiệu lực của một người, theo ô ngày × ca. */
function activeRegistrations(
  db: Pick<ReturnType<typeof getDb>, 'select'>,
  employeeId: string,
  dates: string[],
) {
  return db
    .select({ id: requests.id, date: requests.fromDate, payload: requests.payload, status: requests.status })
    .from(requests)
    .where(
      and(
        eq(requests.employeeId, employeeId),
        eq(requests.type, 'shift_register'),
        inArray(requests.status, ['pending', 'approved']),
        between(requests.fromDate, dates[0]!, dates[dates.length - 1]!),
      ),
    );
}

/** Lưới tuần sau: chỉ người ca linh hoạt mới đăng ký, ca cố định không cần xếp lịch (EMP-12). */
export async function getMyRegistration(ctx: AuthContext) {
  const db = getDb();
  const employeeId = ctx.employee.id;
  const window = currentRegistrationWindow();
  const dates = weekDates(window.week);
  const [rules, library, [person]] = await Promise.all([
    loadEmployeeRules(db, [employeeId]),
    db
      .select({
        id: shifts.id,
        code: shifts.code,
        name: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(shifts)
      .where(scopeToCompany(ctx, shifts.companyId))
      .orderBy(asc(shifts.startTime), asc(shifts.code)),
    db.select({ positionId: employees.positionId }).from(employees).where(eq(employees.id, employeeId)),
  ]);
  if (rules.get(employeeId)?.shiftMode !== 'flexible') return null;

  const allowed = await allowedShiftIds(db, [{ id: employeeId, positionId: person?.positionId ?? null }]);
  const [active, scheduled] = await Promise.all([
    activeRegistrations(db, employeeId, dates),
    Promise.all(dates.map((date) => expectedShiftIds(db, ctx, employeeId, date))),
  ]);
  const taken = new Map(
    active.map(({ id, date, payload }) => [cellKey(date, (payload as { shiftId: string }).shiftId), id]),
  );

  return {
    /** Ngoài giờ mở thì chỉ xem; ô đã gửi bỏ được khi còn mở (xoá đơn qua `/app/requests/:id`). */
    window: {
      open: window.open,
      opensAt: window.opensAt.toISOString(),
      closesAt: window.closesAt.toISOString(),
      text: `Mở từ ${windowTime(window.opensAt)} tới ${windowTime(window.closesAt)}`,
    },
    dates,
    shifts: library
      .filter(({ id }) => allowed.get(employeeId)?.includes(id))
      .map((shift) => ({
        ...shift,
        startTime: shift.startTime.slice(0, 5),
        endTime: shift.endTime.slice(0, 5),
      })),
    /** `scheduled` thắng `pending`: đơn đã nhận thì ô đó đã nằm trong lịch. */
    cells: dates.flatMap((date, index) =>
      library.flatMap(({ id }) => {
        const state = scheduled[index]!.includes(id)
          ? ('scheduled' as const)
          : taken.has(cellKey(date, id))
            ? ('pending' as const)
            : null;
        const requestId = state === 'pending' ? (taken.get(cellKey(date, id)) ?? null) : null;
        return state ? [{ date, shiftId: id, state, requestId }] : [];
      }),
    ),
  };
}

export type RegistrationView = NonNullable<Awaited<ReturnType<typeof getMyRegistration>>>;

/** Gửi đăng ký: ô đã gửi hoặc đã có trong lịch được bỏ qua, nên bấm Gửi hai lần không tạo trùng. */
export async function saveRegistration(ctx: AuthContext, { items, note }: RegistrationInput) {
  const companyId = ctx.company.id;
  const employeeId = ctx.employee.id;
  const window = currentRegistrationWindow();
  if (!window.open) {
    throw new ApiError(
      409,
      `Đăng ký ca tuần sau mở từ ${windowTime(window.opensAt)} tới ${windowTime(window.closesAt)}`,
    );
  }
  const dates = weekDates(window.week);

  return getDb().transaction(async (tx) => {
    await lockEmployees(tx, [employeeId]);
    const rules = await loadEmployeeRules(tx, [employeeId]);
    const rule = rules.get(employeeId);
    if (rule?.shiftMode !== 'flexible') throw new ApiError(409, 'Ca cố định không cần đăng ký ca');
    if (items.some(({ date }) => !dates.includes(date))) {
      throw new ApiError(400, 'Chỉ đăng ký được ca của tuần sau');
    }

    const [person] = await tx
      .select({ positionId: employees.positionId })
      .from(employees)
      .where(eq(employees.id, employeeId));
    const allowed = await allowedShiftIds(tx, [{ id: employeeId, positionId: person?.positionId ?? null }]);
    if (items.some(({ shiftId }) => !allowed.get(employeeId)?.includes(shiftId))) {
      throw new ApiError(400, 'Có ca không nằm trong ca bạn được làm');
    }

    const active = await activeRegistrations(tx, employeeId, dates);
    const taken = new Set(
      active.map(({ date, payload }) => cellKey(date, (payload as { shiftId: string }).shiftId)),
    );
    const fresh = [];
    for (const item of items) {
      const scheduled = await expectedShiftIds(tx, ctx, employeeId, item.date);
      if (!taken.has(cellKey(item.date, item.shiftId)) && !scheduled.includes(item.shiftId)) fresh.push(item);
    }

    if (fresh.length > 0) {
      await tx.insert(requests).values(
        fresh.map(({ date, shiftId }) => ({
          companyId,
          employeeId,
          type: 'shift_register' as const,
          payload: { shiftId },
          fromDate: date,
          toDate: date,
          reason: note || 'Đăng ký từ app',
        })),
      );
      await writeAudit(tx, actorOf(ctx), {
        action: 'request.register',
        entity: 'request',
        after: { items: fresh },
      });
    }
    return { sent: fresh.length, skipped: items.length - fresh.length };
  });
}

/**
 * Nhận hoặc từ chối nhiều ô; ô đã có người xử lý được bỏ qua. Nhận ca từ ngày mai trở đi chỉ vào nháp,
 * Công bố mới báo cho nhân viên; còn lại mỗi người nhận một thông báo gộp.
 */
export async function decideRegistrations(
  ctx: AuthContext,
  { ids, decision, note, positionId }: RegistrationDecisionInput,
) {
  const companyId = ctx.company.id;
  const firstDraft = firstDraftDate();
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(requests)
      .where(
        and(
          inArray(requests.id, ids),
          eq(requests.type, 'shift_register'),
          eq(requests.status, 'pending'),
          scopeToStaff(ctx, { companyId: requests.companyId, employeeId: requests.employeeId }),
        ),
      )
      .orderBy(asc(requests.fromDate))
      .for('update');

    const employeeIds = [...new Set(rows.map(({ employeeId }) => employeeId))];
    await lockEmployees(tx, employeeIds);
    for (const employeeId of employeeIds) await assertCanDecide(tx, ctx, employeeId);

    const approve = decision === 'approve';
    const toDraft = approve ? rows.filter(({ fromDate }) => fromDate >= firstDraft) : [];
    const decided = rows.filter((row) => !toDraft.includes(row));
    for (const request of toDraft) await acceptIntoDraft(tx, ctx, request, positionId ?? null);
    for (const request of decided) await applyDecision(tx, ctx, request, decision, note ?? null);

    for (const employeeId of new Set(decided.map((row) => row.employeeId))) {
      const dates = decided.filter((row) => row.employeeId === employeeId).map(({ fromDate }) => fromDate);
      if (approve) {
        await recomputeDays(tx, {
          companyId,
          employeeIds: [employeeId],
          from: dates[0]!,
          to: addDays(dates[dates.length - 1]!, 1),
        });
      }
      await notify(tx, [
        {
          companyId,
          employeeId,
          kind: 'schedule',
          title: approve ? 'Đăng ký ca đã được nhận' : 'Đăng ký ca bị từ chối',
          body: [
            [...new Set(dates)].map((date) => formatDate(date).slice(0, 5)).join(', '),
            ...(note ? [note] : []),
          ].join(' · '),
          href: '#/lich',
        },
      ]);
    }
    return { decided: decided.length, drafted: toDraft.length, skipped: ids.length - rows.length };
  });
}
