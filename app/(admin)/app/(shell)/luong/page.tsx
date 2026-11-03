import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { PayrollPanel } from '@/components/admin/payroll/PayrollPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { getPayroll } from '@/lib/services/payroll';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'Lương' };

type PayrollPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const ctx = await requireAdminPage('payroll');
  const parsed = periodKeySchema.safeParse((await searchParams).period);
  const payroll = await getPayroll(ctx, parsed.success ? parsed.data : undefined);

  return (
    <AdminPage title="Lương" subtitle="Tính và công bố phiếu lương">
      <PayrollPanel payroll={payroll} brandColor={ctx.company.brandColor} />
    </AdminPage>
  );
}
