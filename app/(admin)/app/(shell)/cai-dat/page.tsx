import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { SettingsForm } from '@/components/admin/config/SettingsForm';
import { requireAdminPage } from '@/lib/auth/guard';
import { getCompany } from '@/lib/services/company';

export const metadata: Metadata = { title: 'Cài đặt' };

export default async function SettingsPage() {
  const ctx = await requireAdminPage('settings');

  return (
    <AdminPage title="Cài đặt" subtitle="Thông tin công ty và quy tắc chấm công">
      <SettingsForm company={await getCompany(ctx)} />
    </AdminPage>
  );
}
