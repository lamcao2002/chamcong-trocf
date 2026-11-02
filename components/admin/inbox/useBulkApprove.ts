'use client';

import { useState } from 'react';
import { App } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatNumber } from '@/lib/format';
import type { ApprovableItem } from '@/lib/services/inbox';

type Result = { result: { approved: number; skipped: number } };

/** Hỏi lại rồi duyệt theo đề xuất; dùng chung cho Hộp việc và Bảng công. */
export function useBulkApprove(periodKey: string, onDone: () => void) {
  const { modal } = App.useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async (items: readonly ApprovableItem[]) => {
    setBusy(true);
    const result = await apiRequest<Result>('/api/v1/approvals/bulk', 'POST', {
      period: periodKey,
      items: items.map(({ key, label }) => ({ key, label })),
    });
    setBusy(false);
    onDone();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { approved, skipped } = result.result;
    if (skipped === 0) toast.success(`Đã duyệt ${approved} việc`);
    else toast.error(`Đã duyệt ${approved} việc, bỏ qua ${skipped} việc vì số liệu vừa đổi. Hãy xem lại.`);
  };

  const confirm = (items: readonly ApprovableItem[]) => {
    const otMinutes = items.reduce((sum, item) => sum + item.otMinutes, 0);
    modal.confirm({
      title: `Duyệt ${items.length} việc theo đề xuất?`,
      content:
        otMinutes > 0
          ? `Trong đó có ${formatNumber(otMinutes)} phút OT sẽ được tính tiền. Duyệt nhầm thì hoàn duyệt ở từng ngày.`
          : 'Duyệt nhầm thì hoàn duyệt ở từng ngày.',
      okText: 'Duyệt',
      cancelText: 'Quay lại',
      onOk: () => submit(items),
    });
  };

  return { busy, confirm };
}
