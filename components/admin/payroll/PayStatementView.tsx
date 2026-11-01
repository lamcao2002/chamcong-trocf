'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { App, Button, Skeleton } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';
import type { PayStatement } from '@/lib/services/payroll';
import { AdjustmentModal } from './AdjustmentModal';
import styles from './payroll.module.css';

const PAY_LABELS: Record<PayStatement['payType'], string> = {
  month: 'Lương tháng',
  hour: 'Lương giờ',
  unit: 'Lương công',
};

type PayStatementViewProps = { employeeId: string; periodKey: string };

/** Sao kê một người: "Vì sao ra số này", OT chờ và thực lĩnh dự phóng, thưởng/phạt (US34, US35). */
export function PayStatementView({ employeeId, periodKey }: PayStatementViewProps) {
  const router = useRouter();
  const toast = useToast();
  const { modal } = App.useApp();
  const [statement, setStatement] = useState<PayStatement | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startRefresh] = useTransition();

  const load = useCallback(async () => {
    const url = `/api/v1/payroll/${employeeId}?period=${periodKey}`;
    const result = await apiRequest<{ statement: PayStatement }>(url, 'GET');
    if (result.ok) setStatement(result.statement);
    else toast.error(result.error);
  }, [employeeId, periodKey, toast]);

  useEffect(() => {
    setStatement(null);
    void load();
  }, [load]);

  const changed = () => {
    void load();
    startRefresh(() => router.refresh());
  };

  const remove = (id: string) => {
    modal.confirm({
      title: 'Xoá khoản này?',
      content: 'Thực lĩnh sẽ tính lại ngay.',
      okText: 'Xoá',
      okButtonProps: { danger: true },
      cancelText: 'Giữ lại',
      onOk: async () => {
        const result = await apiRequest(`/api/v1/adjustments/${id}`, 'DELETE');
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Đã xoá khoản này');
        changed();
      },
    });
  };

  if (!statement) return <Skeleton active />;
  const { employee, pendingOt, adjustments } = statement;

  return (
    <div className={styles.statement}>
      <div className={styles.statementHead}>
        <div>
          <h2 className={styles.statementName}>{employee.name}</h2>
          <p className={styles.mutedLine}>
            {employee.positionName ?? 'Chưa có vị trí'} · {PAY_LABELS[statement.payType]}{' '}
            {formatMoney(statement.payAmount)}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Thưởng / phạt</Button>
      </div>

      <div className={styles.kpis}>
        <div>
          <span className={styles.muted}>Công</span>
          <strong>{formatDecimal(statement.summary.cong)}</strong>
        </div>
        <div>
          <span className={styles.muted}>OT đã duyệt</span>
          <strong>{statement.summary.otApprovedMin}p</strong>
        </div>
        <div>
          <span className={styles.muted}>OT chờ duyệt</span>
          <strong>{pendingOt.minutes}p</strong>
        </div>
        <div className={styles.kpiNet}>
          <span className={styles.muted}>Thực lĩnh</span>
          <strong className={statement.net < 0 ? styles.alert : ''}>{formatMoney(statement.net)}</strong>
        </div>
      </div>

      <div>
        <h3 className={styles.sectionTitle}>Vì sao ra số này</h3>
        <ul className={styles.lines}>
          {statement.lines.map(({ key, name, amount, how }) => {
            const manual = key.startsWith('adjustment_') ? adjustments[Number(key.split('_')[1])] : undefined;
            return (
              <li key={key}>
                <span className={styles.lineBody}>
                  <span>{name}</span>
                  <span className={styles.muted}>{how}</span>
                </span>
                <span className={styles.lineEnd}>
                  <strong>{formatMoney(amount)}</strong>
                  {manual ? (
                    <Button
                      type="link"
                      danger
                      size="small"
                      aria-label={`Xoá ${name.toLowerCase()} ${how}`}
                      onClick={() => remove(manual.id)}
                    >
                      Xoá
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
          <li className={styles.lineTotal}>
            <span>Thực lĩnh</span>
            <strong>{formatMoney(statement.net)}</strong>
          </li>
        </ul>
      </div>

      {statement.net < 0 ? (
        <p className={styles.warning}>Thực lĩnh âm: khoản phạt lớn hơn lương của kỳ này.</p>
      ) : null}

      {pendingOt.minutes > 0 ? (
        <div className={styles.pending}>
          <strong>Chưa tính: {pendingOt.minutes} phút OT chờ duyệt</strong>
          <p>
            {pendingOt.days
              .map(({ date, minutes }) => `${formatDate(date).slice(0, 5)} (${minutes}p)`)
              .join(', ')}
            . Nếu duyệt hết, thực lĩnh thành {formatMoney(statement.projectedNet)} (+
            {formatMoney(pendingOt.amount)}).
          </p>
          <Link className={styles.link} href="/app">
            Duyệt trong Hộp việc
          </Link>
        </div>
      ) : null}

      <AdjustmentModal
        open={adding}
        employeeId={employeeId}
        employeeName={employee.name}
        periodKey={periodKey}
        onClose={() => setAdding(false)}
        onSaved={changed}
      />
    </div>
  );
}
