import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Nhân sự' };

export default async function StaffPage() {
  await requireAdminPage('staff');

  return (
    <AdminPage title="Nhân sự" subtitle="Hồ sơ, vị trí và quyền của nhân viên">
      <ComingSoon task="S1-17, S1-18" />
    </AdminPage>
  );
}
