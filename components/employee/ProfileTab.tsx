'use client';

import { useEffect, useState } from 'react';
import { Button, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { formatClock, formatDate } from '@/lib/format';
import type { MyRequestView } from '@/lib/services/requests';
import type { IncomingPass } from '@/lib/services/shift-pass';
import styles from './EmployeeScreen.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

/** Pass ca do người nhận trả lời nên nhãn đọc theo người nhận. */
const PASS_LABELS: Record<string, string> = {
  pending: 'Chờ người nhận',
  approved: 'Đã nhận',
  rejected: 'Bị từ chối',
};

function statusOf({ type, status, expired }: MyRequestView) {
  const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default';
  if (type !== 'shift_pass') return { label: STATUS_LABELS[status], color };
  if (expired) return { label: 'Hết hạn', color: 'warning' };
  return { label: PASS_LABELS[status], color };
}

/** Đếm lùi theo phút cho hạn sửa; vẽ lại mỗi 15 giây để nút tự ẩn khi hết hạn. */
const TICK_MS = 15_000;
const MINUTE_MS = 60_000;

/** "17:00 05/11" theo giờ Việt Nam. */
const moment = (iso: string) => `${formatClock(iso)} ${formatDate(vietnamToday(new Date(iso))).slice(0, 5)}`;

function deadlineText(until: string, now: number, registering: boolean) {
  if (registering)
    return `Sửa, xoá được tới ${formatClock(until)} ${formatDate(vietnamToday(new Date(until))).slice(0, 5)}`;
  const minutes = Math.max(1, Math.ceil((Date.parse(until) - now) / MINUTE_MS));
  return `Sửa, xoá được trong ${minutes} phút nữa`;
}

type ProfileTabProps = {
  reloadKey: number;
  onEdit: (request: MyRequestView) => void;
  onChanged: () => void;
};

/** Tab Tôi: hiện có Đơn của tôi; thông tin cá nhân và cài đặt bổ sung sau. */
export function ProfileTab({ reloadKey, onEdit, onChanged }: ProfileTabProps) {
  const toast = useToast();
  const confirm = useConfirmDiscard();
  const [rows, setRows] = useState<MyRequestView[] | null>(null);
  const [incoming, setIncoming] = useState<IncomingPass[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const url = '/api/v1/app/requests';
    void apiRequest<{ requests: MyRequestView[]; incoming: IncomingPass[] }>(url, 'GET').then((result) => {
      if (!result.ok) return;
      setRows(result.requests);
      setIncoming(result.incoming);
    });
  }, [reloadKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const remove = async (request: MyRequestView) => {
    const confirmed = await confirm({
      title: 'Xoá đơn này?',
      content: `${request.summary} · ${formatDate(request.fromDate)}. Đơn bị xoá hẳn, quản lý không còn thấy.`,
      okText: 'Xoá đơn',
    });
    if (!confirmed) return;
    setDeleting(request.id);
    const result = await apiRequest(`/api/v1/app/requests/${request.id}`, 'DELETE');
    setDeleting(null);
    if (!result.ok) {
      toast.error(result.error);
      onChanged();
      return;
    }
    toast.success('Đã xoá đơn');
    onChanged();
  };

  const answer = async (pass: IncomingPass, decision: 'accept' | 'decline') => {
    const accept = decision === 'accept';
    const confirmed = await confirm({
      title: accept
        ? `Nhận ${pass.shiftName} ${formatDate(pass.fromDate).slice(0, 5)}?`
        : 'Không nhận ca này?',
      content: accept
        ? `Ca của ${pass.fromName} sẽ chuyển sang lịch của bạn ngay.`
        : `${pass.fromName} vẫn giữ ca và sẽ được báo là bạn không nhận.`,
      okText: accept ? 'Nhận ca' : 'Không nhận',
      danger: !accept,
    });
    if (!confirmed) return;
    setAnswering(pass.id);
    const result = await apiRequest(`/api/v1/app/requests/${pass.id}/respond`, 'POST', { decision });
    setAnswering(null);
    if (!result.ok) toast.error(result.error);
    else toast.success(accept ? 'Đã nhận ca, lịch của bạn đã cập nhật' : 'Đã báo không nhận ca');
    onChanged();
  };

  return (
    <main className={styles.body}>
      <div className={styles.card}>
        <h1 className={styles.title}>Tôi</h1>
        <p className={styles.muted}>Thông tin cá nhân sẽ được bổ sung sau.</p>
      </div>

      {incoming.length > 0 ? (
        <section className={`${styles.card} ${styles.followCard}`} aria-label="Pass ca gửi tới bạn">
          <strong>Pass ca gửi tới bạn</strong>
          <ul className={styles.requestList}>
            {incoming.map((pass) => (
              <li key={pass.id}>
                <div className={styles.requestRow}>
                  <span>
                    <strong>{pass.fromName}</strong> pass {pass.shiftName} {pass.startTime}–{pass.endTime} ·{' '}
                    {formatDate(pass.fromDate).slice(0, 5)}
                    {pass.positionName ? ` · ${pass.positionName}` : ''}
                  </span>
                </div>
                {pass.reason ? <p className={styles.timelineSub}>Lý do: {pass.reason}</p> : null}
                <div className={styles.requestActions}>
                  <span className={styles.timelineSub}>Trả lời trước {moment(pass.startsAt)}</span>
                  <span className={styles.requestButtons}>
                    <Button
                      size="small"
                      danger
                      loading={answering === pass.id}
                      onClick={() => void answer(pass, 'decline')}
                    >
                      Không nhận
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      loading={answering === pass.id}
                      onClick={() => void answer(pass, 'accept')}
                    >
                      Nhận ca
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={`${styles.card} ${styles.followCard}`}>
        <strong>Đơn của tôi</strong>
        {rows?.length === 0 ? <p className={styles.muted}>Bạn chưa gửi đơn nào.</p> : null}
        <ul className={styles.requestList}>
          {(rows ?? []).map((request) => {
            const { id, summary, fromDate, toDate, rejectNote, type } = request;
            const open = request.editableUntil !== null && Date.parse(request.editableUntil) > now;
            const registering = type === 'shift_register';
            return (
              <li key={id}>
                <div className={styles.requestRow}>
                  <span>
                    {summary} · {formatDate(fromDate).slice(0, 5)}
                    {toDate === fromDate ? '' : `–${formatDate(toDate).slice(0, 5)}`}
                    {rejectNote ? <span className={styles.timelineSub}> · {rejectNote}</span> : null}
                  </span>
                  <Tag color={statusOf(request).color}>{statusOf(request).label}</Tag>
                </div>
                {open ? (
                  <div className={styles.requestActions}>
                    <span className={styles.timelineSub}>
                      {deadlineText(request.editableUntil!, now, registering)}
                    </span>
                    <span className={styles.requestButtons}>
                      {type === 'shift_pass' ? null : (
                        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(request)}>
                          Sửa
                        </Button>
                      )}
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deleting === id}
                        onClick={() => void remove(request)}
                      >
                        Xoá
                      </Button>
                    </span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
