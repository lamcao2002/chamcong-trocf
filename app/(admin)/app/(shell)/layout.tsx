import type { ReactNode } from 'react';
import { AdminShell, type AdminViewer } from '@/components/admin/AdminShell';

// Người xem tạm theo dữ liệu mẫu; S1-08 thay bằng phiên đăng nhập và màu công ty thật
const DEV_VIEWER: AdminViewer = {
  name: 'Nguyễn Thu Hà',
  role: 'admin',
  companyName: 'Cà phê Phố Nhỏ',
  brandColor: '#7B5236',
};

export default function AdminShellLayout({ children }: { children: ReactNode }) {
  return <AdminShell viewer={DEV_VIEWER}>{children}</AdminShell>;
}
