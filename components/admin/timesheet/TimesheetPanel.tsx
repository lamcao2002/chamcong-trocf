'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Select } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { SYMBOL_LEGEND } from '@/lib/domain/symbols';
import { formatDate, formatDayLabel, formatDecimal } from '@/lib/format';
import type { TimesheetView } from '@/lib/services/timesheet';
import { DayDrawer, type DayTarget } from './DayDrawer';
import { EmployeeDrawer, type EmployeeTarget } from './EmployeeDrawer';
import styles from './timesheet.module.css';

const cellClass = (symbol: string) => `${styles.cell} ${styles[`s_${symbol}`] ?? ''}`;

/** Màn A3: hàng là nhân viên, cột là ngày, ô theo 12 ký hiệu, cột tổng Công/Muộn/Thiếu/OT (US27). */
export function TimesheetPanel({ timesheet }: { timesheet: TimesheetView }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<string | null>(null);
  const [dayTarget, setDayTarget] = useState<DayTarget | null>(null);
  const [employeeTarget, setEmployeeTarget] = useState<EmployeeTarget | null>(null);

  const positions = useMemo(
    () => [...new Set(timesheet.employees.flatMap(({ positionName }) => positionName ?? []))],
    [timesheet.employees],
  );
  const term = search.trim().toLowerCase();
  const rows = timesheet.employees.filter(
    ({ name, positionName }) =>
      name.toLowerCase().includes(term) && (position === null || positionName === position),
  );
  const refresh = () => startRefresh(() => router.refresh());
  const scroller = useRef<HTMLDivElement>(null);

  // Màn hẹp mở ở ngày gần nhất có dữ liệu, không phải đầu kỳ còn trống
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [timesheet.period.key]);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <nav className={styles.periodNav} aria-label="Chọn kỳ">
          <Link
            className={styles.periodLink}
            href={`/app/bang-cong?period=${timesheet.previousKey}`}
            aria-label="Kỳ trước"
          >
            <LeftOutlined />
          </Link>
          <span className={styles.periodLabel}>
            {formatDate(timesheet.period.from)} – {formatDate(timesheet.period.to)}
          </span>
          {timesheet.nextKey ? (
            <Link
              className={styles.periodLink}
              href={`/app/bang-cong?period=${timesheet.nextKey}`}
              aria-label="Kỳ sau"
            >
              <RightOutlined />
            </Link>
          ) : null}
        </nav>
        <Input
          allowClear
          className={styles.search}
          placeholder="Tìm tên"
          aria-label="Tìm tên"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          allowClear
          className={styles.position}
          placeholder="Vị trí"
          aria-label="Lọc vị trí"
          value={position}
          options={positions.map((value) => ({ value, label: value }))}
          onChange={(value) => setPosition(value ?? null)}
        />
      </div>

      <div ref={scroller} className={styles.scroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th scope="col" className={styles.nameHead}>
                Nhân viên
              </th>
              {timesheet.dates.map((date) => (
                <th
                  key={date}
                  scope="col"
                  className={`${styles.dayHead} ${date === timesheet.today ? styles.today : ''}`}
                >
                  {formatDayLabel(date).split(' ')[0]}
                  <br />
                  {date.slice(8)}
                </th>
              ))}
              <th scope="col" className={styles.total}>
                Công
              </th>
              <th scope="col" className={styles.total}>
                Muộn
              </th>
              <th scope="col" className={styles.total}>
                Thiếu
              </th>
              <th scope="col" className={styles.total}>
                OT
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => (
              <tr key={employee.id}>
                <th scope="row" className={styles.name}>
                  <button
                    type="button"
                    className={styles.nameButton}
                    onClick={() =>
                      setEmployeeTarget({
                        id: employee.id,
                        name: employee.name,
                        period: timesheet.period.key,
                      })
                    }
                  >
                    {employee.name}
                    <span>{employee.positionName ?? 'Chưa có vị trí'}</span>
                  </button>
                </th>
                {timesheet.dates.map((date) => {
                  const cell = employee.cells.find((row) => row.date === date);
                  if (!cell) return <td key={date} className={styles.empty} />;
                  return (
                    <td key={date} className={styles.day}>
                      <button
                        type="button"
                        className={cellClass(cell.symbol)}
                        title={cell.title}
                        aria-label={`${employee.name}, ${formatDate(date)}: ${cell.title}`}
                        onClick={() => setDayTarget({ employeeId: employee.id, name: employee.name, date })}
                      >
                        {cell.label}
                        {cell.shiftCount > 1 ? <span className={styles.badge}>{cell.shiftCount}</span> : null}
                      </button>
                    </td>
                  );
                })}
                <td className={styles.total}>{formatDecimal(employee.totals.cong)}</td>
                <td className={styles.total}>{employee.totals.lateMin}p</td>
                <td className={styles.total}>{employee.totals.missing}</td>
                <td className={styles.total}>
                  {employee.totals.otApproved}p
                  {employee.totals.otPending > 0 ? ` +${employee.totals.otPending}?` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={styles.legend}>
        {SYMBOL_LEGEND.map(({ key, label, title }) => (
          <li key={key}>
            <span className={`${styles.legendMark} ${cellClass(key)}`} aria-hidden>
              {label}
            </span>
            {title}
          </li>
        ))}
      </ul>

      <DayDrawer target={dayTarget} onClose={() => setDayTarget(null)} onChanged={refresh} />
      <EmployeeDrawer target={employeeTarget} onClose={() => setEmployeeTarget(null)} />
    </div>
  );
}
