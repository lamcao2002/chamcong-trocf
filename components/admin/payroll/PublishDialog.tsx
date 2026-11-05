'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Modal } from 'antd';
import { RollbackOutlined, SendOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { formatMoney } from '@/lib/format';
import type { PayrollView } from '@/lib/services/payroll';
import styles from './payroll.module.css';

type Row = PayrollView['employees'][number];

type PickProps = {
  payroll: PayrollView;
  /** Người đã tích trong danh sách; trống là cả kỳ. */
  picked: readonly Row[];
  onDone: () => void;
};

/** Body gửi kèm: chỉ khi có chọn người, không có body là cả kỳ. */
const pickBody = (picked: readonly Row[]) =>
  picked.length > 0 ? { employeeIds: picked.map(({ id }) => id) } : undefined;

/**
 * Nút Công bố và hộp xác nhận: nêu số phiếu, tổng tiền, việc tồn, OT chờ trước khi đóng băng (US36).
 * Có chọn người thì chỉ công bố những người đó, phiếu người khác giữ nguyên.
 */
export function PublishDialog({ payroll, picked, onDone }: PickProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startRefresh] = useTransition();
  const { period, status, review, otPending } = payroll;
  const partial = picked.length > 0;
  const targets = partial ? picked : payroll.employees;
  const headcount = targets.length;
  const fund = targets.reduce((sum, { net }) => sum + net, 0);
  const issues = partial ? picked.reduce((sum, { issues: count }) => sum + count, 0) : review.items;
  const issuePeople = partial ? picked.filter(({ issues: count }) => count > 0).length : review.people;
  const otMinutes = partial
    ? picked.reduce((sum, { otPendingMin }) => sum + otPendingMin, 0)
    : otPending.minutes;

  const today = vietnamToday();
  const running = period.to >= today;
  const negative = targets.filter(({ net }) => net < 0).length;
  // Cả nhóm đã chọn đều đã có phiếu thì là công bố lại
  const again = partial ? picked.every(({ slip }) => slip !== 'none') : status.published;
  const changed = partial ? picked.some(({ slip }) => slip !== 'published') : status.stale || !again;

  if (period.from > today) return null;

  const publish = async () => {
    setSaving(true);
    const result = await apiRequest(`/api/v1/payroll/publish?period=${period.key}`, 'POST', pickBody(picked));
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(
      partial
        ? `Đã công bố phiếu lương cho ${headcount} người`
        : again
          ? 'Đã công bố lại phiếu lương'
          : 'Đã công bố phiếu lương',
    );
    onDone();
    startRefresh(() => router.refresh());
  };

  return (
    <>
      {/* Đã công bố mà số không đổi thì Công bố lại chỉ là nút phụ */}
      <Button type={changed ? 'primary' : 'default'} icon={<SendOutlined />} onClick={() => setOpen(true)}>
        {partial
          ? `${again ? 'Công bố lại' : 'Công bố'} ${headcount} người đã chọn`
          : again
            ? 'Công bố lại'
            : 'Công bố phiếu lương'}
      </Button>
      <Modal
        open={open}
        title={again ? 'Công bố lại phiếu lương' : 'Công bố phiếu lương'}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        footer={[
          issues > 0 ? (
            <Button key="inbox" href="/app">
              Xử lý trước ở Hộp việc
            </Button>
          ) : null,
          <Button key="cancel" disabled={saving} onClick={() => setOpen(false)}>
            Huỷ
          </Button>,
          <Button key="publish" type="primary" loading={saving} onClick={() => void publish()}>
            Công bố {headcount} phiếu
          </Button>,
        ]}
      >
        <ul className={styles.notices}>
          <li>
            <strong>{headcount} nhân viên</strong> sẽ thấy phiếu lương kỳ này trong app. Tổng thực lĩnh{' '}
            <strong>{formatMoney(fund)}</strong>.{partial ? ' Phiếu của những người khác giữ nguyên.' : ''}
          </li>
          {partial ? (
            <li className={styles.noticeInfo}>{picked.map(({ name }) => name).join(', ')}</li>
          ) : null}
          {issues > 0 ? (
            <li className={styles.noticeWarn}>
              Còn <strong>{issues} việc</strong> của {issuePeople} người chưa xử lý.
            </li>
          ) : null}
          {otMinutes > 0 ? (
            <li className={styles.noticeOt}>
              Còn <strong>{otMinutes} phút OT chờ duyệt</strong> chưa được tính.
              {partial ? null : (
                <>
                  {' '}
                  Nếu duyệt hết, quỹ lương tăng thêm khoảng <strong>{formatMoney(otPending.amount)}</strong>.
                </>
              )}
            </li>
          ) : null}
          {running ? (
            <li className={styles.noticeWarn}>Kỳ này chưa kết thúc, chấm công tiếp sẽ cần công bố lại.</li>
          ) : null}
          {negative > 0 ? (
            <li className={styles.noticeWarn}>
              Có <strong>{negative} phiếu thực lĩnh âm</strong>.
            </li>
          ) : null}
          <li className={styles.noticeInfo}>
            Phiếu sẽ được đóng băng theo số liệu lúc này. Nếu sau đó sửa công, duyệt OT hay thêm thưởng/phạt
            thì phải công bố lại để nhân viên thấy số mới.
          </li>
        </ul>
      </Modal>
    </>
  );
}

/**
 * Huỷ công bố: xoá phiếu đã chụp, nhân viên hết thấy phiếu kỳ này; chỉ Quản trị viên. Có chọn người
 * thì chỉ thu hồi phiếu của người đã có phiếu trong nhóm đó.
 */
export function UnpublishButton({ payroll, picked, onDone }: PickProps) {
  const router = useRouter();
  const toast = useToast();
  const { modal } = App.useApp();
  const [, startRefresh] = useTransition();
  const { period, status } = payroll;
  const withSlip = picked.filter(({ slip }) => slip !== 'none');
  const partial = picked.length > 0;
  if (partial && withSlip.length === 0) return null;
  const people = partial ? withSlip.length : status.count;

  const confirm = () =>
    modal.confirm({
      title: 'Huỷ công bố phiếu lương?',
      content: `${people} nhân viên sẽ không còn thấy phiếu kỳ này trong app và nhận thông báo phiếu đã thu hồi. Sửa xong thì công bố lại.`,
      okText: 'Huỷ công bố',
      okButtonProps: { danger: true },
      cancelText: 'Giữ phiếu',
      onOk: async () => {
        const result = await apiRequest(
          `/api/v1/payroll/publish?period=${period.key}`,
          'DELETE',
          pickBody(withSlip),
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          partial
            ? `Đã huỷ công bố ${people} người, họ không còn thấy phiếu kỳ này`
            : 'Đã huỷ công bố, nhân viên không còn thấy phiếu kỳ này',
        );
        onDone();
        startRefresh(() => router.refresh());
      },
    });

  return (
    <Button type="text" danger icon={<RollbackOutlined />} onClick={confirm}>
      {partial ? `Huỷ công bố ${people} người` : 'Huỷ công bố'}
    </Button>
  );
}
