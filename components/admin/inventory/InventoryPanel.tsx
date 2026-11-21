'use client';

import { useState } from 'react';
import { Card, Tabs } from 'antd';
import type { InventoryListView, InventoryReportRow } from '@/lib/services/inventory';
import { tokens } from '@/lib/theme/tokens';
import { CatalogTab } from './CatalogTab';
import { ReportsTab } from './ReportsTab';
import { SheetsTab } from './SheetsTab';

export type InventoryTab = 'reports' | 'sheets' | 'catalog';

const QUERY: Record<InventoryTab, string> = { reports: '?', sheets: '?tab=phieu', catalog: '?tab=danh-muc' };

type InventoryPanelProps = {
  initialTab: InventoryTab;
  list: InventoryListView;
  reports: InventoryReportRow[];
};

/** Ba tab của /app/kiem-ke; đồng bộ `?tab=` để gửi link được mà không tải lại trang. */
export function InventoryPanel({ initialTab, list, reports }: InventoryPanelProps) {
  const [tab, setTab] = useState<InventoryTab>(initialTab);
  const pending = reports.filter(({ status }) => status === 'pending').length;

  const change = (key: string) => {
    setTab(key as InventoryTab);
    window.history.replaceState(window.history.state, '', QUERY[key as InventoryTab]);
  };

  return (
    <Card style={{ boxShadow: tokens.shadowCard }}>
      <Tabs
        activeKey={tab}
        onChange={change}
        items={[
          {
            key: 'reports',
            // Nhãn ngắn để ba tab vừa màn 375px; số trong ngoặc của Báo cáo là số chờ duyệt
            label: pending > 0 ? `Báo cáo (${pending})` : 'Báo cáo',
            children: <ReportsTab reports={reports} />,
          },
          {
            key: 'sheets',
            label: `Phiếu (${list.sheets.length})`,
            children: <SheetsTab list={list} onOpenCatalog={() => change('catalog')} />,
          },
          { key: 'catalog', label: `Danh mục (${list.items.length})`, children: <CatalogTab list={list} /> },
        ]}
      />
    </Card>
  );
}
