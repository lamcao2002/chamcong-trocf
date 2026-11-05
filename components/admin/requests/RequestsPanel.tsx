'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Empty, Flex, Grid, Input, Segmented, Select, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { formatClock, formatDate } from '@/lib/format';
import type { RequestHistoryRow, RequestHistoryView } from '@/lib/services/request-history';
import { tokens } from '@/lib/theme/tokens';
import styles from './requests.module.css';

type Status = 'all' | RequestHistoryRow['status'];

const STATUS_LABELS: Record<RequestHistoryRow['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const STATUS_COLORS: Record<RequestHistoryRow['status'], string> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
};

const TYPE_LABELS: Record<RequestHistoryRow['type'], string> = {
  leave: 'Nghỉ phép',
  late_early: 'Muộn / sớm',
  overtime: 'Làm thêm',
  shift_swap: 'Đổi ca',
  shift_pass: 'Pass ca',
  shift_register: 'Đăng ký ca',
  forgot: 'Quên chấm',
};

/** "09:05 03/11" theo giờ Việt Nam. */
const moment = (iso: string) => `${formatClock(iso)} ${formatDate(vietnamToday(new Date(iso))).slice(0, 5)}`;

const dateRange = ({ fromDate, toDate }: RequestHistoryRow) =>
  fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate).slice(0, 5)} – ${formatDate(toDate)}`;

/** Nhãn trạng thái: pass ca do người nhận trả lời nên đọc theo người nhận. */
function statusLabel(row: RequestHistoryRow) {
  if (row.type !== 'shift_pass') return STATUS_LABELS[row.status];
  if (row.expired) return 'Hết hạn';
  return { pending: 'Chờ người nhận', approved: 'Đã nhận', rejected: 'Người nhận từ chối' }[row.status];
}

function decisionText(row: RequestHistoryRow) {
  if (row.type === 'shift_pass') {
    if (row.expired) return `${row.targetName ?? 'Người nhận'} chưa trả lời trước giờ vào ca`;
    if (row.status === 'pending') return `Chờ ${row.targetName ?? 'người nhận'} đồng ý`;
  }
  if (row.status === 'pending') return row.inDraft ? 'Đã nhận vào nháp, chờ Công bố' : 'Chưa ai xử lý';
  const who = row.deciderName ?? (row.deciderRemoved ? 'Người đã bị xoá' : 'Hệ thống');
  if (row.type === 'shift_pass') {
    return `${who} ${row.status === 'approved' ? 'đã nhận' : 'không nhận'}${row.decidedAt ? ` lúc ${moment(row.decidedAt)}` : ''}`;
  }
  return `${row.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi ${who}${row.decidedAt ? ` lúc ${moment(row.decidedAt)}` : ''}`;
}

/** Màn Đơn từ: mọi đơn của kỳ, lọc theo trạng thái, loại, tên; bấm một đơn để xem chi tiết và xử lý. */
export function RequestsPanel({ history }: { history: RequestHistoryView }) {
  const router = useRouter();
  const toast = useToast();
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [status, setStatus] = useState<Status>('all');
  const [type, setType] = useState<RequestHistoryRow['type']>();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const count = (value: Status) =>
    value === 'all' ? history.requests.length : history.requests.filter((row) => row.status === value).length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return history.requests.filter(
      (row) =>
        (status === 'all' || row.status === status) &&
        (!type || row.type === type) &&
        (!needle || row.employeeName.toLowerCase().includes(needle)),
    );
  }, [history.requests, status, type, query]);
  const open = history.requests.find(({ id }) => id === openId) ?? null;
  const statusOptions = (['all', 'pending', 'approved', 'rejected'] as const).map((value) => ({
    value,
    label: `${value === 'all' ? 'Tất cả' : STATUS_LABELS[value]} (${count(value)})`,
  }));

  const close = () => {
    setOpenId(null);
    setNote('');
  };

  const decide = async (row: RequestHistoryRow, decision: 'approve' | 'reject') => {
    setPosting(true);
    const result = await apiRequest(`/api/v1/requests/${row.id}/decide`, 'POST', {
      decision,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const drafted = decision === 'approve' && row.type === 'shift_register';
    toast.success(
      decision === 'reject' ? 'Đã từ chối đơn' : drafted ? 'Đã nhận vào nháp lịch' : 'Đã duyệt đơn',
    );
    close();
    startRefresh(() => router.refresh());
  };

  const { period, previousKey, nextKey } = history;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <nav className={styles.periodNav} aria-label="Chọn kỳ">
          <Link
            className={styles.periodLink}
            href={`/app/don-tu?period=${previousKey}`}
            aria-label="Kỳ trước"
          >
            <LeftOutlined />
          </Link>
          <strong>
            {formatDate(period.from)} – {formatDate(period.to)}
          </strong>
          {nextKey ? (
            <Link className={styles.periodLink} href={`/app/don-tu?period=${nextKey}`} aria-label="Kỳ sau">
              <RightOutlined />
            </Link>
          ) : null}
        </nav>
      </div>

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
          placeholder="Mọi loại đơn"
          aria-label="Lọc theo loại đơn"
          value={type}
          onChange={setType}
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          style={{ flex: '1 1 150px', maxWidth: 220 }}
        />
        <Input.Search
          allowClear
          placeholder="Tìm tên"
          aria-label="Tìm tên"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: '1 1 160px', maxWidth: 260 }}
        />
      </div>

      {visible.length === 0 ? (
        <Empty
          description={history.requests.length === 0 ? 'Kỳ này chưa có đơn nào' : 'Không có đơn khớp bộ lọc'}
        />
      ) : (
        <ul className={styles.list}>
          {visible.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={styles.row}
                aria-label={`${row.employeeName}, ${TYPE_LABELS[row.type]}, ${dateRange(row)}, ${statusLabel(row)}`}
                onClick={() => setOpenId(row.id)}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    <strong>{row.employeeName}</strong>
                    <span className={styles.muted}> · {TYPE_LABELS[row.type]}</span>
                  </span>
                  <span>
                    {row.summary} · {dateRange(row)}
                  </span>
                  <span className={styles.muted}>
                    Gửi {moment(row.createdAt)} · {decisionText(row)}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <Tag color={row.expired ? 'warning' : STATUS_COLORS[row.status]}>{statusLabel(row)}</Tag>
                  {row.inDraft ? <Tag>Trong nháp</Tag> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={open !== null}
        title={open ? `${open.employeeName} · ${TYPE_LABELS[open.type]}` : ''}
        placement={desktop ? 'right' : 'bottom'}
        width={desktop ? tokens.formDrawerWidth : '100%'}
        height="100%"
        destroyOnHidden
        onClose={close}
        footer={
          open?.decidable && !open.inDraft ? (
            <Flex justify="flex-end" gap={8}>
              <Button
                danger
                icon={<CloseOutlined />}
                loading={posting}
                disabled={refreshing}
                onClick={() => void decide(open, 'reject')}
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={posting}
                disabled={refreshing}
                onClick={() => void decide(open, 'approve')}
              >
                {open.type === 'shift_register' ? 'Nhận vào nháp' : 'Duyệt'}
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
              <Tag color={open.expired ? 'warning' : STATUS_COLORS[open.status]}>{statusLabel(open)}</Tag>
            </dd>
            <dt>Nội dung</dt>
            <dd>{open.summary}</dd>
            <dt>Ngày</dt>
            <dd>{dateRange(open)}</dd>
            <dt>Lý do</dt>
            <dd>{open.reason || '—'}</dd>
            <dt>Vị trí</dt>
            <dd>{open.positionName ?? 'Chưa có vị trí'}</dd>
            <dt>Gửi lúc</dt>
            <dd>{moment(open.createdAt)}</dd>
            <dt>Xử lý</dt>
            <dd>{decisionText(open)}</dd>
            {open.rejectNote ? (
              <>
                <dt>Lý do từ chối</dt>
                <dd>{open.rejectNote}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {open?.decidable && !open.inDraft ? (
          <>
            <Typography.Text strong>Ghi chú khi từ chối (không bắt buộc)</Typography.Text>
            <Input.TextArea
              rows={2}
              maxLength={500}
              value={note}
              aria-label="Ghi chú khi từ chối"
              onChange={(event) => setNote(event.target.value)}
              style={{ marginTop: 6 }}
            />
          </>
        ) : null}
        {open?.inDraft ? (
          <Typography.Paragraph type="secondary">
            Ca này đã nằm trong nháp lịch. Mở <Link href="/app/xep-ca">Xếp ca</Link> để công bố hoặc bỏ nháp.
          </Typography.Paragraph>
        ) : null}
      </Drawer>
    </div>
  );
}
