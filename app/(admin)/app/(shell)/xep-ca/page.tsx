import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { SchedulePanel } from '@/components/admin/schedule/SchedulePanel';
import { WeekNav } from '@/components/admin/schedule/WeekNav';
import { requireAdminPage } from '@/lib/auth/guard';
import { vietnamToday } from '@/lib/domain/date';
import { mondayOf } from '@/lib/engine/time';
import { getSchedule } from '@/lib/services/schedule';
import { weekSchema } from '@/lib/validation/schedule';

export const metadata: Metadata = { title: 'Xếp ca' };

type SchedulePageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const ctx = await requireAdminPage('schedule');
  const today = vietnamToday();
  const currentWeek = mondayOf(today);
  const parsed = weekSchema.safeParse((await searchParams).week);
  const week = parsed.success ? parsed.data : currentWeek;
  const schedule = await getSchedule(ctx, week);

  return (
    <AdminPage
      title="Xếp ca"
      subtitle="Lịch làm theo tuần"
      extra={<WeekNav week={week} currentWeek={currentWeek} />}
    >
      <SchedulePanel schedule={schedule} today={today} />
    </AdminPage>
  );
}
