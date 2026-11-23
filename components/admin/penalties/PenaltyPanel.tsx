'use client';

import { useState } from 'react';
import { Card, Tabs } from 'antd';
import type { PenaltyListView, PenaltyRuleView } from '@/lib/services/penalties';
import { tokens } from '@/lib/theme/tokens';
import { PenaltiesTab } from './PenaltiesTab';
import { RulesTab } from './RulesTab';

export type PenaltyTab = 'penalties' | 'rules';

type PenaltyPanelProps = {
  initialTab: PenaltyTab;
  list: PenaltyListView;
  rules: PenaltyRuleView[];
  canEditRules: boolean;
};

/** Hai tab của /app/phat; đồng bộ `?tab=` mà giữ `?period=` để gửi link được. */
export function PenaltyPanel({ initialTab, list, rules, canEditRules }: PenaltyPanelProps) {
  const [tab, setTab] = useState<PenaltyTab>(initialTab);

  const change = (key: string) => {
    setTab(key as PenaltyTab);
    const url = new URL(window.location.href);
    if (key === 'rules') url.searchParams.set('tab', 'quy-dinh');
    else url.searchParams.delete('tab');
    window.history.replaceState(window.history.state, '', url.search || '?');
  };

  return (
    <Card style={{ boxShadow: tokens.shadowCard }}>
      <Tabs
        activeKey={tab}
        onChange={change}
        items={[
          {
            key: 'penalties',
            label: `Phiếu phạt (${list.penalties.filter(({ cancelledAt }) => !cancelledAt).length})`,
            children: <PenaltiesTab list={list} rules={rules} onOpenRules={() => change('rules')} />,
          },
          {
            key: 'rules',
            label: `Quy định (${rules.length})`,
            children: <RulesTab rules={rules} canEdit={canEditRules} scarThreshold={list.scarThreshold} />,
          },
        ]}
      />
    </Card>
  );
}
