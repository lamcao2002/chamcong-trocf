'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { formatMoney } from '@/lib/format';
import type { PayrollView } from '@/lib/services/payroll';
import styles from './payroll.module.css';

/** Nút Công bố và hộp xác nhận: nêu số phiếu, tổng tiền, việc tồn, OT chờ trước khi đóng băng (US36). */
export function PublishDialog({ payroll }: { payroll: PayrollView }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startRefresh] = useTransition();
  const { period, status, review, otPending, fund, headcount, employees } = payroll;

  const today = vietnamToday();
  const running = period.to >= today;
  const negative = employees.filter(({ net }) => net < 0).length;
  const again = status.published;

  // Đã công bố và số không đổi thì không có gì để công bố lại
  if (period.from > today || (again && !status.stale)) return null;

  const publish = async () => {
    setSaving(true);
    const result = await apiRequest(`/api/v1/payroll/publish?period=${period.key}`, 'POST');
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(again ? 'Đã công bố lại phiếu lương' : 'Đã công bố phiếu lương');
    startRefresh(() => router.refresh());
  };

  return (
    <>
      <Button type="primary" className={styles.publish} onClick={() => setOpen(true)}>
        {again ? 'Công bố lại' : 'Công bố phiếu lương'}
      </Button>
      <Modal
        open={open}
        title={again ? 'Công bố lại phiếu lương' : 'Công bố phiếu lương'}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        footer={[
          review.items > 0 ? (
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
            <strong>{formatMoney(fund)}</strong>.
          </li>
          {review.items > 0 ? (
            <li className={styles.noticeWarn}>
              Còn <strong>{review.items} ngày công</strong> của {review.people} người chưa xử lý.
            </li>
          ) : null}
          {otPending.minutes > 0 ? (
            <li className={styles.noticeOt}>
              Còn <strong>{otPending.minutes} phút OT chờ duyệt</strong> chưa được tính. Nếu duyệt hết, quỹ
              lương tăng thêm khoảng <strong>{formatMoney(otPending.amount)}</strong>.
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
