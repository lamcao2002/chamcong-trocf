import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Xếp ca' };

export default async function SchedulePage() {
  await requireAdminPage('schedule');

  return (
    <AdminPage title="Xếp ca" subtitle="Lịch làm theo tuần">
      <ComingSoon task="Sprint 2 (US14–US16)" />
    </AdminPage>
  );
}
