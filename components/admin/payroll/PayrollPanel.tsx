'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Checkbox, Drawer, Empty, Grid, Input, Progress, Select } from 'antd';
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
type Filter = 'all' | 'issues' | 'ot' | 'ready' | 'adjusted' | 'unpublished' | 'stale';
type Sort = 'name' | 'netDesc' | 'netAsc' | 'issues';

const FILTERS: { value: Filter; label: string; match: (row: Row) => boolean }[] = [
  { value: 'all', label: 'Tất cả', match: () => true },
  { value: 'issues', label: 'Cần xử lý', match: ({ issues }) => issues > 0 },
  { value: 'ot', label: 'OT chờ', match: ({ otPendingMin }) => otPendingMin > 0 },
  { value: 'ready', label: 'Sẵn sàng', match: ({ ready }) => ready },
  { value: 'adjusted', label: 'Có thưởng/phạt', match: ({ hasAdjustment }) => hasAdjustment },
];

/** Chỉ hiện khi kỳ đã có người được công bố. */
const SLIP_FILTERS: typeof FILTERS = [
  { value: 'unpublished', label: 'Chưa công bố', match: ({ slip }) => slip === 'none' },
  { value: 'stale', label: 'Cần công bố lại', match: ({ slip }) => slip === 'stale' },
];

const SLIP_LABELS: Record<Row['slip'], { text: string; className: 'slipNone' | 'slipDone' | 'slipStale' }> = {
  none: { text: 'Chưa công bố', className: 'slipNone' },
  published: { text: 'Đã công bố', className: 'slipDone' },
  stale: { text: 'Cần công bố lại', className: 'slipStale' },
};

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
  /** Người đã tích để công bố hoặc huỷ công bố; trống là cả kỳ. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const { period, status, otApproved, otPending, review, adjustments } = payroll;

  const positions = useMemo(
    () => [...new Set(payroll.employees.flatMap(({ positionName }) => positionName ?? []))],
    [payroll.employees],
  );
  const term = search.trim().toLowerCase();
  const filters = status.published ? [...FILTERS, ...SLIP_FILTERS] : FILTERS;
  const activeFilter = filters.find(({ value }) => value === filter) ?? FILTERS[0]!;
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
  // Người đã tích mà không còn trong danh sách (đổi kỳ, nghỉ việc) thì bỏ qua
  const pickedRows = payroll.employees.filter(({ id }) => picked.has(id));
  const allShown = rows.length > 0 && rows.every(({ id }) => picked.has(id));
  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleShown = (on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      for (const { id } of rows) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const clearPicked = () => setPicked(new Set());
  const statusLabel = !status.published
    ? 'Chưa công bố'
    : status.count < payroll.headcount
      ? `Đã công bố ${status.count}/${payroll.headcount}`
      : 'Đã công bố';

  return (
    <div className={styles.stack}>
      {status.stale ? (
        <p className={styles.staleBanner} role="status">
          <strong>{status.staleCount} người cần công bố lại.</strong> Số liệu của họ đã đổi sau lần công bố,
          phiếu trong app vẫn là số cũ. Lọc &quot;Cần công bố lại&quot;, chọn hết rồi bấm Công bố.
        </p>
      ) : null}
      <div className={styles.summary}>
        <section className={styles.main} aria-label="Kỳ lương">
          <div className={styles.mainHead}>
            <h2 className={styles.mainTitle}>Kỳ lương {periodTitle(period.key).toLowerCase()}</h2>
            <span className={styles.statusGroup}>
              <span className={status.published ? styles.statusDone : styles.statusWarn}>
                {status.published ? <CheckCircleOutlined /> : null}
                {statusLabel}
              </span>
              {status.stale ? (
                <span className={styles.statusWarn}>{status.staleCount} cần công bố lại</span>
              ) : null}
            </span>
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
              Lần công bố gần nhất lúc{' '}
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
          {/* Thẻ kỳ luôn là cả kỳ; người đã chọn công bố ở thanh cuối danh sách */}
          <div className={styles.mainActions}>
            <PublishDialog payroll={payroll} picked={[]} onDone={clearPicked} />
            {status.published && canUnpublish ? (
              <UnpublishButton payroll={payroll} picked={[]} onDone={clearPicked} />
            ) : null}
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
          <Checkbox
            checked={allShown}
            indeterminate={!allShown && rows.some(({ id }) => picked.has(id))}
            disabled={rows.length === 0}
            onChange={(event) => toggleShown(event.target.checked)}
          >
            Chọn tất cả {rows.length} người đang hiện
          </Checkbox>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên hoặc email"
            aria-label="Tìm theo tên hoặc email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.chips}>
            {filters.map(({ value, label, match }) => {
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
                <div
                  key={row.id}
                  className={`${styles.rowWrap} ${desktop && row.id === selected?.id ? styles.rowActive : ''}`}
                >
                  {/* Checkbox của AntD đã là label, bọc bằng div để không lồng label */}
                  <div className={styles.rowCheck}>
                    <Checkbox
                      aria-label={`Chọn ${row.name}`}
                      checked={picked.has(row.id)}
                      onChange={(event) => toggle(row.id, event.target.checked)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-current={row.id === selected?.id ? 'true' : undefined}
                    className={styles.row}
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
                        {row.otApprovedMin !== 0 ? hoursMinutes(row.otApprovedMin) : 0}
                      </span>
                    </span>
                    <span className={styles.rowEnd}>
                      <strong className={row.net < 0 ? styles.alert : ''}>{formatNumber(row.net)}</strong>
                      {row.ready ? (
                        <span className={styles.ready}>Sẵn sàng</span>
                      ) : (
                        <span className={styles.issues}>{row.issues} việc</span>
                      )}
                      {status.published ? (
                        <span className={styles[SLIP_LABELS[row.slip].className]}>
                          {SLIP_LABELS[row.slip].text}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {pickedRows.length > 0 ? (
            // Dính ở cuối thẻ: chọn xong công bố ngay, không phải cuộn lên thẻ kỳ lương
            <div className={styles.pickBar} role="region" aria-label="Người đã chọn">
              <span>
                Đã chọn <strong>{pickedRows.length}</strong> ·{' '}
                <button type="button" className={styles.linkButton} onClick={clearPicked}>
                  Bỏ chọn
                </button>
              </span>
              <span className={styles.pickBarActions}>
                <PublishDialog payroll={payroll} picked={pickedRows} onDone={clearPicked} />
                {status.published && canUnpublish ? (
                  <UnpublishButton payroll={payroll} picked={pickedRows} onDone={clearPicked} />
                ) : null}
              </span>
            </div>
          ) : null}
        </section>

        {desktop && selected ? (
          <section className={styles.panel} aria-label="Sao kê">
            <PayStatementView employeeId={selected.id} periodKey={period.key} slip={selected.slip} />
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
            {opened ? (
              <PayStatementView employeeId={opened.id} periodKey={period.key} slip={opened.slip} />
            ) : null}
          </div>
        </Drawer>
      )}
    </div>
  );
}
