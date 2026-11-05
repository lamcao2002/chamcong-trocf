'use client';

import { formatClock, formatDate, formatDayLabel, formatDecimal } from '@/lib/format';
import type { TimesheetView } from '@/lib/services/timesheet';
import styles from './timesheet.module.css';

type Employee = TimesheetView['employees'][number];
type WeekRow = Employee['weekDays'][number]['rows'][number];

const TONE: Record<string, string | undefined> = {
  vang: styles.toneAlert,
  thieu: styles.toneAlert,
  vung: styles.toneAlert,
  muon: styles.toneWarn,
  ca: styles.toneWarn,
  ot_cho: styles.toneOt,
};

const time = (at: Date | null) => (at ? new Date(at).getTime() : null);

/** Khung sọc là giờ ca, thanh đặc là thời gian có mặt; ca đêm nằm trọn trong ô ngày bắt đầu ca. */
function MiniBar({ row }: { row: WeekRow }) {
  const start = time(row.shiftStartAt);
  const end = time(row.shiftEndAt);
  const inAt = time(row.inAt);
  const outAt = time(row.outAt);
  if (start === null || end === null) return null;

  const from = Math.min(start, inAt ?? start, outAt ?? start);
  const to = Math.max(end, inAt ?? end, outAt ?? end);
  const left = (value: number) => `${((value - from) / (to - from)) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / (to - from)) * 100}%`;

  return (
    <span className={styles.miniBar} aria-hidden>
      <span className={styles.miniShift} style={{ left: left(start), width: width(start, end) }} />
      {inAt !== null && outAt !== null ? (
        <span className={styles.miniPresent} style={{ left: left(inAt), width: width(inAt, outAt) }} />
      ) : null}
      {inAt !== null && outAt === null ? (
        <span className={styles.miniMark} style={{ left: left(inAt) }} />
      ) : null}
    </span>
  );
}

function rowLabel({ shiftName, text, inAt, outAt }: WeekRow): string {
  const clock = inAt ? ` (vào ${formatClock(inAt)}${outAt ? `, ra ${formatClock(outAt)}` : ''})` : '';
  return `${shiftName ?? 'Không có ca'}: ${text}${clock}`;
}

type TimesheetWeekProps = {
  dates: readonly string[];
  today: string;
  employees: readonly Employee[];
  /** Duyệt loạt: ô có việc viền đứt, bấm để chọn; khoá ô là `employeeId|date` như Lưới cả kỳ. */
  picking: boolean;
  pickedCells: readonly string[];
  onToggle: (id: string) => void;
  onOpenDay: (employee: Employee, date: string) => void;
  onOpenEmployee: (employee: Employee) => void;
};

/** Bảng công Theo tuần: mỗi ô là giờ vào–ra hoặc trạng thái, cột Tuần là tổng công và việc tồn (TS-05). */
export function TimesheetWeek({
  dates,
  today,
  employees,
  picking,
  pickedCells,
  onToggle,
  onOpenDay,
  onOpenEmployee,
}: TimesheetWeekProps) {
  return (
    <div className={styles.scroll}>
      <table className={`${styles.grid} ${styles.weekGrid}`}>
        <thead>
          <tr>
            <th scope="col" className={styles.nameHead}>
              Nhân viên
            </th>
            {dates.map((date) => (
              <th
                key={date}
                scope="col"
                className={`${styles.weekHead} ${date === today ? styles.today : ''}`}
              >
                {formatDayLabel(date).split(' ')[0]} {date.slice(8)}
              </th>
            ))}
            <th scope="col" className={styles.weekHead}>
              Tuần
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => {
            const rows = employee.weekDays.flatMap((day) => day.rows);
            const cong = rows.reduce((sum, { congValue }) => sum + congValue, 0);
            const review = rows.filter(({ needsReview }) => needsReview).length;
            return (
              <tr key={employee.id}>
                <th scope="row" className={styles.name}>
                  <button
                    type="button"
                    className={styles.nameButton}
                    onClick={() => onOpenEmployee(employee)}
                  >
                    {employee.name}
                    <span>{employee.positionName ?? 'Chưa có vị trí'}</span>
                  </button>
                </th>
                {dates.map((date) => {
                  const day = employee.weekDays.find((entry) => entry.date === date);
                  if (!day || day.rows.length === 0) {
                    return <td key={date} className={styles.weekEmpty} />;
                  }
                  const id = `${employee.id}|${date}`;
                  const canPick =
                    picking &&
                    employee.cells.some((cell) => cell.date === date && cell.approvable.length > 0);
                  const isPicked = canPick && pickedCells.includes(id);
                  const pickClass = canPick ? (isPicked ? styles.picked : styles.pickable) : '';
                  return (
                    <td key={date} className={styles.weekDay}>
                      <button
                        type="button"
                        className={`${styles.weekCell} ${pickClass}`}
                        aria-label={`${employee.name}, ${formatDate(date)}: ${day.rows.map(rowLabel).join('; ')}`}
                        aria-pressed={picking ? isPicked : undefined}
                        disabled={picking && !canPick}
                        onClick={() => (picking ? onToggle(id) : onOpenDay(employee, date))}
                      >
                        {day.rows.map((row) => (
                          <span key={row.shiftId ?? 'none'} className={styles.weekRow}>
                            {row.shiftCode ? (
                              <span className={styles.weekShift} title={row.shiftName ?? undefined}>
                                <span className={styles.weekShiftCode}>{row.shiftCode}</span>
                                {row.shiftHours}
                              </span>
                            ) : null}
                            <MiniBar row={row} />
                            <span className={TONE[row.symbol] ?? ''}>{row.text}</span>
                          </span>
                        ))}
                      </button>
                    </td>
                  );
                })}
                <td className={styles.weekTotal}>
                  <strong>{formatDecimal(cong)} công</strong>
                  <span className={review > 0 ? styles.toneWarn : styles.weekOk}>
                    {review > 0 ? `${review} cần duyệt` : 'ổn'}
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
