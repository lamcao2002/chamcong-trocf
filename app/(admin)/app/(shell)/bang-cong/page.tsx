import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { DayCheckPanel } from '@/components/admin/timesheet/DayCheckPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { vietnamToday } from '@/lib/domain/date';
import { listDay } from '@/lib/services/day';
import { isoDate } from '@/lib/validation/common';

export const metadata: Metadata = { title: 'Bảng công' };

type TimesheetPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function TimesheetPage({ searchParams }: TimesheetPageProps) {
  const ctx = await requireAdminPage('timesheet');
  const parsed = isoDate.safeParse((await searchParams).date);
  const date = parsed.success ? parsed.data : vietnamToday();

  return (
    <AdminPage title="Bảng công" subtitle="Bản tạm: ngày công từng ngày, chỉ đọc">
      <DayCheckPanel date={date} rows={await listDay(ctx, date)} />
    </AdminPage>
  );
}
