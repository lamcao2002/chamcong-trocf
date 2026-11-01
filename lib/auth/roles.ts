import type { roleEnum } from '@/lib/db/schema';

export type Role = (typeof roleEnum.enumValues)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị viên',
  hr: 'Nhân sự',
  manager: 'Quản lý nhóm',
  app: 'Nhân viên',
};

/** Nhóm quyền theo PRD: "QL", "Nhân sự+", "Quản trị". */
export const MANAGERS: readonly Role[] = ['admin', 'hr', 'manager'];
export const HR_UP: readonly Role[] = ['admin', 'hr'];
export const ADMIN_ONLY: readonly Role[] = ['admin'];
