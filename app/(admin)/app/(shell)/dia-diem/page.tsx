import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { LocationsPanel } from '@/components/admin/config/LocationsPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listEmployees } from '@/lib/services/employees';
import { listLocations } from '@/lib/services/locations';
import { listPositions } from '@/lib/services/positions';

export const metadata: Metadata = { title: 'Địa điểm' };

export default async function LocationsPage() {
  const ctx = await requireAdminPage('locations');
  const [locations, positions, employees] = await Promise.all([
    listLocations(ctx),
    listPositions(ctx),
    listEmployees(ctx, { status: 'active' }),
  ]);

  // Người chấm được ở từng địa điểm: ghi đè riêng thắng địa điểm của vị trí
  const employeeCounts: Record<string, number> = {};
  for (const employee of employees) {
    const position = positions.find(({ id }) => id === employee.positionId);
    for (const id of employee.locationIds ?? position?.locationIds ?? []) {
      employeeCounts[id] = (employeeCounts[id] ?? 0) + 1;
    }
  }

  return (
    <AdminPage title="Địa điểm" subtitle="Vùng được phép chấm công">
      <LocationsPanel locations={locations} positions={positions} employeeCounts={employeeCounts} />
    </AdminPage>
  );
}
