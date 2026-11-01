import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { InboxPanel } from '@/components/admin/inbox/InboxPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { getInbox, getOverview } from '@/lib/services/inbox';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'Hộp việc' };

type AdminHomeProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function AdminHomePage({ searchParams }: AdminHomeProps) {
  const ctx = await requireAdminPage('inbox');
  const parsed = periodKeySchema.safeParse((await searchParams).period);
  const inbox = await getInbox(ctx, parsed.success ? parsed.data : undefined);
  // Thẻ Chờ xử lý luôn là kỳ hiện tại, kể cả khi đang xem kỳ khác
  const current = parsed.success ? await getInbox(ctx) : inbox;
  const overview = await getOverview(ctx, current.total);

  return (
    <AdminPage title="Hộp việc" subtitle="Hôm nay cần bạn xử lý gì">
      <InboxPanel overview={overview} inbox={inbox} brandColor={ctx.company.brandColor} />
    </AdminPage>
  );
}
