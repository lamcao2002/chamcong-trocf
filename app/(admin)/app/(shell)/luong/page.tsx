import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { PayrollBar } from '@/components/admin/payroll/PayrollBar';
import { PayrollPanel } from '@/components/admin/payroll/PayrollPanel';
import { periodTitle } from '@/components/admin/payroll/payroll-text';
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
    <AdminPage
      title="Lương"
      subtitle={`${periodTitle(payroll.period.key)} · sao kê từng người, công bố phiếu lương, in và xuất Excel`}
      toolbar={<PayrollBar payroll={payroll} />}
    >
      <PayrollPanel
        payroll={payroll}
        brandColor={ctx.company.brandColor}
        canUnpublish={ctx.employee.role === 'admin'}
      />
    </AdminPage>
  );
}
