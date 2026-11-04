import 'server-only';
import { and, between, eq, inArray } from 'drizzle-orm';
import { writeAudit } from '@/lib/audit';
import { scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { requests, scheduleDrafts } from '@/lib/db/schema';
import { addDays } from '@/lib/engine/time';
import { formatDate } from '@/lib/format';
import type { ScheduleWeekInput } from '@/lib/validation/schedule';
import { actorOf } from './actor';
import { canDecideOwn } from './approvals';
import { lockEmployees, recomputeDays } from './recompute';
import { applyDecision } from './requests';
import { assertCellsAllowed, notifyScheduleChange, writeCells } from './schedule';

const WEEK_DAYS = 7;

function draftsOfWeek(ctx: AuthContext, week: string) {
  return and(
    scopeToStaff(ctx, { companyId: scheduleDrafts.companyId, employeeId: scheduleDrafts.employeeId }),
    between(scheduleDrafts.date, week, addDays(week, WEEK_DAYS - 1)),
  );
}

/**
 * Công bố nháp của tuần đang xem, chỉ của người mình quản lý: chép vào lịch thật, tính lại ngày công,
 * chuyển đăng ký đã nhận vào nháp sang Đã nhận. Mỗi người nhận một thông báo gộp.
 */
export async function publishSchedule(ctx: AuthContext, { week }: ScheduleWeekInput) {
  const companyId = ctx.company.id;
  return getDb().transaction(async (tx) => {
    const owners = await tx
      .select({ employeeId: scheduleDrafts.employeeId })
      .from(scheduleDrafts)
      .where(draftsOfWeek(ctx, week));
    if (owners.length === 0) return { cells: 0, people: 0, registrations: 0 };

    await lockEmployees(
      tx,
      owners.map(({ employeeId }) => employeeId),
    );
    const drafts = await tx.select().from(scheduleDrafts).where(draftsOfWeek(ctx, week)).for('update');
    const cells = drafts.map(({ employeeId, date, shiftIds, isOff, positions }) => ({
      employeeId,
      date,
      shiftIds,
      isOff,
      positions,
    }));
    // Từ lúc lưu nháp tới giờ có thể đã đổi vị trí, ca được làm hoặc cho nghỉ việc
    await assertCellsAllowed(tx, ctx, cells);
    const { changed } = await writeCells(tx, ctx, cells, { silent: true });

    const linked = drafts.flatMap(({ registrationIds }) => registrationIds);
    const pending =
      linked.length === 0
        ? []
        : await tx
            .select()
            .from(requests)
            .where(
              and(
                inArray(requests.id, linked),
                eq(requests.type, 'shift_register'),
                eq(requests.status, 'pending'),
              ),
            )
            .for('update');
    const ownAllowed = await canDecideOwn(tx, ctx);
    const accepted = new Map<string, number>();
    for (const request of pending) {
      if (request.employeeId === ctx.employee.id && !ownAllowed) continue;
      await applyDecision(tx, ctx, request, 'approve', null);
      accepted.set(request.employeeId, (accepted.get(request.employeeId) ?? 0) + 1);
    }

    const people = [...new Set(cells.map(({ employeeId }) => employeeId))];
    for (const employeeId of people) {
      const dates = cells
        .filter((cell) => cell.employeeId === employeeId)
        .map(({ date }) => date)
        .sort();
      await recomputeDays(tx, {
        companyId,
        employeeIds: [employeeId],
        from: dates[0]!,
        to: addDays(dates[dates.length - 1]!, 1),
      });
    }

    const range = `${formatDate(week).slice(0, 5)} – ${formatDate(addDays(week, WEEK_DAYS - 1)).slice(0, 5)}`;
    await notifyScheduleChange(
      tx,
      ctx,
      changed,
      `Lịch tuần ${range} đã công bố`,
      new Map([...accepted].map(([employeeId, total]) => [employeeId, `Nhận ${total} ca đăng ký`])),
    );
    const registrations = [...accepted.values()].reduce((sum, total) => sum + total, 0);
    await writeAudit(tx, actorOf(ctx), {
      action: 'schedule.publish',
      entity: 'schedule',
      after: { week, cells: cells.length, people: people.length, registrations },
    });
    return { cells: cells.length, people: people.length, registrations };
  });
}

/** Bỏ nháp của tuần: lịch quay về bản đã công bố, đăng ký đã nhận vào nháp quay về chờ nhận. */
export async function discardDrafts(ctx: AuthContext, { week }: ScheduleWeekInput) {
  return getDb().transaction(async (tx) => {
    const removed = await tx.delete(scheduleDrafts).where(draftsOfWeek(ctx, week)).returning();
    if (removed.length > 0) {
      await writeAudit(tx, actorOf(ctx), {
        action: 'schedule.discard',
        entity: 'schedule',
        before: { cells: removed },
        after: { week },
      });
    }
    return { cells: removed.length };
  });
}
