import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { employees } from '@/lib/db/schema';
import { canSeeAllStaff } from './permissions';
import type { Role } from './roles';
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

export { canAssignRole, canEditEmployee, canManage, canSeeAllStaff, canSeePay, hasRole } from './permissions';
