import type { ReactNode } from 'react';
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
  if (otApproved !== 0) return { text: hoursMinutes(otApproved), pending: false };
  return null;
}

type Column = { key: string; title: string; num?: boolean; cell: (day: PayDayDetail) => ReactNode };

const COLUMNS = {
  date: {
    key: 'date',
    title: 'Ngày',
    cell: (day) => {
      const [weekday, date] = formatDayLabel(day.date).split(' ');
      return (
        <>
          <strong>{date}</strong> <span className={styles.muted}>{weekday}</span>
        </>
      );
    },
  },
  position: {
    key: 'position',
    title: 'Vị trí',
    cell: (day) => day.positionName ?? <span className={styles.muted}>—</span>,
  },
  shift: {
    key: 'shift',
    title: 'Ca',
    cell: (day) =>
      day.shiftCode ? (
        <span className={styles.shiftTag} title={day.shiftName ?? undefined}>
          {day.shiftCode}
        </span>
      ) : (
        <span className={styles.muted}>—</span>
      ),
  },
  in: { key: 'in', title: 'Vào', cell: (day) => (day.inAt ? formatClock(day.inAt) : '—') },
  out: { key: 'out', title: 'Ra', cell: (day) => (day.outAt ? formatClock(day.outAt) : '—') },
  worked: {
    key: 'worked',
    title: 'Trong ca',
    num: true,
    cell: (day) => (day.workedMin > 0 ? hoursMinutes(day.workedMin) : '—'),
  },
  cong: { key: 'cong', title: 'Công', num: true, cell: (day) => <strong>{formatDecimal(day.cong)}</strong> },
  late: {
    key: 'late',
    title: 'Muộn / sớm',
    cell: (day) => {
      const late = lateEarly(day);
      return late ? <span className={styles.lateText}>{late}</span> : <span className={styles.muted}>—</span>;
    },
  },
  after: {
    key: 'after',
    title: 'Sau ca',
    num: true,
    cell: (day) => {
      const after = afterShift(day);
      return after ? <span className={after.pending ? styles.ot : ''}>{after.text}</span> : null;
    },
  },
  factor: {
    key: 'factor',
    title: 'Hệ số',
    num: true,
    cell: (day) =>
      day.amount === null ? null : (
        <span className={day.payFactor === 1 ? styles.muted : styles.ot}>
          ×{formatDecimal(day.payFactor)}
        </span>
      ),
  },
  amount: {
    key: 'amount',
    title: 'Tiền ca',
    num: true,
    cell: (day) => (day.amount === null || day.amount === 0 ? null : formatNumber(day.amount)),
  },
  ot: {
    key: 'ot',
    title: 'OT',
    num: true,
    cell: (day) => (day.otApproved === 0 ? null : hoursMinutes(day.otApproved)),
  },
  note: {
    key: 'note',
    title: 'Ghi chú',
    cell: (day) => (day.note ? <span className={styles.noteCell}>{day.note}</span> : null),
  },
  mark: {
    key: 'mark',
    title: 'Ghi nhận',
    cell: (day) => (
      <span className={styles.mark}>
        <span className={`${styles.markBox} ${styles[`m_${day.symbol}`] ?? ''}`} aria-hidden>
          {day.symbolLabel}
        </span>
        {day.symbolTitle}
      </span>
    ),
  },
} satisfies Record<string, Column>;

type DayTableProps = {
  days: readonly PayDayDetail[];
  /** `slip`: bảng ngày công trên phiếu nhân viên, thứ tự cột riêng, không có Công, Sau ca, Ghi nhận. */
  variant?: 'statement' | 'slip';
  /** Người giữ nhiều vị trí thì phiếu có cột Vị trí. */
  showPosition?: boolean;
};

/** Bảng Từng ngày: sao kê ở màn Lương và chi tiết ngày công trên phiếu nhân viên. */
export function DayTable({ days, variant = 'statement', showPosition = false }: DayTableProps) {
  // Hệ số và tiền từng ca chỉ có nghĩa với ca trả theo giờ
  const perShift = days.some(({ amount }) => amount !== null);
  const C = COLUMNS;
  const columns: Column[] =
    variant === 'slip'
      ? [
          C.date,
          ...(showPosition ? [C.position] : []),
          C.shift,
          ...(perShift ? [C.amount] : []),
          C.in,
          C.out,
          C.worked,
          C.late,
          ...(perShift ? [C.factor] : []),
          C.ot,
          C.note,
        ]
      : [
          C.date,
          C.shift,
          C.in,
          C.out,
          C.worked,
          C.cong,
          C.late,
          C.after,
          ...(perShift ? [C.factor, C.amount] : []),
          C.mark,
        ];

  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.days} ${variant === 'slip' ? styles.daysCompact : ''}`}>
        <thead>
          <tr>
            {columns.map(({ key, title, num }) => (
              <th key={key} scope="col" className={num ? styles.num : undefined}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={`${day.date}|${day.shiftId ?? ''}`}>
              {columns.map(({ key, num, cell }) => (
                <td key={key} className={num ? styles.num : undefined}>
                  {cell(day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
