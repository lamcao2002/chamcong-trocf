import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { periodTitle } from '@/components/admin/payroll/payroll-text';
import { PenaltyBar } from '@/components/admin/penalties/PenaltyBar';
import { PenaltyPanel, type PenaltyTab } from '@/components/admin/penalties/PenaltyPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listPenalties, listPenaltyRules } from '@/lib/services/penalties';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'Phạt' };

const TABS: Record<string, PenaltyTab> = { 'quy-dinh': 'rules' };

type PenaltyPageProps = {
  searchParams: Promise<{ period?: string; tab?: string }>;
};

export default async function PenaltyPage({ searchParams }: PenaltyPageProps) {
  const ctx = await requireAdminPage('penalties');
  const { period, tab } = await searchParams;
  const parsed = periodKeySchema.safeParse(period);
  const [list, rules] = await Promise.all([
    listPenalties(ctx, parsed.success ? parsed.data : undefined),
    listPenaltyRules(ctx),
  ]);

  return (
    <AdminPage
      title="Phạt"
      subtitle={`${periodTitle(list.period.key)} · sẹo và tiền phạt theo quy định của quán, kèm bằng chứng`}
      toolbar={<PenaltyBar list={list} />}
    >
      <PenaltyPanel
        initialTab={TABS[tab ?? ''] ?? 'penalties'}
        list={list}
        rules={rules}
        canEditRules={ctx.employee.role === 'admin'}
      />
    </AdminPage>
  );
}
