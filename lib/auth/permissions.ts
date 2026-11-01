import { HR_UP, type Role } from './roles';

type Actor = { id: string; role: Role };

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
