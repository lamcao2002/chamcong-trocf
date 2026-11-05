'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Drawer, Skeleton } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { DayTable } from '@/components/admin/payroll/DayTable';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';
import type { PayDayDetail, PayslipRow, PayslipView } from '@/lib/services/payroll';
import { themeCssVars } from '@/lib/theme/tokens';
import styles from './EmployeeScreen.module.css';

const PAY_LABELS: Record<PayslipView['summary']['payType'], string> = {
  month: 'Lương tháng',
  hour: 'Lương giờ',
  unit: 'Lương công',
};

/** Ngày công trong bản chụp; phiếu công bố trước khi có chi tiết thì ẩn. */
function SlipDays({ days, multiPosition }: { days: readonly PayDayDetail[]; multiPosition: boolean }) {
  const [open, setOpen] = useState(false);
  const count = new Set(days.map(({ date }) => date)).size;
  return (
    <section className={styles.slipDays}>
      <button
        type="button"
        className={styles.slipDaysToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <DownOutlined className={open ? styles.slipDaysOpen : undefined} />
        {open ? 'Ẩn' : 'Xem'} chi tiết {count} ngày công
      </button>
      {open ? <DayTable days={days} variant="slip" showPosition={multiPosition} /> : null}
    </section>
  );
}

function SlipDetail({ slip }: { slip: PayslipView }) {
  const { summary } = slip;
  const hasDays = (summary.days?.length ?? 0) > 0;
  const shownLines = hasDays ? slip.lines.filter(({ key }) => key.startsWith('adjustment_')) : slip.lines;
  return (
    <>
      <div className={styles.slipNet}>
        <span>Thực lĩnh</span>
        <strong>{formatMoney(slip.net)}</strong>
        <span>
          Kỳ {formatDate(slip.from).slice(0, 5)} – {formatDate(slip.to)} · {PAY_LABELS[summary.payType]}
        </span>
        <span>Công bố {formatDate(vietnamToday(new Date(slip.publishedAt)))}</span>
      </div>
      <div className={styles.slipStats}>
        <div>
          <span>Công</span>
          <strong>{formatDecimal(summary.cong)}</strong>
        </div>
        <div>
          <span>Muộn</span>
          <strong>{summary.lateMin}p</strong>
        </div>
        <div>
          <span>Thiếu chấm</span>
          <strong>{summary.missing}</strong>
        </div>
        <div>
          <span>OT</span>
          <strong>{summary.otApprovedMin}p</strong>
        </div>
      </div>
      {/* Bảng ngày công đã có tiền từng ca nên chỉ giữ thưởng/phạt; phiếu cũ chưa có bảng thì hiện đủ dòng */}
      {shownLines.length > 0 ? (
        <ul className={styles.slipLines}>
          {shownLines.map(({ key, name, amount, how }) => (
            <li key={key}>
              <span>
                {name}
                <span className={styles.timelineSub}>{how}</span>
              </span>
              <strong>{formatMoney(amount)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {hasDays ? <SlipDays days={summary.days!} multiPosition={summary.multiPosition ?? false} /> : null}
      <p className={styles.muted}>
        Phiếu này là bản đã công bố, không đổi khi bảng công được sửa sau ngày công bố.
      </p>
    </>
  );
}

/** Màn M4: các kỳ đã công bố và phiếu từng kỳ, chỉ đọc từ bản chụp (US36). */
export function PayslipTab({ brandColor }: { brandColor: string | null }) {
  const toast = useToast();
  const [rows, setRows] = useState<PayslipRow[] | null>(null);
  const [slip, setSlip] = useState<PayslipView | null>(null);

  useEffect(() => {
    void apiRequest<{ payslips: PayslipRow[] }>('/api/v1/app/payslips', 'GET').then((result) => {
      if (result.ok) setRows(result.payslips);
      else toast.error(result.error);
    });
  }, [toast]);

  const open = async (periodKey: string) => {
    const result = await apiRequest<{ payslip: PayslipView }>(`/api/v1/app/payslips/${periodKey}`, 'GET');
    if (result.ok) setSlip(result.payslip);
    else toast.error(result.error);
  };

  return (
    <main className={styles.body}>
      <div className={styles.card}>
        <h1 className={styles.title}>Phiếu lương</h1>
        {!rows ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : null}
        {rows?.length === 0 ? <p className={styles.muted}>Chưa có phiếu lương nào được công bố.</p> : null}
        {rows && rows.length > 0 ? (
          <ul className={styles.slipList}>
            {rows.map(({ periodKey, from, to, net, publishedAt }) => (
              <li key={periodKey}>
                <button type="button" onClick={() => void open(periodKey)}>
                  <span>
                    <strong>
                      {formatDate(from).slice(0, 5)} – {formatDate(to)}
                    </strong>
                    <span className={styles.timelineSub}>
                      Công bố {formatDate(vietnamToday(new Date(publishedAt)))}
                    </span>
                  </span>
                  <span className={styles.slipAmount}>
                    {formatMoney(net)} <RightOutlined />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Drawer
        open={slip !== null}
        title="Phiếu lương"
        placement="bottom"
        height="90%"
        destroyOnHidden
        onClose={() => setSlip(null)}
      >
        {/* Drawer nằm ngoài vùng đặt biến CSS của màn */}
        <div style={themeCssVars(brandColor ?? undefined) as CSSProperties}>
          {slip ? <SlipDetail slip={slip} /> : null}
        </div>
      </Drawer>
    </main>
  );
}
