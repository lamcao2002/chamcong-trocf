import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/AdminPage';
import { InventoryPanel, type InventoryTab } from '@/components/admin/inventory/InventoryPanel';
import { requireAdminPage } from '@/lib/auth/guard';
import { listInventory, listInventoryReports } from '@/lib/services/inventory';

export const metadata: Metadata = { title: 'Kiểm kê' };

const TABS: Record<string, InventoryTab> = { phieu: 'sheets', 'danh-muc': 'catalog' };

type InventoryPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const ctx = await requireAdminPage('inventory');
  const [list, reports, { tab }] = await Promise.all([
    listInventory(ctx),
    listInventoryReports(ctx),
    searchParams,
  ]);

  return (
    <AdminPage
      title="Kiểm kê"
      subtitle="Danh mục vật dụng, nguyên liệu, phiếu kiểm kê theo vị trí và báo cáo của nhân viên"
    >
      <InventoryPanel initialTab={TABS[tab ?? ''] ?? 'reports'} list={list} reports={reports} />
    </AdminPage>
  );
}
