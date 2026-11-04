import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { RequestsPanel } from '@/components/admin/requests/RequestsPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listRequestHistory } from '@/lib/services/request-history';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'Đơn từ' };

type RequestsPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const ctx = await requireAdminPage('requests');
  const parsed = periodKeySchema.safeParse((await searchParams).period);
  const history = await listRequestHistory(ctx, parsed.success ? parsed.data : undefined);

  return (
    <AdminPage title="Đơn từ" subtitle="Lịch sử đơn của nhân viên theo kỳ">
      <RequestsPanel history={history} />
    </AdminPage>
  );
}
