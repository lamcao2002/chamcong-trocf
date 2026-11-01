'use client';

import { useState, type ReactNode } from 'react';
import { Card, Tabs } from 'antd';
import { tokens } from '@/lib/theme/tokens';

type ConfigTabsProps = {
  initialTab: 'positions' | 'shifts';
  positionsLabel: string;
  shiftsLabel: string;
  positions: ReactNode;
  shifts: ReactNode;
};

/** Hai tab của /app/vi-tri; đồng bộ `?tab=ca` để gửi link được mà không tải lại trang. */
export function ConfigTabs({ initialTab, positionsLabel, shiftsLabel, positions, shifts }: ConfigTabsProps) {
  const [tab, setTab] = useState(initialTab);

  const change = (key: string) => {
    setTab(key as ConfigTabsProps['initialTab']);
    window.history.replaceState(window.history.state, '', key === 'shifts' ? '?tab=ca' : '?');
  };

  return (
    <Card style={{ boxShadow: tokens.shadowCard }}>
      <Tabs
        activeKey={tab}
        onChange={change}
        items={[
          { key: 'positions', label: positionsLabel, children: positions },
          { key: 'shifts', label: shiftsLabel, children: shifts },
        ]}
      />
    </Card>
  );
}
