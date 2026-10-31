import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Cài đặt' };

export default async function SettingsPage() {
  await requireAdminPage('settings');

  return (
    <AdminPage title="Cài đặt" subtitle="Thông tin công ty và quy tắc chấm công">
      <ComingSoon task="S1-16" />
    </AdminPage>
  );
}
