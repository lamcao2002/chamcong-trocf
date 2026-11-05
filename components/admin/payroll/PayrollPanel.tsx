'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Drawer, Empty, Grid, Input, Progress, Select } from 'antd';
import { CheckCircleOutlined, InboxOutlined, SearchOutlined } from '@ant-design/icons';
import { vietnamToday } from '@/lib/domain/date';
import { formatClock, formatDate, formatDecimal, formatMoney, formatNumber } from '@/lib/format';
import { initials } from '@/lib/navigation/admin';
import type { PayrollView } from '@/lib/services/payroll';
import { themeCssVars } from '@/lib/theme/tokens';
import { PayStatementView } from './PayStatementView';
import { PublishDialog, UnpublishButton } from './PublishDialog';
import { PAY_LABELS, hoursMinutes, periodTitle } from './payroll-text';
import styles from './payroll.module.css';

type Row = PayrollView['employees'][number];
type Filter = 'all' | 'issues' | 'ot' | 'ready' | 'adjusted';
type Sort = 'name' | 'netDesc' | 'netAsc' | 'issues';

const FILTERS: { value: Filter; label: string; match: (row: Row) => boolean }[] = [
  { value: 'all', label: 'Tất cả', match: () => true },
  { value: 'issues', label: 'Cần xử lý', match: ({ issues }) => issues > 0 },
  { value: 'ot', label: 'OT chờ', match: ({ otPendingMin }) => otPendingMin > 0 },
  { value: 'ready', label: 'Sẵn sàng', match: ({ ready }) => ready },
  { value: 'adjusted', label: 'Có thưởng/phạt', match: ({ hasAdjustment }) => hasAdjustment },
];

const SORTS: { value: Sort; label: string; compare: (a: Row, b: Row) => number }[] = [
  { value: 'name', label: 'Sắp xếp: tên A → Z', compare: (a, b) => a.name.localeCompare(b.name, 'vi') },
  { value: 'netDesc', label: 'Sắp xếp: thực lĩnh cao → thấp', compare: (a, b) => b.net - a.net },
  { value: 'netAsc', label: 'Sắp xếp: thực lĩnh thấp → cao', compare: (a, b) => a.net - b.net },
  { value: 'issues', label: 'Sắp xếp: cần xử lý trước', compare: (a, b) => b.issues - a.issues },
];

const PAY_TYPE_OPTIONS = (Object.keys(PAY_LABELS) as Row['payType'][]).map((value) => ({
  value,
  label: PAY_LABELS[value],
}));

const hoursLabel = (minutes: number) => `${formatDecimal(Math.round((minutes / 60) * 100) / 100)} giờ`;

type PayrollPanelProps = {
  payroll: PayrollView;
  brandColor: string | null;
  /** Huỷ công bố chỉ dành cho Quản trị viên. */
  canUnpublish: boolean;
};

/** Màn A5: thẻ kỳ lương, thẻ phụ, danh sách nhân viên, sao kê người đang chọn (US34). */
export function PayrollPanel({ payroll, brandColor, canUnpublish }: PayrollPanelProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<string | null>(null);
  const [payType, setPayType] = useState<Row['payType'] | null>(null);
  const [sort, setSort] = useState<Sort>('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { period, status, otApproved, otPending, review, adjustments } = payroll;

  const positions = useMemo(
    () => [...new Set(payroll.employees.flatMap(({ positionName }) => positionName ?? []))],
    [payroll.employees],
  );
  const term = search.trim().toLowerCase();
  const activeFilter = FILTERS.find(({ value }) => value === filter)!;
  const rows = payroll.employees
    .filter(
      (row) =>
        activeFilter.match(row) &&
        (row.name.toLowerCase().includes(term) || row.email.toLowerCase().includes(term)) &&
        (position === null || row.positionName === position) &&
        (payType === null || row.payType === payType),
    )
    .sort(SORTS.find(({ value }) => value === sort)!.compare);
  const opened = rows.find(({ id }) => id === selectedId) ?? null;
  const selected = opened ?? (desktop ? (rows[0] ?? null) : null);
  const percent = payroll.headcount ? Math.round((payroll.readyCount / payroll.headcount) * 100) : 0;
  const range = `${formatDate(period.from).slice(0, 5)} – ${formatDate(period.to)}`;

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
            <h2 className={styles.mainTitle}>Kỳ lương {periodTitle(period.key).toLowerCase()}</h2>
            {status.published ? (
              <span className={status.stale ? styles.statusWarn : styles.statusDone}>
                {status.stale ? null : <CheckCircleOutlined />}
                {status.stale ? 'Cần công bố lại' : 'Đã công bố'}
              </span>
            ) : (
              <span className={styles.statusWarn}>Chưa công bố</span>
            )}
          </div>
          <strong className={styles.fund}>{formatMoney(payroll.fund)}</strong>
          <span className={styles.muted}>
            Quỹ lương (tổng thực lĩnh) · {payroll.headcount} người · {range}
          </span>
          <div className={styles.progress}>
            <Progress percent={percent} showInfo={false} size="small" strokeColor="var(--brand)" />
            <span className={styles.muted}>
              {payroll.readyCount}/{payroll.headcount} người sẵn sàng
            </span>
          </div>
          {status.published && status.publishedAt ? (
            <p className={styles.publishedLine}>
              Công bố lúc{' '}
              <strong>
                {formatClock(status.publishedAt)} {formatDate(vietnamToday(new Date(status.publishedAt)))}
              </strong>
              {status.publishedBy ? (
                <>
                  {' '}
                  bởi <strong>{status.publishedBy}</strong>
                </>
              ) : null}
              . Có sửa số liệu thì bấm Công bố lại.
            </p>
          ) : null}
          <div className={styles.mainActions}>
            <PublishDialog payroll={payroll} />
            {status.published && canUnpublish ? <UnpublishButton payroll={payroll} /> : null}
          </div>
        </section>

        <div className={styles.side}>
          <div className={styles.tile}>
            <span className={styles.muted}>OT đã duyệt</span>
            <strong>{formatMoney(otApproved.amount)}</strong>
            <span className={styles.muted}>
              {otApproved.minutes > 0
                ? `${hoursLabel(otApproved.minutes)} · ${otApproved.people} người`
                : 'Chưa có giờ làm thêm được duyệt'}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.muted}>OT chờ duyệt</span>
            <strong className={otPending.minutes > 0 ? styles.ot : ''}>
              {otPending.minutes > 0 ? `+${formatMoney(otPending.amount)}` : formatMoney(0)}
            </strong>
            <span className={styles.muted}>
              {otPending.minutes > 0
                ? `${hoursLabel(otPending.minutes)} · chưa tính, nếu duyệt sẽ cộng thêm`
                : 'Không có giờ làm thêm chờ duyệt'}
            </span>
          </div>
          <div className={styles.tile}>
            <div className={styles.tileHead}>
              <span className={styles.muted}>Ngày công cần xử lý</span>
              <Link className={styles.tileLink} href="/app">
                <InboxOutlined /> Mở Hộp việc
              </Link>
            </div>
            <strong className={review.items > 0 ? styles.alert : ''}>{review.items}</strong>
            <span className={styles.muted}>
              {review.items > 0
                ? `${review.people} người · xử lý xong rồi hãy công bố`
                : 'Không còn việc tồn trong kỳ'}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.muted}>Thưởng / phạt nhập tay</span>
            <strong>{formatMoney(adjustments.amount)}</strong>
            <span className={styles.muted}>
              {adjustments.people > 0 ? `${adjustments.people} người` : 'Chưa có khoản nào trong kỳ'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.split}>
        <section className={`${styles.panel} ${styles.listPanel}`} aria-label="Danh sách nhân viên">
          <div className={styles.listHead}>
            <h2 className={styles.panelTitle}>Nhân viên</h2>
            <span className={styles.muted}>{payroll.headcount} người</span>
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên hoặc email"
            aria-label="Tìm theo tên hoặc email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.chips}>
            {FILTERS.map(({ value, label, match }) => {
              const count = payroll.employees.filter(match).length;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  className={`${styles.chip} ${filter === value ? styles.chipActive : ''}`}
                  onClick={() => setFilter(value)}
                >
                  {label} <span className={styles.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.selects}>
            <Select
              allowClear
              placeholder="Mọi vị trí"
              aria-label="Lọc vị trí"
              value={position}
              options={positions.map((value) => ({ value, label: value }))}
              onChange={(value) => setPosition(value ?? null)}
            />
            <Select
              allowClear
              placeholder="Mọi kiểu lương"
              aria-label="Lọc kiểu lương"
              value={payType}
              options={PAY_TYPE_OPTIONS}
              onChange={(value) => setPayType(value ?? null)}
            />
          </div>
          <Select
            aria-label="Sắp xếp"
            value={sort}
            options={SORTS.map(({ value, label }) => ({ value, label }))}
            onChange={setSort}
          />

          {rows.length === 0 ? (
            <Empty description="Không có nhân viên nào" />
          ) : (
            <div className={styles.list}>
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  aria-current={row.id === selected?.id ? 'true' : undefined}
                  className={`${styles.row} ${desktop && row.id === selected?.id ? styles.rowActive : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className={styles.avatar} aria-hidden>
                    {initials(row.name)}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{row.name}</span>
                    <span className={styles.muted}>{row.positionName ?? 'Chưa có vị trí'}</span>
                    <span className={styles.muted}>
                      {formatDecimal(row.cong)} công · OT{' '}
                      {row.otApprovedMin > 0 ? hoursMinutes(row.otApprovedMin) : 0}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <strong className={row.net < 0 ? styles.alert : ''}>{formatNumber(row.net)}</strong>
                    {row.ready ? (
                      <span className={styles.ready}>Sẵn sàng</span>
                    ) : (
                      <span className={styles.issues}>{row.issues} việc</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {desktop && selected ? (
          <section className={styles.panel} aria-label="Sao kê">
            <PayStatementView employeeId={selected.id} periodKey={period.key} />
          </section>
        ) : null}
      </div>

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
