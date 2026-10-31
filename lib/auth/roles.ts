import type { roleEnum } from '@/lib/db/schema';

export type Role = (typeof roleEnum.enumValues)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị viên',
  hr: 'Nhân sự',
  manager: 'Quản lý nhóm',
  app: 'Nhân viên',
};
