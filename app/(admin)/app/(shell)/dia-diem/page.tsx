import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';

export const metadata: Metadata = { title: 'Địa điểm' };

export default function LocationsPage() {
  return (
    <AdminPage title="Địa điểm" subtitle="Vùng được phép chấm công">
      <ComingSoon task="S1-15" />
    </AdminPage>
  );
}
