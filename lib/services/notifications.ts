import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { writeAudit, type Tx } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { notifications } from '@/lib/db/schema';
import type { NotificationReadInput } from '@/lib/validation/notification';
import { actorOf } from './actor';

const LIST_LIMIT = 50;

export type NewNotification = {
  companyId: string;
  employeeId: string;
  kind: 'request' | 'schedule' | 'payslip';
  title: string;
  body: string;
  /** Tab cần mở trong app nhân viên. */
  href: string;
};

/** Ghi trong cùng transaction với việc gây ra nó: việc rollback thì không có thông báo báo sai. */
export async function notify(tx: Tx, rows: readonly NewNotification[]) {
  if (rows.length > 0) await tx.insert(notifications).values([...rows]);
}

/** Chỉ lọc theo phiên nên không đọc được thông báo của người khác. */
export async function listMyNotifications(ctx: AuthContext) {
  const db = getDb();
  const mine = eq(notifications.employeeId, ctx.employee.id);
  const [rows, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(mine)
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt))),
  ]);
  return { notifications: rows, unread: unread?.total ?? 0 };
}

export type NotificationView = Awaited<ReturnType<typeof listMyNotifications>>['notifications'][number];

/** Không truyền `ids` là đánh dấu tất cả; id của người khác không có tác dụng. */
export async function markNotificationsRead(ctx: AuthContext, { ids }: NotificationReadInput) {
  await getDb().transaction(async (tx) => {
    const updated = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.employeeId, ctx.employee.id),
          isNull(notifications.readAt),
          ids ? inArray(notifications.id, ids) : undefined,
        ),
      )
      .returning({ id: notifications.id });
    if (updated.length === 0) return;
    await writeAudit(tx, actorOf(ctx), {
      action: 'notification.read',
      entity: 'notification',
      after: { count: updated.length },
    });
  });
}
