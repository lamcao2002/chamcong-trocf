'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Button, Drawer, Empty, Grid, Input, Progress, Select, Tag } from 'antd';
import { LeftOutlined, PrinterOutlined, RightOutlined } from '@ant-design/icons';
import { ExportButton } from '@/components/common/ExportButton';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';
import type { PayrollView } from '@/lib/services/payroll';
import { themeCssVars } from '@/lib/theme/tokens';
import { PayStatementView } from './PayStatementView';
import { PublishDialog } from './PublishDialog';
import styles from './payroll.module.css';

type Row = PayrollView['employees'][number];
type Filter = 'all' | 'issues' | 'ot' | 'ready' | 'adjusted';

const FILTERS: { value: Filter; label: string; match: (row: Row) => boolean }[] = [
  { value: 'all', label: 'Tất cả', match: () => true },
  { value: 'issues', label: 'Cần xử lý', match: ({ issues }) => issues > 0 },
  { value: 'ot', label: 'OT chờ', match: ({ otPendingMin }) => otPendingMin > 0 },
  { value: 'ready', label: 'Sẵn sàng', match: ({ ready }) => ready },
  { value: 'adjusted', label: 'Có thưởng/phạt', match: ({ hasAdjustment }) => hasAdjustment },
];

const PAY_LABELS: Record<Row['payType'], string> = {
  month: 'Lương tháng',
  hour: 'Lương giờ',
  unit: 'Lương công',
};

const hoursLabel = (minutes: number) => `${formatDecimal(Math.round((minutes / 60) * 100) / 100)} giờ`;

type PayrollPanelProps = { payroll: PayrollView; brandColor: string | null };

/** Màn A5: thẻ kỳ lương, thẻ phụ, danh sách nhân viên, sao kê người đang chọn (US34). */
export function PayrollPanel({ payroll, brandColor }: PayrollPanelProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { period, status, otApproved, otPending, review, adjustments } = payroll;

  const positions = useMemo(
    () => [...new Set(payroll.employees.flatMap(({ positionName }) => positionName ?? []))],
    [payroll.employees],
  );
  const term = search.trim().toLowerCase();
  const activeFilter = FILTERS.find(({ value }) => value === filter)!;
  const rows = payroll.employees.filter(
    (row) =>
      activeFilter.match(row) &&
      row.name.toLowerCase().includes(term) &&
      (position === null || row.positionName === position),
  );
  const opened = rows.find(({ id }) => id === selectedId) ?? null;
  const selected = opened ?? (desktop ? (rows[0] ?? null) : null);
  const percent = payroll.headcount ? Math.round((payroll.readyCount / payroll.headcount) * 100) : 0;
  const href = (key: string) => `/app/luong?period=${key}`;

  return (
    <div className={styles.stack}>
      {status.stale ? (
        <p className={styles.staleBanner} role="status">
          <strong>Cần công bố lại.</strong> Số liệu đã đổi sau lần công bố: nhân viên đang thấy tổng{' '}
          {formatMoney(status.publishedNet)}, hiện tính ra {formatMoney(payroll.fund)}.
        </p>
      ) : null}
      <div className={styles.summary}>
        <section className={styles.main} aria-label="Kỳ lương">
          <div className={styles.mainHead}>
            <nav className={styles.periodNav} aria-label="Chọn kỳ">
              <Link className={styles.periodLink} href={href(payroll.previousKey)} aria-label="Kỳ trước">
                <LeftOutlined />
              </Link>
              <span className={styles.periodLabel}>
                {formatDate(period.from)} – {formatDate(period.to)}
              </span>
              {payroll.nextKey ? (
                <Link className={styles.periodLink} href={href(payroll.nextKey)} aria-label="Kỳ sau">
                  <RightOutlined />
                </Link>
              ) : null}
            </nav>
            {status.published ? (
              <Tag color={status.stale ? 'warning' : 'success'}>
                {status.stale ? 'Cần công bố lại' : 'Đã công bố'}
              </Tag>
            ) : (
              <Tag color="warning">Chưa công bố</Tag>
            )}
          </div>
          <strong className={styles.fund}>{formatMoney(payroll.fund)}</strong>
          <span className={styles.muted}>Quỹ lương dự kiến · {payroll.headcount} người</span>
          <Progress percent={percent} showInfo={false} size="small" />
          <span className={styles.muted}>
            {payroll.readyCount}/{payroll.headcount} người sẵn sàng
          </span>
          <PublishDialog payroll={payroll} />
          <div className={styles.exports}>
            <ExportButton url={`/api/v1/payroll/export?period=${period.key}`} />
            <Button
              icon={<PrinterOutlined />}
              href={`/app/in-phieu?period=${period.key}`}
              target="_blank"
              rel="noopener"
            >
              In tất cả phiếu
            </Button>
          </div>
        </section>

        <div className={styles.side}>
          <div className={styles.tile}>
            <span className={styles.muted}>OT đã duyệt</span>
            <strong>{formatMoney(otApproved.amount)}</strong>
            <span className={styles.muted}>
              {hoursLabel(otApproved.minutes)} · {otApproved.people} người
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.muted}>OT chờ duyệt</span>
            <strong className={styles.ot}>+{formatMoney(otPending.amount)}</strong>
            <span className={styles.muted}>{hoursLabel(otPending.minutes)} · chưa tính</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.muted}>Ngày công cần xử lý</span>
            <strong className={review.items > 0 ? styles.alert : ''}>{review.items}</strong>
            <Link className={styles.link} href="/app">
              Mở Hộp việc
            </Link>
          </div>
          <div className={styles.tile}>
            <span className={styles.muted}>Thưởng/phạt nhập tay</span>
            <strong>{formatMoney(adjustments.amount)}</strong>
            <span className={styles.muted}>{adjustments.people} người</span>
          </div>
        </div>
      </div>

      <section className={styles.panel} aria-label="Danh sách nhân viên">
        <div className={styles.toolbar}>
          <Input
            allowClear
            className={styles.search}
            placeholder="Tìm tên"
            aria-label="Tìm tên"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            allowClear
            className={styles.position}
            placeholder="Vị trí"
            aria-label="Lọc vị trí"
            value={position}
            options={positions.map((value) => ({ value, label: value }))}
            onChange={(value) => setPosition(value ?? null)}
          />
        </div>
        <div className={styles.chips}>
          {FILTERS.map(({ value, label, match }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={`${styles.chip} ${filter === value ? styles.chipActive : ''}`}
              onClick={() => setFilter(value)}
            >
              {label} {payroll.employees.filter(match).length}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <Empty description="Không có nhân viên nào" />
        ) : (
          <div className={styles.split}>
            <div className={styles.list}>
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  aria-current={row.id === selected?.id ? 'true' : undefined}
                  className={`${styles.row} ${desktop && row.id === selected?.id ? styles.rowActive : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{row.name}</span>
                    <span className={styles.muted}>
                      {row.positionName ?? 'Chưa có vị trí'} · {PAY_LABELS[row.payType]}
                    </span>
                    <span className={styles.muted}>
                      {formatDecimal(row.cong)} công · OT {row.otApprovedMin}p
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <strong className={row.net < 0 ? styles.alert : ''}>{formatMoney(row.net)}</strong>
                    <Tag color={row.ready ? 'success' : 'error'}>
                      {row.ready ? 'Sẵn sàng' : `${row.issues} việc`}
                    </Tag>
                  </span>
                </button>
              ))}
            </div>
            {desktop && selected ? (
              <PayStatementView employeeId={selected.id} periodKey={period.key} />
            ) : null}
          </div>
        )}
      </section>

      {desktop ? null : (
        <Drawer
          open={opened !== null}
          title="Sao kê"
          placement="bottom"
          height="92%"
          destroyOnHidden
          onClose={() => setSelectedId(null)}
        >
          {/* Drawer nằm ngoài AdminShell nên phải đặt lại biến CSS */}
          <div style={themeCssVars(brandColor ?? undefined) as CSSProperties}>
            {opened ? <PayStatementView employeeId={opened.id} periodKey={period.key} /> : null}
          </div>
        </Drawer>
      )}
    </div>
  );
}
