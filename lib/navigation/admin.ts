import { ADMIN_ONLY, HR_UP, MANAGERS, type Role } from '@/lib/auth/roles';

export type AdminNavKey =
  | 'inbox'
  | 'timesheet'
  | 'schedule'
  | 'payroll'
  | 'requests'
  | 'staff'
  | 'positions'
  | 'locations'
  | 'settings';

export type AdminNavItem = {
  key: AdminNavKey;
  label: string;
  href: string;
  group: 'main' | 'setup';
  /** Quyền vào mục này theo cột "Ai dùng" của PRD; `requireAdminPage` chặn ở phía server. */
  roles: readonly Role[];
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: 'inbox', label: 'Hộp việc', href: '/app', group: 'main', roles: MANAGERS },
  { key: 'timesheet', label: 'Bảng công', href: '/app/bang-cong', group: 'main', roles: MANAGERS },
  { key: 'schedule', label: 'Xếp ca', href: '/app/xep-ca', group: 'main', roles: MANAGERS },
  { key: 'payroll', label: 'Lương', href: '/app/luong', group: 'main', roles: HR_UP },
  { key: 'requests', label: 'Đơn từ', href: '/app/don-tu', group: 'main', roles: MANAGERS },
  { key: 'staff', label: 'Nhân sự', href: '/app/nhan-su', group: 'setup', roles: HR_UP },
  { key: 'positions', label: 'Vị trí & ca', href: '/app/vi-tri', group: 'setup', roles: HR_UP },
  { key: 'locations', label: 'Địa điểm', href: '/app/dia-diem', group: 'setup', roles: ADMIN_ONLY },
  { key: 'settings', label: 'Cài đặt', href: '/app/cai-dat', group: 'setup', roles: ADMIN_ONLY },
];

export function navForRole(role: Role): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.includes(role));
}

/** Mục đang mở theo đường dẫn; `/app` chỉ khớp đúng trang chủ. */
export function activeNavKey(pathname: string): AdminNavKey | undefined {
  const path = pathname.replace(/\/+$/, '');
  return ADMIN_NAV.find(({ href }) => path === href || (href !== '/app' && path.startsWith(`${href}/`)))?.key;
}

/** Hai chữ cái cho avatar, lấy từ hai từ cuối của họ tên ("Nguyễn Thu Hà" → "TH"). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
