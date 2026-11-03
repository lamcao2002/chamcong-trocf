import 'server-only';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import { writeAudit, type Tx } from '@/lib/audit';
import { generateDeviceToken, hashDeviceToken } from '@/lib/auth/device';
import { canEditEmployee, scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { companies, employees, sessions } from '@/lib/db/schema';
import { actorOf } from './actor';

const OTHER_DEVICE = 'Tài khoản này đã gắn với điện thoại khác. Nhờ Nhân sự Mở khoá máy rồi chấm lại.';
const SHARED_DEVICE = 'Điện thoại này đã gắn với tài khoản khác. Mỗi người chấm công trên máy của mình.';

export type DeviceCheck = {
  token: string;
  /** Tài khoản chưa gắn máy: lần chấm này sẽ gắn. */
  bind: boolean;
};

/**
 * Kiểm tra máy trước khi chấm (SH-27); công ty tắt tính năng thì trả null. Chỉ chặn ở bước chấm: Safari
 * và app đã cài trên iPhone không chung cookie, gắn lúc đăng nhập sẽ khoá người dùng khỏi chính app của họ.
 */
export async function checkPunchDevice(
  ctx: AuthContext,
  token: string | undefined,
): Promise<DeviceCheck | null> {
  const blocked = await getDb().transaction(async (tx) => {
    const [company] = await tx
      .select({ deviceBinding: companies.deviceBinding })
      .from(companies)
      .where(eq(companies.id, ctx.company.id));
    if (!company?.deviceBinding) return { check: null, reason: null };

    const [employee] = await tx
      .select({ deviceHash: employees.deviceHash })
      .from(employees)
      .where(eq(employees.id, ctx.employee.id));
    const current = token ?? generateDeviceToken();
    const hash = hashDeviceToken(current);
    if (employee?.deviceHash === hash) return { check: { token: current, bind: false }, reason: null };

    let reason: string | null = employee?.deviceHash ? OTHER_DEVICE : null;
    if (!reason) {
      const [owner] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, ctx.company.id),
            eq(employees.deviceHash, hash),
            ne(employees.id, ctx.employee.id),
          ),
        );
      if (owner) reason = SHARED_DEVICE;
    }
    if (!reason) return { check: { token: current, bind: true }, reason: null };

    // Ghi trước khi báo lỗi: quản lý cần thấy các lần bị chặn để biết có người thử chấm hộ
    await writeAudit(tx, actorOf(ctx), {
      action: 'device.blocked',
      entity: 'employee',
      entityId: ctx.employee.id,
      after: { reason },
    });
    return { check: null, reason };
  });

  if (blocked.reason) throw new ApiError(403, blocked.reason);
  return blocked.check;
}

/** Gắn trong cùng transaction với lần chấm: chấm lỗi mà đã gắn thì máy không có cookie, tự khoá mình. */
export async function bindDevice(tx: Tx, ctx: AuthContext, token: string) {
  try {
    const bound = await tx
      .update(employees)
      .set({ deviceHash: hashDeviceToken(token), deviceBoundAt: new Date() })
      .where(and(eq(employees.id, ctx.employee.id), isNull(employees.deviceHash)))
      .returning({ id: employees.id });
    if (bound.length === 0) throw new ApiError(409, 'Vừa có máy khác gắn tài khoản này, hãy thử lại');
  } catch (error) {
    throw isUniqueViolation(error) ? new ApiError(403, SHARED_DEVICE) : error;
  }
  await writeAudit(tx, actorOf(ctx), {
    action: 'device.bind',
    entity: 'employee',
    entityId: ctx.employee.id,
  });
}

/** Gỡ máy và đăng xuất app trên mọi máy, phòng khi điện thoại cũ bị mất (SH-28). */
export async function unlockDevice(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select({ id: employees.id, role: employees.role, deviceBoundAt: employees.deviceBoundAt })
      .from(employees)
      .where(and(eq(employees.id, id), scopeToCompany(ctx, employees.companyId)))
      .for('update');
    if (!before) throw notFound('nhân viên');
    if (!canEditEmployee(ctx.employee, before)) throw new ApiError(403, 'Bạn không được sửa Quản trị viên');
    if (!before.deviceBoundAt) throw new ApiError(409, 'Nhân viên này chưa gắn máy nào');

    await tx.update(employees).set({ deviceHash: null, deviceBoundAt: null }).where(eq(employees.id, id));
    await tx.delete(sessions).where(and(eq(sessions.employeeId, id), eq(sessions.kind, 'app')));
    await writeAudit(tx, actorOf(ctx), {
      action: 'device.unlock',
      entity: 'employee',
      entityId: id,
      before: { deviceBoundAt: before.deviceBoundAt },
    });
  });
}
