'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Drawer, Empty, Grid } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { formatDate } from '@/lib/format';
import type { InboxItem, InboxKind, InboxView, OverviewView } from '@/lib/services/inbox';
import { themeCssVars } from '@/lib/theme/tokens';
import { InboxDetail } from './InboxDetail';
import styles from './inbox.module.css';

const KIND_ORDER: InboxKind[] = ['vang', 'thieu_gio', 'sai_ca', 'ngoai_vung', 'ngoai_lich', 'ot_cho', 'don'];

type Filter = InboxKind | 'all';

type InboxPanelProps = {
  overview: OverviewView;
  inbox: InboxView;
  brandColor: string | null;
};

/** Màn A2: 4 thẻ số hôm nay, danh sách việc lọc theo loại, chi tiết việc đang chọn (US23–US25). */
export function InboxPanel({ overview, inbox, brandColor }: InboxPanelProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Chip về 0 thì biến mất: bộ lọc đang chọn không còn việc nào thì quay về Tất cả
  const active: Filter = filter !== 'all' && inbox.counts[filter] ? filter : 'all';
  const items = active === 'all' ? inbox.items : inbox.items.filter(({ kind }) => kind === active);
  const opened = items.find(({ key }) => key === selectedKey) ?? null;
  const selected = opened ?? (desktop ? (items[0] ?? null) : null);

  const chip = (value: Filter, label: string, count: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={active === value}
      className={`${styles.chip} ${active === value ? styles.chipActive : ''}`}
      onClick={() => setFilter(value)}
    >
      {label} <span className={styles.chipCount}>{count}</span>
    </button>
  );

  const row = (item: InboxItem) => (
    <button
      key={item.key}
      type="button"
      aria-current={item.key === selected?.key ? 'true' : undefined}
      className={`${styles.row} ${desktop && item.key === selected?.key ? styles.rowActive : ''}`}
      onClick={() => setSelectedKey(item.key)}
    >
      <span className={styles.rowTop}>
        <span className={styles.rowName}>{item.employeeName}</span>
        <span className={styles.muted}>{formatDate(item.date).slice(0, 5)}</span>
      </span>
      <span className={styles.rowMeta}>
        <span className={styles.kind}>{item.kindLabel}</span>
        {item.shiftName ? <span className={styles.muted}>{item.shiftName}</span> : null}
      </span>
      <span className={styles.rowText}>{item.description}</span>
      {item.suggestion ? <span className={styles.proposal}>Đề xuất: {item.suggestion.label}</span> : null}
    </button>
  );

  return (
    <div className={styles.stack}>
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Đang trong ca</span>
          <strong className={styles.kpiValue}>
            {overview.onShift}/{overview.scheduled}
          </strong>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Đi muộn hôm nay</span>
          <strong className={styles.kpiValue}>{overview.late}</strong>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Chưa chấm công</span>
          <strong className={`${styles.kpiValue} ${overview.missing > 0 ? styles.kpiAlert : ''}`}>
            {overview.missing}
          </strong>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Chờ xử lý</span>
          <strong className={`${styles.kpiValue} ${overview.pending > 0 ? styles.kpiAlert : ''}`}>
            {overview.pending}
          </strong>
        </div>
      </div>

      <section className={styles.panel} aria-label="Cần bạn xử lý">
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Cần bạn xử lý</h2>
          <nav className={styles.periodNav} aria-label="Chọn kỳ">
            <Link
              className={styles.periodLink}
              href={`/app?period=${inbox.previousKey}`}
              aria-label="Kỳ trước"
            >
              <LeftOutlined />
            </Link>
            <span className={styles.muted}>
              {formatDate(inbox.period.from)} – {formatDate(inbox.period.to)}
            </span>
            {inbox.nextKey ? (
              <Link className={styles.periodLink} href={`/app?period=${inbox.nextKey}`} aria-label="Kỳ sau">
                <RightOutlined />
              </Link>
            ) : null}
          </nav>
        </header>

        {inbox.total === 0 ? (
          <Empty description="Không còn việc nào cần xử lý" />
        ) : (
          <>
            <div className={styles.chips}>
              {chip('all', 'Tất cả', inbox.total)}
              {KIND_ORDER.map((kind) => {
                const count = inbox.counts[kind];
                const label = inbox.items.find((item) => item.kind === kind)?.kindLabel ?? '';
                return count ? chip(kind, label, count) : null;
              })}
            </div>
            <div className={styles.split}>
              <div className={styles.list}>{items.map(row)}</div>
              {desktop && selected ? <InboxDetail item={selected} /> : null}
            </div>
          </>
        )}
      </section>

      {desktop ? null : (
        <Drawer
          open={opened !== null}
          title="Chi tiết việc"
          placement="bottom"
          height="92%"
          destroyOnHidden
          onClose={() => setSelectedKey(null)}
        >
          {/* Drawer nằm ngoài AdminShell nên phải đặt lại biến CSS */}
          <div style={themeCssVars(brandColor ?? undefined) as CSSProperties}>
            {opened ? <InboxDetail item={opened} /> : null}
          </div>
        </Drawer>
      )}
    </div>
  );
}
