import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { TimesheetPanel } from '@/components/admin/timesheet/TimesheetPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { getTimesheet } from '@/lib/services/timesheet';
import { timesheetQuerySchema } from '@/lib/validation/timesheet';

export const metadata: Metadata = { title: 'Bảng công' };

type TimesheetPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TimesheetPage({ searchParams }: TimesheetPageProps) {
  const ctx = await requireAdminPage('timesheet');
  const parsed = timesheetQuerySchema.safeParse(await searchParams);
  const timesheet = await getTimesheet(ctx, parsed.success ? parsed.data : {});

  return (
    <AdminPage title="Bảng công" subtitle="Công của cả nhóm theo kỳ">
      <TimesheetPanel timesheet={timesheet} />
    </AdminPage>
  );
}
