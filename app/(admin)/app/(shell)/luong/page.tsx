import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Lương' };

export default async function PayrollPage() {
  await requireAdminPage('payroll');

  return (
    <AdminPage title="Lương" subtitle="Tính và công bố phiếu lương">
      <ComingSoon task="Sprint 4 (US34–US36)" />
    </AdminPage>
  );
}
