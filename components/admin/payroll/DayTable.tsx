import { formatClock, formatDayLabel, formatDecimal, formatNumber } from '@/lib/format';
import type { PayDayDetail } from '@/lib/services/payroll';
import { hoursMinutes } from './payroll-text';
import styles from './payroll.module.css';

function lateEarly({ lateMin, earlyMin }: PayDayDetail): string | null {
  const parts = [lateMin > 0 ? `muộn ${lateMin}p` : null, earlyMin > 0 ? `sớm ${earlyMin}p` : null];
  const text = parts.filter(Boolean).join(', ');
  return text || null;
}

function afterShift({ otApproved, otPending }: PayDayDetail): { text: string; pending: boolean } | null {
  if (otPending > 0) return { text: `${hoursMinutes(otPending)} chờ`, pending: true };
  if (otApproved > 0) return { text: hoursMinutes(otApproved), pending: false };
  return null;
}

type DayTableProps = {
  days: readonly PayDayDetail[];
  /** Phiếu nhân viên bỏ cột Công và Sau ca. */
  compact?: boolean;
};

/** Bảng Từng ngày: sao kê ở màn Lương và chi tiết ngày công trên phiếu nhân viên. */
export function DayTable({ days, compact = false }: DayTableProps) {
  // Hệ số và tiền từng ca chỉ có nghĩa với ca trả theo giờ
  const perShift = days.some(({ amount }) => amount !== null);

  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.days} ${compact ? styles.daysCompact : ''}`}>
        <thead>
          <tr>
            <th scope="col">Ngày</th>
            <th scope="col">Ca</th>
            <th scope="col">Vào</th>
            <th scope="col">Ra</th>
            <th scope="col" className={styles.num}>
              Trong ca
            </th>
            {compact ? null : (
              <th scope="col" className={styles.num}>
                Công
              </th>
            )}
            <th scope="col">Muộn / sớm</th>
            {compact ? null : (
              <th scope="col" className={styles.num}>
                Sau ca
              </th>
            )}
            {perShift ? (
              <>
                <th scope="col" className={styles.num}>
                  Hệ số
                </th>
                <th scope="col" className={styles.num}>
                  Tiền ca
                </th>
              </>
            ) : null}
            <th scope="col">Ghi nhận</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const [weekday, date] = formatDayLabel(day.date).split(' ');
            const late = lateEarly(day);
            const after = afterShift(day);
            return (
              <tr key={`${day.date}|${day.shiftId ?? ''}`}>
                <td>
                  <strong>{date}</strong> <span className={styles.muted}>{weekday}</span>
                </td>
                <td>
                  {day.shiftCode ? (
                    <span className={styles.shiftTag} title={day.shiftName ?? undefined}>
                      {day.shiftCode}
                    </span>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td>{day.inAt ? formatClock(day.inAt) : '—'}</td>
                <td>{day.outAt ? formatClock(day.outAt) : '—'}</td>
                <td className={styles.num}>{day.workedMin > 0 ? hoursMinutes(day.workedMin) : '—'}</td>
                {compact ? null : (
                  <td className={styles.num}>
                    <strong>{formatDecimal(day.cong)}</strong>
                  </td>
                )}
                <td className={late ? styles.lateText : styles.muted}>{late ?? '—'}</td>
                {compact ? null : (
                  <td className={`${styles.num} ${after?.pending ? styles.ot : ''}`}>{after?.text ?? ''}</td>
                )}
                {perShift ? (
                  <>
                    <td className={`${styles.num} ${day.payFactor === 1 ? styles.muted : styles.ot}`}>
                      {day.amount === null ? '' : `×${formatDecimal(day.payFactor)}`}
                    </td>
                    <td className={styles.num}>
                      {day.amount === null || day.amount === 0 ? '' : formatNumber(day.amount)}
                    </td>
                  </>
                ) : null}
                <td>
                  <span className={styles.mark}>
                    <span className={`${styles.markBox} ${styles[`m_${day.symbol}`] ?? ''}`} aria-hidden>
                      {day.symbolLabel}
                    </span>
                    {day.symbolTitle}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
