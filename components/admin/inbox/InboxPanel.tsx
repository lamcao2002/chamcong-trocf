'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Drawer, Empty, Grid } from 'antd';
import { CheckOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { AdjustDrawer, type AdjustTarget } from '@/components/admin/AdjustDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest, type ApiResult } from '@/lib/api/client';
import { decisionOf } from '@/lib/domain/approval';
import { formatDate } from '@/lib/format';
import type { InboxItem, InboxKind, InboxView, OverviewView } from '@/lib/services/inbox';
import { themeCssVars } from '@/lib/theme/tokens';
import { InboxActions } from './InboxActions';
import { InboxDetail } from './InboxDetail';
import { useBulkApprove } from './useBulkApprove';
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
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Ẩn ngay việc vừa xử lý, không đợi danh sách mới về
  const [doneKeys, setDoneKeys] = useState<readonly string[]>([]);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<readonly string[]>([]);
  const [, startRefresh] = useTransition();
  const bulk = useBulkApprove(inbox.period, () => {
    setChecked([]);
    startRefresh(() => router.refresh());
  });

  useEffect(() => setDoneKeys([]), [inbox]);

  const visible = inbox.items.filter(({ key }) => !doneKeys.includes(key));
  const counts = visible.reduce<Partial<Record<InboxKind, number>>>((all, { kind }) => {
    all[kind] = (all[kind] ?? 0) + 1;
    return all;
  }, {});

  // Chip về 0 thì biến mất: bộ lọc đang chọn không còn việc nào thì quay về Tất cả
  const active: Filter = filter !== 'all' && counts[filter] ? filter : 'all';
  const items = active === 'all' ? visible : visible.filter(({ kind }) => kind === active);
  const opened = items.find(({ key }) => key === selectedKey) ?? null;
  const selected = opened ?? (desktop ? (items[0] ?? null) : null);
  // Chỉ tính việc đang nhìn thấy: việc đã tích mà bị bộ lọc ẩn không được duyệt ngầm
  const approvable = items.filter(({ suggestion }) => suggestion);
  const picked = approvable.filter(({ key }) => checked.includes(key));
  const allPicked = approvable.length > 0 && picked.length === approvable.length;

  const toggle = (key: string, on: boolean) =>
    setChecked((keys) => (on ? [...keys, key] : keys.filter((value) => value !== key)));

  const moveOn = (key: string) => {
    const index = items.findIndex((item) => item.key === key);
    setSelectedKey((items[index + 1] ?? items[index - 1])?.key ?? null);
  };

  const finish = (item: InboxItem, message: string) => {
    toast.success(message);
    moveOn(item.key);
    setDoneKeys((keys) => [...keys, item.key]);
    startRefresh(() => router.refresh());
  };

  const run = async (item: InboxItem, call: Promise<ApiResult<object>>, message: string) => {
    setBusy(true);
    const result = await call;
    setBusy(false);
    if (result.ok) {
      finish(item, message);
      return;
    }
    toast.error(result.error);
    startRefresh(() => router.refresh());
  };

  const approve = (item: InboxItem) => {
    const decision = item.suggestion ? decisionOf(item.suggestion, item.otProposed) : null;
    if (!decision) return;
    const { employeeId, date, shiftId } = item;
    void run(
      item,
      apiRequest('/api/v1/approvals', 'POST', { employeeId, date, shiftId, ...decision }),
      'Đã duyệt',
    );
  };

  const decide = (item: InboxItem, decision: 'approve' | 'reject', note?: string) => {
    const url = `/api/v1/requests/${item.requestId}/decide`;
    const message = decision === 'approve' ? 'Đã duyệt đơn' : 'Đã từ chối đơn';
    void run(item, apiRequest(url, 'POST', { decision, note }), message);
  };

  const actions = (item: InboxItem) => (
    <InboxActions
      item={item}
      busy={busy}
      onApprove={() => approve(item)}
      onAdjust={() =>
        setAdjusting({
          employeeId: item.employeeId,
          date: item.date,
          shiftId: item.shiftId,
          title: `${item.employeeName} · ${formatDate(item.date)}`,
          onSaved: () => finish(item, 'Đã lưu duyệt'),
        })
      }
      onLater={() => moveOn(item.key)}
      onDecide={(decision, note) => decide(item, decision, note)}
    />
  );

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
    <div key={item.key} className={styles.rowLine}>
      <span className={styles.rowCheck}>
        {item.suggestion ? (
          <Checkbox
            aria-label={`Chọn ${item.employeeName}, ${formatDate(item.date)}, ${item.kindLabel}`}
            checked={checked.includes(item.key)}
            onChange={(event) => toggle(item.key, event.target.checked)}
          />
        ) : null}
      </span>
      {rowButton(item)}
    </div>
  );

  const rowButton = (item: InboxItem) => (
    <button
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

        {visible.length === 0 ? (
          <Empty description="Không còn việc nào cần xử lý" />
        ) : (
          <>
            <div className={styles.chips}>
              {chip('all', 'Tất cả', visible.length)}
              {KIND_ORDER.map((kind) => {
                const count = counts[kind];
                const label = visible.find((item) => item.kind === kind)?.kindLabel ?? '';
                return count ? chip(kind, label, count) : null;
              })}
            </div>
            {approvable.length > 0 ? (
              <div className={styles.bulkBar}>
                {desktop ? (
                  <Checkbox
                    checked={allPicked}
                    indeterminate={picked.length > 0 && !allPicked}
                    onChange={(event) =>
                      setChecked(event.target.checked ? approvable.map(({ key }) => key) : [])
                    }
                  >
                    Chọn tất cả
                  </Checkbox>
                ) : (
                  <span />
                )}
                {picked.length > 0 ? (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={bulk.busy}
                    onClick={() =>
                      bulk.confirm(
                        picked.map(({ key, suggestion }) => ({
                          key,
                          label: suggestion!.label,
                          otMinutes: suggestion!.otMinutes ?? 0,
                        })),
                      )
                    }
                  >
                    Duyệt theo đề xuất · {picked.length}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className={styles.split}>
              <div className={styles.list}>{items.map(row)}</div>
              {desktop && selected ? <InboxDetail item={selected} actions={actions(selected)} /> : null}
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
            {opened ? <InboxDetail item={opened} actions={actions(opened)} /> : null}
          </div>
        </Drawer>
      )}

      <AdjustDrawer target={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
