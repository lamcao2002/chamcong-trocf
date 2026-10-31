import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { employees } from '@/lib/db/schema';
import { HR_UP, type Role } from './roles';
import type { SessionKind } from './session-policy';

export type AuthContext = {
  kind: SessionKind;
  employee: { id: string; name: string; email: string; role: Role };
  company: {
    id: string;
    code: string;
    name: string;
    appName: string | null;
    brandColor: string | null;
  };
};

type Actor = Pick<AuthContext['employee'], 'id' | 'role'>;

export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

/** Quản lý nhóm không thấy số tiền lương (US02). */
export function canSeePay(role: Role): boolean {
  return hasRole(role, HR_UP);
}

/** Quản lý nhóm chỉ thấy người có `manager_id` là mình; xem qua `scopeToStaff`. */
export function canSeeAllStaff(role: Role): boolean {
  return hasRole(role, HR_UP);
}

/** Một người có nằm trong phạm vi quản lý của `actor`, dùng khi đã có sẵn dòng nhân viên. */
export function canManage(actor: Actor, target: { managerId: string | null }): boolean {
  return canSeeAllStaff(actor.role) || target.managerId === actor.id;
}

/** Nhân sự không sửa được Quản trị viên (US02); Quản lý nhóm không sửa hồ sơ. */
export function canEditEmployee(actor: Actor, target: { role: Role }): boolean {
  if (actor.role === 'admin') return true;
  return actor.role === 'hr' && target.role !== 'admin';
}

/** Chỉ Quản trị viên được cấp quyền Quản trị viên; Nhân sự cấp được các quyền còn lại. */
export function canAssignRole(actorRole: Role, role: Role): boolean {
  if (actorRole === 'admin') return true;
  return actorRole === 'hr' && role !== 'admin';
}

/** Điều kiện `company_id` bắt buộc của mọi truy vấn nghiệp vụ. */
export function scopeToCompany(ctx: AuthContext, companyId: PgColumn): SQL {
  return eq(companyId, ctx.company.id);
}

/**
 * Giới hạn truy vấn theo người `ctx` được xem. `employeeId` là cột trỏ tới nhân viên của bảng đang
 * đọc (`day_records.employee_id`, hoặc chính `employees.id`).
 */
export function scopeToStaff(ctx: AuthContext, columns: { companyId: PgColumn; employeeId: PgColumn }): SQL {
  const company = scopeToCompany(ctx, columns.companyId);
  if (canSeeAllStaff(ctx.employee.role)) return company;
  return and(
    company,
    sql`${columns.employeeId} in (select ${employees.id} from ${employees} where ${employees.managerId} = ${ctx.employee.id})`,
  )!;
}
