import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Hộp việc' };

export default async function AdminHomePage() {
  await requireAdminPage('inbox');

  return (
    <AdminPage title="Hộp việc" subtitle="Hôm nay cần bạn xử lý gì">
      <ComingSoon task="Sprint 3 (US23–US26)" />
    </AdminPage>
  );
}
