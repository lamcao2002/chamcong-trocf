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
import styles from './EmployeeScreen.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

/** Đếm lùi theo phút cho hạn sửa; vẽ lại mỗi 15 giây để nút tự ẩn khi hết hạn. */
const TICK_MS = 15_000;
const MINUTE_MS = 60_000;

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
  const [now, setNow] = useState(() => Date.now());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ requests: MyRequestView[] }>('/api/v1/app/requests', 'GET').then((result) => {
      if (result.ok) setRows(result.requests);
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

  return (
    <main className={styles.body}>
      <div className={styles.card}>
        <h1 className={styles.title}>Tôi</h1>
        <p className={styles.muted}>Thông tin cá nhân sẽ được bổ sung sau.</p>
      </div>

      <div className={`${styles.card} ${styles.followCard}`}>
        <strong>Đơn của tôi</strong>
        {rows?.length === 0 ? <p className={styles.muted}>Bạn chưa gửi đơn nào.</p> : null}
        <ul className={styles.requestList}>
          {(rows ?? []).map((request) => {
            const { id, summary, fromDate, toDate, status, rejectNote, type } = request;
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
                  <Tag
                    color={status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default'}
                  >
                    {STATUS_LABELS[status]}
                  </Tag>
                </div>
                {open ? (
                  <div className={styles.requestActions}>
                    <span className={styles.timelineSub}>
                      {deadlineText(request.editableUntil!, now, registering)}
                    </span>
                    <span className={styles.requestButtons}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(request)}>
                        Sửa
                      </Button>
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
