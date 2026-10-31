import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';

export const metadata: Metadata = { title: 'Cài đặt' };

export default function SettingsPage() {
  return (
    <AdminPage title="Cài đặt" subtitle="Thông tin công ty và quy tắc chấm công">
      <ComingSoon task="S1-16" />
    </AdminPage>
  );
}
