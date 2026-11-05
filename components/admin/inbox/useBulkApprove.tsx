'use client';

import { useState } from 'react';
import { App, Radio } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import type { AbsenceChoice } from '@/lib/domain/approval';
import { formatNumber } from '@/lib/format';
import type { ApprovableItem } from '@/lib/services/inbox';

type Result = { result: { approved: number; skipped: number } };

/** Hỏi lại rồi duyệt theo đề xuất; dùng chung cho Hộp việc và Bảng công. */
export function useBulkApprove({ from, to }: { from: string; to: string }, onDone: () => void) {
  const { modal } = App.useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async (items: readonly ApprovableItem[], absence?: AbsenceChoice) => {
    setBusy(true);
    const result = await apiRequest<Result>('/api/v1/approvals/bulk', 'POST', {
      from,
      to,
      items: items.map(({ key, label }) => ({ key, label })),
      absence,
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
    const absent = items.filter((item) => item.absent).length;
    const note =
      otMinutes > 0
        ? `Trong đó có ${formatNumber(otMinutes)} phút OT sẽ được tính tiền. Duyệt nhầm thì hoàn duyệt ở từng ngày.`
        : 'Duyệt nhầm thì hoàn duyệt ở từng ngày.';
    // Vắng không có đề xuất: một lựa chọn áp cho mọi ca Vắng đã chọn
    let absence: AbsenceChoice = 'confirm';
    modal.confirm({
      title: absent > 0 ? `Duyệt ${items.length} việc?` : `Duyệt ${items.length} việc theo đề xuất?`,
      content:
        absent > 0 ? (
          <>
            <p>Có {absent} ca Vắng (có ca nhưng không chấm lần nào). Xử lý các ca này:</p>
            <Radio.Group
              aria-label="Cách duyệt ca Vắng"
              defaultValue={absence}
              onChange={(event) => (absence = event.target.value)}
              options={[
                { value: 'confirm', label: 'Xác nhận vắng, 0 công' },
                { value: 'full', label: 'Cho đủ công' },
              ]}
            />
            <p>Việc khác duyệt theo đề xuất. {note}</p>
          </>
        ) : (
          note
        ),
      okText: 'Duyệt',
      cancelText: 'Quay lại',
      onOk: () => submit(items, absent > 0 ? absence : undefined),
    });
  };

  return { busy, confirm };
}
