'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Empty, Flex, Grid, Input, Segmented, Select, Skeleton, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { groupByKind, isMismatch, quantityDiff } from '@/lib/domain/inventory';
import { formatClock, formatDate, formatDecimal } from '@/lib/format';
import type { InventoryReportDetail, InventoryReportRow } from '@/lib/services/inventory';
import { themeCssVars, tokens } from '@/lib/theme/tokens';
import styles from './inventory.module.css';

type Status = 'all' | InventoryReportRow['status'];

const STATUS_LABELS: Record<InventoryReportRow['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const STATUS_COLORS: Record<InventoryReportRow['status'], string> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
};

/** "09:05 03/11" theo giờ Việt Nam. */
const moment = (iso: string) => `${formatClock(iso)} ${formatDate(vietnamToday(new Date(iso))).slice(0, 5)}`;

const signed = (value: number) => (value > 0 ? `+${formatDecimal(value)}` : formatDecimal(value));

function MismatchTag({ row }: { row: InventoryReportRow }) {
  return row.mismatchCount > 0 ? (
    <Tag color="error">{row.mismatchCount} món lệch</Tag>
  ) : (
    <Tag color="success">Khớp hết</Tag>
  );
}

function decisionText(row: InventoryReportRow) {
  if (row.status === 'pending') return 'Chưa ai xử lý';
  const who = row.deciderName ?? 'Người đã bị xoá';
  return `${row.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi ${who}${row.decidedAt ? ` lúc ${moment(row.decidedAt)}` : ''}`;
}

function LinesTable({ report }: { report: InventoryReportDetail }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.lines}>
        <thead>
          <tr>
            <th scope="col">Món</th>
            <th scope="col" className={styles.num}>
              Hiện có
            </th>
            <th scope="col" className={styles.num}>
              Đếm
            </th>
            <th scope="col" className={styles.num}>
              Lệch
            </th>
          </tr>
        </thead>
        <tbody>
          {groupByKind(report.lines).flatMap(({ kind, label, rows }, _index, groups) => [
            ...(groups.length > 1
              ? [
                  <tr key={kind} className={styles.groupRow}>
                    <th scope="colgroup" colSpan={4}>
                      {label}
                    </th>
                  </tr>,
                ]
              : []),
            ...rows.map((line) => {
              const off = isMismatch(line.expected, line.counted);
              // Số hiện có đã bị đổi sau lúc gửi: duyệt sẽ ghi đè bằng số đếm
              const moved =
                report.status === 'pending' &&
                line.current !== null &&
                isMismatch(line.current, line.expected);
              return (
                <tr key={line.id} className={off ? styles.lineOff : undefined}>
                  <td>
                    <strong>{line.name}</strong> <span className={styles.muted}>{line.unit}</span>
                    {line.note ? <div className={styles.lineNote}>Lý do: {line.note}</div> : null}
                    {line.current === null ? (
                      <div className={styles.muted}>Món đã bị xoá khỏi danh mục</div>
                    ) : null}
                    {moved ? (
                      <div className={styles.muted}>
                        Số hiện có đã đổi thành {formatDecimal(line.current!)}
                      </div>
                    ) : null}
                  </td>
                  <td className={styles.num}>{formatDecimal(line.expected)}</td>
                  <td className={styles.num}>
                    <strong>{formatDecimal(line.counted)}</strong>
                  </td>
                  <td className={styles.num}>
                    {off ? signed(quantityDiff(line.expected, line.counted)) : '—'}
                  </td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}

type ReportsTabProps = { reports: InventoryReportRow[] };

/** Báo cáo kiểm kê: chờ duyệt đứng đầu; bấm một báo cáo để xem từng món, duyệt hoặc từ chối. */
export function ReportsTab({ reports }: ReportsTabProps) {
  const router = useRouter();
  const toast = useToast();
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [status, setStatus] = useState<Status>(
    reports.some((row) => row.status === 'pending') ? 'pending' : 'all',
  );
  const [sheet, setSheet] = useState<string>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryReportDetail | null>(null);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const count = (value: Status) =>
    value === 'all' ? reports.length : reports.filter((row) => row.status === value).length;
  const statusOptions = (['pending', 'approved', 'rejected', 'all'] as const).map((value) => ({
    value,
    label: `${value === 'all' ? 'Tất cả' : STATUS_LABELS[value]} (${count(value)})`,
  }));
  const names = [...new Set(reports.map((row) => row.sheetName))];
  const visible = useMemo(
    () =>
      reports.filter(
        (row) => (status === 'all' || row.status === status) && (!sheet || row.sheetName === sheet),
      ),
    [reports, status, sheet],
  );
  const open = reports.find(({ id }) => id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    setDetail(null);
    void apiRequest<{ report: InventoryReportDetail }>(`/api/v1/inventory/reports/${openId}`, 'GET').then(
      (result) => {
        if (cancelled) return;
        if (result.ok) setDetail(result.report);
        else toast.error(result.error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [openId, toast]);

  const close = () => {
    setOpenId(null);
    setNote('');
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!open) return;
    setPosting(true);
    const result = await apiRequest(`/api/v1/inventory/reports/${open.id}/decide`, 'POST', {
      decision,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === 'approve' ? 'Đã duyệt, số hiện có đã cập nhật' : 'Đã từ chối, giữ số cũ');
    close();
    startRefresh(() => router.refresh());
  };

  const pending = open?.status === 'pending';
  const editing = open?.editableUntil ? Date.parse(open.editableUntil) > Date.now() : false;

  return (
    <>
      <div className={styles.filters}>
        {desktop ? (
          <Segmented<Status> value={status} onChange={setStatus} options={statusOptions} />
        ) : (
          <Select<Status>
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            options={statusOptions}
            style={{ flex: '1 1 150px' }}
          />
        )}
        <Select
          allowClear
          placeholder="Mọi phiếu"
          aria-label="Lọc theo phiếu"
          value={sheet}
          onChange={setSheet}
          options={names.map((name) => ({ value: name, label: name }))}
          style={{ flex: '1 1 150px', maxWidth: 220 }}
        />
      </div>

      {visible.length === 0 ? (
        <Empty
          description={reports.length === 0 ? 'Chưa có báo cáo kiểm kê nào' : 'Không có báo cáo khớp bộ lọc'}
        />
      ) : (
        <ul className={styles.list}>
          {visible.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={styles.row}
                aria-label={`${row.employeeName}, ${row.sheetName}, ${formatDate(row.date)}, ${STATUS_LABELS[row.status]}`}
                onClick={() => setOpenId(row.id)}
              >
                <span className={styles.rowMain}>
                  <span>
                    <strong>{row.employeeName}</strong>
                    <span className={styles.muted}> · {row.sheetName}</span>
                  </span>
                  <span>
                    {formatDate(row.date)}
                    {row.shiftName ? ` · ${row.shiftName}` : ''} · {row.positionName} · {row.lineCount} món
                  </span>
                  <span className={styles.muted}>
                    Gửi {moment(row.createdAt)}
                    {row.updatedAt ? `, sửa ${moment(row.updatedAt)}` : ''} · {decisionText(row)}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <Tag color={STATUS_COLORS[row.status]}>{STATUS_LABELS[row.status]}</Tag>
                  <MismatchTag row={row} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={open !== null}
        title={open ? `${open.employeeName} · ${open.sheetName}` : ''}
        placement={desktop ? 'right' : 'bottom'}
        width={desktop ? Math.max(tokens.formDrawerWidth, 640) : '100%'}
        height="100%"
        destroyOnHidden
        // Drawer nằm ngoài vùng đặt biến CSS của trang
        rootStyle={themeCssVars()}
        onClose={close}
        footer={
          pending ? (
            <Flex justify="flex-end" gap={8}>
              <Button
                danger
                icon={<CloseOutlined />}
                loading={posting}
                disabled={refreshing || !detail}
                onClick={() => void decide('reject')}
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={posting}
                disabled={refreshing || !detail}
                onClick={() => void decide('approve')}
              >
                Duyệt, cập nhật số
              </Button>
            </Flex>
          ) : null
        }
        styles={{ footer: { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } }}
      >
        {open ? (
          <dl className={styles.detail}>
            <dt>Trạng thái</dt>
            <dd>
              <Tag color={STATUS_COLORS[open.status]}>{STATUS_LABELS[open.status]}</Tag>{' '}
              <MismatchTag row={open} />
            </dd>
            <dt>Ca</dt>
            <dd>
              {formatDate(open.date)}
              {open.shiftName ? ` · ${open.shiftName}` : ''} · {open.positionName}
            </dd>
            <dt>Gửi lúc</dt>
            <dd>
              {moment(open.createdAt)}
              {open.updatedAt ? `, sửa lúc ${moment(open.updatedAt)}` : ''}
            </dd>
            <dt>Xử lý</dt>
            <dd>{decisionText(open)}</dd>
            {open.decisionNote ? (
              <>
                <dt>Ghi chú</dt>
                <dd>{open.decisionNote}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {pending && editing ? (
          <Typography.Paragraph type="secondary">
            Nhân viên còn sửa được báo cáo này tới {formatClock(open!.editableUntil!)}. Duyệt bây giờ thì báo
            cáo khoá lại.
          </Typography.Paragraph>
        ) : null}
        {detail ? <LinesTable report={detail} /> : <Skeleton active paragraph={{ rows: 4 }} title={false} />}
        {pending ? (
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>Ghi chú cho nhân viên (không bắt buộc)</Typography.Text>
            <Input.TextArea
              rows={2}
              maxLength={500}
              value={note}
              aria-label="Ghi chú cho nhân viên"
              onChange={(event) => setNote(event.target.value)}
              style={{ marginTop: 6 }}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              Duyệt: số đếm của từng món thành số hiện có mới. Từ chối: giữ số hiện có như cũ.
            </Typography.Paragraph>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
