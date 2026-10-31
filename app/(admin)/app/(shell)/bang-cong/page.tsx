import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ComingSoon } from '@/components/admin/ComingSoon';

export const metadata: Metadata = { title: 'Bảng công' };

export default function TimesheetPage() {
  return (
    <AdminPage title="Bảng công" subtitle="Công của cả nhóm theo kỳ">
      <ComingSoon task="Sprint 3 (US27–US28)" />
    </AdminPage>
  );
}
