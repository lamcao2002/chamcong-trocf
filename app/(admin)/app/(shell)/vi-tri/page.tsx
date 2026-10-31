import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';

export const metadata: Metadata = { title: 'Vị trí & ca' };

export default function PositionsPage() {
  return (
    <AdminPage title="Vị trí & ca" subtitle="Vị trí, thư viện ca và ngày lễ">
      <ComingSoon task="S1-12, S1-13, S1-14" />
    </AdminPage>
  );
}
