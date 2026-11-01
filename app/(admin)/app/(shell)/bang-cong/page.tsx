import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { TimesheetPanel } from '@/components/admin/timesheet/TimesheetPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { getTimesheet } from '@/lib/services/timesheet';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'Bảng công' };

type TimesheetPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function TimesheetPage({ searchParams }: TimesheetPageProps) {
  const ctx = await requireAdminPage('timesheet');
  const parsed = periodKeySchema.safeParse((await searchParams).period);
  const timesheet = await getTimesheet(ctx, parsed.success ? parsed.data : undefined);

  return (
    <AdminPage title="Bảng công" subtitle="Công của cả nhóm theo kỳ">
      <TimesheetPanel timesheet={timesheet} />
    </AdminPage>
  );
}
