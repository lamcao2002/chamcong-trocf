import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { StaffPanel } from '@/components/admin/config/StaffPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listEmployees } from '@/lib/services/employees';
import { listLocations } from '@/lib/services/locations';
import { listPositions } from '@/lib/services/positions';
import { listShifts } from '@/lib/services/shifts';

export const metadata: Metadata = { title: 'Nhân sự' };

export default async function StaffPage() {
  const ctx = await requireAdminPage('staff');
  const [employees, positions, shifts, locations] = await Promise.all([
    listEmployees(ctx),
    listPositions(ctx),
    listShifts(ctx),
    listLocations(ctx),
  ]);

  return (
    <AdminPage title="Nhân sự" subtitle="Hồ sơ, vị trí và quyền của nhân viên">
      <StaffPanel
        employees={employees}
        positions={positions}
        shifts={shifts}
        locations={locations}
        viewer={{ id: ctx.employee.id, role: ctx.employee.role }}
      />
    </AdminPage>
  );
}
