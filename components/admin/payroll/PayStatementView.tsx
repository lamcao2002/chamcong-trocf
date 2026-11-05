'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { App, Button, Skeleton, Switch } from 'antd';
import { PlusOutlined, PrinterOutlined, SendOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDate, formatDecimal, formatMoney, formatNumber } from '@/lib/format';
import { initials } from '@/lib/navigation/admin';
import type { PayStatement, SlipState } from '@/lib/services/payroll';
import { AdjustmentModal } from './AdjustmentModal';
import { DayTable } from './DayTable';
import { hoursMinutes, payRate, periodTitle } from './payroll-text';
import styles from './payroll.module.css';

const BASIS: Record<PayStatement['payType'], string> = {
  month: 'Lương theo tháng',
  hour: 'Lương theo giờ',
  unit: 'Lương theo công',
};

type PayStatementViewProps = {
  employeeId: string;
  periodKey: string;
  /** Trạng thái phiếu của người này trong kỳ, cho nút Công bố riêng. */
  slip: SlipState;
};

/** Sao kê một người: "Vì sao ra số này", thưởng/phạt, từng ngày, OT chờ và thực lĩnh dự phóng (US34, US35). */
export function PayStatementView({ employeeId, periodKey, slip }: PayStatementViewProps) {
  const router = useRouter();
  const toast = useToast();
  const { modal } = App.useApp();
  const [statement, setStatement] = useState<PayStatement | null>(null);
  const [adding, setAdding] = useState(false);
  const [allDays, setAllDays] = useState(true);
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

  const publishOne = () => {
    const again = slip !== 'none';
    modal.confirm({
      title: again ? 'Công bố lại phiếu của người này?' : 'Công bố phiếu của người này?',
      content:
        'Phiếu được đóng băng theo số lúc này, người này nhận thông báo. Phiếu của người khác giữ nguyên.',
      okText: again ? 'Công bố lại' : 'Công bố',
      cancelText: 'Để sau',
      onOk: async () => {
        const result = await apiRequest(`/api/v1/payroll/publish?period=${periodKey}`, 'POST', {
          employeeIds: [employeeId],
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(again ? 'Đã công bố lại phiếu' : 'Đã công bố phiếu');
        changed();
      },
    });
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
  const { employee, pendingOt, adjustments, summary, period } = statement;
  const days = allDays ? statement.days : statement.days.filter(({ notable }) => notable);
  const otApprovedAmount = statement.lines
    .filter(({ key }) => key.startsWith('ot_'))
    .reduce((sum, { amount }) => sum + amount, 0);

  return (
    <div className={styles.statement}>
      <div className={styles.statementTop}>
        <span className={styles.muted}>
          Sao kê {periodTitle(period.key).toLowerCase()} · {formatDate(period.from).slice(0, 5)} –{' '}
          {formatDate(period.to)}
        </span>
        <div className={styles.statementActions}>
          <Button
            type={slip === 'published' ? 'default' : 'primary'}
            icon={<SendOutlined />}
            onClick={publishOne}
          >
            {slip === 'none' ? 'Công bố phiếu' : 'Công bố lại'}
          </Button>
          <Button
            icon={<PrinterOutlined />}
            href={`/app/in-phieu?period=${periodKey}&nv=${employeeId}`}
            target="_blank"
            rel="noopener"
          >
            In phiếu
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Thưởng / phạt
          </Button>
        </div>
      </div>

      <div className={styles.person}>
        <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden>
          {initials(employee.name)}
        </span>
        <div>
          <h2 className={styles.statementName}>{employee.name}</h2>
          <p className={styles.mutedLine}>
            {employee.positionName ?? 'Chưa có vị trí'} ·{' '}
            {statement.fixedShiftName
              ? `Ca cố định (${statement.fixedShiftName})`
              : 'Ca linh hoạt (theo lịch)'}{' '}
            · {payRate(statement.payType, statement.payAmount)}
          </p>
        </div>
      </div>

      <div className={styles.kpis}>
        <div>
          <span className={styles.muted}>Công</span>
          <strong>{formatDecimal(summary.cong)}</strong>
          <span className={styles.muted}>{statement.shiftCount} ca</span>
        </div>
        <div>
          <span className={styles.muted}>OT đã duyệt</span>
          <strong>{summary.otApprovedMin !== 0 ? hoursMinutes(summary.otApprovedMin) : 0}</strong>
          <span className={styles.muted}>
            {summary.otApprovedMin !== 0 ? formatMoney(otApprovedAmount) : 'Chưa có'}
          </span>
        </div>
        <div>
          <span className={styles.muted}>OT chờ duyệt</span>
          <strong className={pendingOt.minutes > 0 ? styles.ot : ''}>
            {pendingOt.minutes > 0 ? hoursMinutes(pendingOt.minutes) : 0}
          </strong>
          <span className={styles.muted}>
            {pendingOt.minutes > 0 ? `+${formatMoney(pendingOt.amount)} nếu duyệt` : 'Không có'}
          </span>
        </div>
        <div className={styles.kpiNet}>
          <span className={styles.muted}>Thực lĩnh</span>
          <strong className={statement.net < 0 ? styles.alert : styles.net}>
            {formatMoney(statement.net)}
          </strong>
          <span className={styles.muted}>{BASIS[statement.payType]}</span>
        </div>
      </div>

      <div className={styles.columns}>
        <section className={styles.card} aria-label="Vì sao ra số này">
          <h3 className={styles.sectionTitle}>Vì sao ra số này</h3>
          <ul className={styles.lines}>
            {statement.lines.map(({ key, name, amount, how }) => (
              <li key={key}>
                <span className={styles.lineBody}>
                  <span>{name}</span>
                  <span className={styles.muted}>{how}</span>
                </span>
                <strong className={styles.lineEnd}>{formatNumber(amount)}</strong>
              </li>
            ))}
            <li className={styles.lineTotal}>
              <span>Thực lĩnh</span>
              <strong className={statement.net < 0 ? styles.alert : styles.net}>
                {formatMoney(statement.net)}
              </strong>
            </li>
          </ul>
          {statement.net < 0 ? (
            <p className={styles.warning}>Thực lĩnh âm: khoản phạt lớn hơn lương của kỳ này.</p>
          ) : null}
          {pendingOt.minutes > 0 ? (
            <div className={styles.pending}>
              <strong>Chưa tính: {hoursMinutes(pendingOt.minutes)} OT chờ duyệt</strong>
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
        </section>

        <section className={styles.card} aria-label="Thưởng / phạt nhập tay">
          <div className={styles.cardHead}>
            <h3 className={styles.sectionTitle}>Thưởng / phạt nhập tay</h3>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
              Thêm
            </Button>
          </div>
          {adjustments.length === 0 ? (
            <p className={styles.mutedLine}>
              Chưa có khoản nào trong kỳ. Dùng cho hoa hồng, thưởng nóng, phạt vi phạm...
            </p>
          ) : (
            <ul className={styles.lines}>
              {adjustments.map(({ id, kind, amount, note }) => (
                <li key={id}>
                  <span className={styles.lineBody}>
                    <span>{kind === 'bonus' ? 'Thưởng' : 'Phạt'}</span>
                    <span className={styles.muted}>{note}</span>
                  </span>
                  <span className={styles.lineEnd}>
                    <strong className={kind === 'bonus' ? '' : styles.alert}>
                      {kind === 'bonus' ? '+' : '−'}
                      {formatMoney(amount)}
                    </strong>
                    <Button
                      type="link"
                      danger
                      size="small"
                      aria-label={`Xoá ${kind === 'bonus' ? 'thưởng' : 'phạt'} ${note}`}
                      onClick={() => remove(id)}
                    >
                      Xoá
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Từng ngày">
        <div className={styles.cardHead}>
          <h3 className={styles.sectionTitle}>Từng ngày</h3>
          <label className={styles.switchLabel}>
            <Switch size="small" checked={allDays} onChange={setAllDays} />
            Hiện đủ từng ngày
          </label>
        </div>
        {days.length === 0 ? (
          <p className={styles.mutedLine}>
            {statement.days.length === 0 ? 'Chưa có ngày công nào trong kỳ.' : 'Không có ngày nào cần chú ý.'}
          </p>
        ) : (
          <DayTable days={days} />
        )}
      </section>

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
