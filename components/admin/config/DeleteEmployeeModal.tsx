'use client';

import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Skeleton, Typography } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatNumber } from '@/lib/format';
import type { DeletionImpact } from '@/lib/services/employees';
import styles from './config.module.css';

type DeleteEmployeeModalProps = {
  employee: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted: () => void;
};

/** Cảnh báo trước khi xoá hẳn: nêu số dữ liệu sẽ mất và bắt gõ lại email. */
export function DeleteEmployeeModal({ employee, onClose, onDeleted }: DeleteEmployeeModalProps) {
  const toast = useToast();
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setImpact(null);
    setTyped('');
    if (!employee) return;
    void apiRequest<{ impact: DeletionImpact }>(`/api/v1/employees/${employee.id}/deletion`, 'GET').then(
      (result) => {
        if (result.ok) setImpact(result.impact);
        else {
          toast.error(result.error);
          onClose();
        }
      },
    );
  }, [employee, toast, onClose]);

  const matches = impact !== null && typed.trim().toLowerCase() === impact.email;

  const remove = async () => {
    if (!employee) return;
    setDeleting(true);
    const result = await apiRequest(`/api/v1/employees/${employee.id}`, 'DELETE', { email: typed });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Đã xoá ${employee.name}`);
    onDeleted();
  };

  const lines = impact
    ? [
        [impact.punches, 'lần chấm công'],
        [impact.days, 'ngày công'],
        [impact.requests, 'đơn từ'],
        [impact.payslips, 'phiếu lương đã công bố'],
        [impact.adjustments, 'khoản thưởng/phạt'],
      ].filter(([total]) => Number(total) > 0)
    : [];

  return (
    <Modal
      open={employee !== null}
      title={`Xoá hẳn ${employee?.name ?? ''}?`}
      okText="Xoá vĩnh viễn"
      okButtonProps={{ danger: true, disabled: !matches }}
      cancelText="Giữ lại"
      confirmLoading={deleting}
      destroyOnHidden
      onOk={() => void remove()}
      onCancel={onClose}
    >
      {impact ? (
        <>
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="Không khôi phục được"
            description="Hồ sơ và mọi dữ liệu của người này bị xoá. Bảng công và lương các kỳ trước sẽ không còn người này. Chỉ muốn ngừng cho đăng nhập thì chuyển sang Đã nghỉ."
          />
          {lines.length > 0 ? (
            <ul className={styles.impactList}>
              {lines.map(([total, label]) => (
                <li key={label}>
                  {formatNumber(Number(total))} {label}
                </li>
              ))}
            </ul>
          ) : (
            <Typography.Paragraph type="secondary">
              Người này chưa có dữ liệu chấm công hay lương.
            </Typography.Paragraph>
          )}
          <Typography.Paragraph>
            Gõ <strong>{impact.email}</strong> để xác nhận:
          </Typography.Paragraph>
          <Input
            aria-label="Email xác nhận"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </>
      ) : (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      )}
    </Modal>
  );
}
