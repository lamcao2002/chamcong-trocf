import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Địa điểm' };

export default async function LocationsPage() {
  await requireAdminPage('locations');

  return (
    <AdminPage title="Địa điểm" subtitle="Vùng được phép chấm công">
      <ComingSoon task="S1-15" />
    </AdminPage>
  );
}
