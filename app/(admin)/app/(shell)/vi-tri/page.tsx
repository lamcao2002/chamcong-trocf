import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { ConfigTabs } from '@/components/admin/config/ConfigTabs';
import { HolidaysPanel } from '@/components/admin/config/HolidaysPanel';
import { PositionsPanel } from '@/components/admin/config/PositionsPanel';
import { ShiftsPanel } from '@/components/admin/config/ShiftsPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listHolidays } from '@/lib/services/holidays';
import { listLocations } from '@/lib/services/locations';
import { listPositions } from '@/lib/services/positions';
import { listShifts } from '@/lib/services/shifts';

export const metadata: Metadata = { title: 'Vị trí & ca' };

type PositionsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

/** Năm sau theo giờ Việt Nam, bất kể múi giờ của máy chủ. */
function nextVietnamYear(): number {
  return (
    Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format()) + 1
  );
}

export default async function PositionsPage({ searchParams }: PositionsPageProps) {
  const ctx = await requireAdminPage('positions');
  const { tab } = await searchParams;
  const [positions, shifts, locations, holidays] = await Promise.all([
    listPositions(ctx),
    listShifts(ctx),
    listLocations(ctx),
    listHolidays(ctx),
  ]);

  return (
    <AdminPage title="Vị trí & ca" subtitle="Vị trí, thư viện ca và ngày lễ">
      <ConfigTabs
        initialTab={tab === 'ca' ? 'shifts' : 'positions'}
        positionsLabel={`Vị trí ${positions.length}`}
        shiftsLabel={`Ca & ngày lễ ${shifts.length}`}
        positions={<PositionsPanel positions={positions} shifts={shifts} locations={locations} />}
        shifts={
          <>
            <ShiftsPanel shifts={shifts} />
            <HolidaysPanel holidays={holidays} nextYear={nextVietnamYear()} />
          </>
        }
      />
    </AdminPage>
  );
}
