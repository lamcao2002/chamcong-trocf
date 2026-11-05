'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, DatePicker, Input, Segmented, Select } from 'antd';
import { CheckOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useBulkApprove } from '@/components/admin/inbox/useBulkApprove';
import { ExportButton } from '@/components/common/ExportButton';
import { SYMBOL_LEGEND } from '@/lib/domain/symbols';
import {
  MAX_RANGE_DAYS,
  rangeDays,
  timesheetSearch,
  type RangeMode,
  type TimesheetQuery,
} from '@/lib/domain/timesheet-view';
import { addDays } from '@/lib/engine/time';
import { formatDate, formatDayLabel, formatDecimal } from '@/lib/format';
import type { TimesheetView } from '@/lib/services/timesheet';
import { DayDrawer, type DayTarget } from './DayDrawer';
import { EmployeeDrawer, type EmployeeTarget } from './EmployeeDrawer';
import { TimesheetWeek } from './TimesheetWeek';
import styles from './timesheet.module.css';

const DATE_FORMAT = 'DD/MM/YYYY';
const ISO_FORMAT = 'YYYY-MM-DD';

const MODE_OPTIONS: { value: RangeMode; label: string }[] = [
  { value: 'payroll', label: 'Kỳ lương' },
  { value: 'shifted', label: 'Kỳ lệch' },
  { value: 'custom', label: 'Tự chọn' },
];

const START_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));

const cellClass = (symbol: string) => `${styles.cell} ${styles[`s_${symbol}`] ?? ''}`;

/** Màn A3: hàng là nhân viên, cột là ngày, ô theo 12 ký hiệu, cột tổng Công/Muộn/Thiếu/OT (US27). */
export function TimesheetPanel({ timesheet }: { timesheet: TimesheetView }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<string | null>(null);
  const [dayTarget, setDayTarget] = useState<DayTarget | null>(null);
  const [employeeTarget, setEmployeeTarget] = useState<EmployeeTarget | null>(null);
  const { mode, period, start, week } = timesheet;
  const isWeek = week !== null;

  /** Khoảng đang xem thành tham số URL; Excel và drawer một người đi theo đúng khoảng này. */
  const rangeQuery: TimesheetQuery =
    mode === 'custom'
      ? { from: period.from, to: period.to }
      : { period: period.key, start: start ?? undefined };
  const rangeSearch = timesheetSearch(rangeQuery);
  const viewQuery: TimesheetQuery = isWeek ? { view: 'week' } : {};
  const href = (query: TimesheetQuery) => `/app/bang-cong${timesheetSearch(query)}`;
  const go = (query: TimesheetQuery) => router.push(href(query));

  const changeMode = (next: RangeMode) => {
    if (next === 'payroll') go(viewQuery);
    if (next === 'shifted') go({ start: timesheet.suggestedStart, ...viewQuery });
    if (next === 'custom') go({ from: period.from, to: period.to, ...viewQuery });
  };

  /** Đổi một đầu thì kéo đầu kia theo, để khoảng luôn hợp lệ mà không phải báo lỗi. */
  const changeRange = (from: string, to: string, moved: 'from' | 'to') => {
    const longest = MAX_RANGE_DAYS - 1;
    const tooLong = from > to || rangeDays(from, to) > MAX_RANGE_DAYS;
    if (!tooLong) go({ from, to, ...viewQuery });
    else if (moved === 'from') go({ from, to: from > to ? from : addDays(from, longest), ...viewQuery });
    else go({ from: from > to ? to : addDays(to, -longest), to, ...viewQuery });
  };

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
  const [picking, setPicking] = useState(false);
  const [pickedCells, setPickedCells] = useState<readonly string[]>([]);
  const stopPicking = () => {
    setPicking(false);
    setPickedCells([]);
  };
  const bulk = useBulkApprove(period, () => {
    stopPicking();
    refresh();
  });

  const cellId = (employeeId: string, date: string) => `${employeeId}|${date}`;
  // Tính trên các dòng và tuần đang hiện: ô bị bộ lọc ẩn không được duyệt ngầm
  const shown = (date: string) => !week || (date >= week.from && date <= week.to);
  const selectable = rows.flatMap(({ id, cells }) =>
    cells
      .filter(({ date, approvable }) => shown(date) && approvable.length > 0)
      .map((cell) => ({ id: cellId(id, cell.date), cell })),
  );
  const chosen = selectable.filter(({ id }) => pickedCells.includes(id));
  const toggleCell = (id: string) =>
    setPickedCells((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const scroller = useRef<HTMLDivElement>(null);
  const { dates } = timesheet;
  const openEmployee = ({ id, name }: { id: string; name: string }) =>
    setEmployeeTarget({ id, name, search: rangeSearch });

  // Màn hẹp mở ở ngày gần nhất có dữ liệu, không phải đầu kỳ còn trống
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [period.key, isWeek]);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <nav className={styles.periodNav} aria-label="Chọn kỳ">
          {timesheet.previousKey ? (
            <Link
              className={styles.periodLink}
              href={href({ period: timesheet.previousKey, start: start ?? undefined, ...viewQuery })}
              aria-label="Kỳ trước"
            >
              <LeftOutlined />
            </Link>
          ) : null}
          <span className={styles.periodLabel}>
            {formatDate(period.from)} – {formatDate(period.to)}
          </span>
          {timesheet.nextKey ? (
            <Link
              className={styles.periodLink}
              href={href({ period: timesheet.nextKey, start: start ?? undefined, ...viewQuery })}
              aria-label="Kỳ sau"
            >
              <RightOutlined />
            </Link>
          ) : null}
        </nav>
        <Select
          className={styles.mode}
          aria-label="Loại kỳ"
          value={mode}
          options={MODE_OPTIONS}
          onChange={changeMode}
        />
        {mode === 'shifted' ? (
          <label className={styles.startField}>
            Bắt đầu từ ngày
            <Select
              aria-label="Ngày bắt đầu kỳ"
              value={start ?? timesheet.suggestedStart}
              options={START_OPTIONS}
              onChange={(value: number) => go({ start: value, ...viewQuery })}
              popupMatchSelectWidth={false}
            />
          </label>
        ) : null}
        {mode === 'shifted' ? (
          <Link className={styles.thisPeriod} href={href({ start: start ?? undefined, ...viewQuery })}>
            Kỳ này
          </Link>
        ) : null}
        {mode === 'custom' ? (
          <div className={styles.rangeFields}>
            <DatePicker
              aria-label="Từ ngày"
              allowClear={false}
              format={DATE_FORMAT}
              classNames={{ popup: { root: styles.calendar } }}
              value={dayjs(period.from)}
              onChange={(value: Dayjs) => changeRange(value.format(ISO_FORMAT), period.to, 'from')}
            />
            <DatePicker
              aria-label="Đến ngày"
              allowClear={false}
              format={DATE_FORMAT}
              classNames={{ popup: { root: styles.calendar } }}
              value={dayjs(period.to)}
              onChange={(value: Dayjs) => changeRange(period.from, value.format(ISO_FORMAT), 'to')}
            />
          </div>
        ) : null}
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
        <ExportButton url={`/api/v1/timesheet/export${rangeSearch}`} />
        {timesheet.canBulk ? (
          <Button
            type={picking ? 'primary' : 'default'}
            aria-pressed={picking}
            disabled={!picking && selectable.length === 0}
            onClick={() => (picking ? stopPicking() : setPicking(true))}
          >
            {picking ? 'Đang chọn ô' : 'Duyệt loạt'}
          </Button>
        ) : null}
      </div>

      <div className={styles.viewBar}>
        <Segmented
          aria-label="Cách xem"
          value={isWeek ? 'week' : 'grid'}
          options={[
            { value: 'grid', label: 'Lưới cả kỳ' },
            { value: 'week', label: 'Theo tuần' },
          ]}
          onChange={(value) => {
            stopPicking();
            go({ ...rangeQuery, ...(value === 'week' ? { view: 'week' } : {}) });
          }}
        />
        {week ? (
          <nav className={styles.weekChips} aria-label="Chọn tuần">
            {timesheet.weeks.map(({ from, to }) => (
              <Link
                key={from}
                className={`${styles.weekChip} ${from === week.from ? styles.weekChipActive : ''}`}
                aria-current={from === week.from ? 'true' : undefined}
                href={href({ ...rangeQuery, view: 'week', week: from })}
              >
                {from.slice(8)}/{from.slice(5, 7)} – {to.slice(8)}/{to.slice(5, 7)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {timesheet.isPayrollRange ? null : (
        <p className={styles.notice} role="note">
          Đây là khoảng xem, không phải kỳ lương. Tổng công có thể khác trang Lương.
        </p>
      )}

      {week ? (
        <TimesheetWeek
          dates={dates.filter((date) => date >= week.from && date <= week.to)}
          today={timesheet.today}
          employees={rows}
          picking={picking}
          pickedCells={pickedCells}
          onToggle={toggleCell}
          onOpenDay={({ id, name }, date) => setDayTarget({ employeeId: id, name, date })}
          onOpenEmployee={openEmployee}
        />
      ) : (
        <div ref={scroller} className={styles.scroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th scope="col" className={styles.nameHead}>
                  Nhân viên
                </th>
                {dates.map((date) => (
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
                      onClick={() => openEmployee(employee)}
                    >
                      {employee.name}
                      <span>{employee.positionName ?? 'Chưa có vị trí'}</span>
                    </button>
                  </th>
                  {dates.map((date) => {
                    const cell = employee.cells.find((row) => row.date === date);
                    if (!cell) return <td key={date} className={styles.empty} />;
                    const id = cellId(employee.id, date);
                    const canPick = picking && cell.approvable.length > 0;
                    const isPicked = canPick && pickedCells.includes(id);
                    const pickClass = canPick ? (isPicked ? styles.picked : styles.pickable) : '';
                    return (
                      <td key={date} className={styles.day}>
                        <button
                          type="button"
                          className={`${cellClass(cell.symbol)} ${pickClass}`}
                          title={cell.title}
                          aria-label={`${employee.name}, ${formatDate(date)}: ${cell.title}`}
                          aria-pressed={picking ? isPicked : undefined}
                          disabled={picking && !canPick}
                          onClick={() =>
                            picking
                              ? toggleCell(id)
                              : setDayTarget({ employeeId: employee.id, name: employee.name, date })
                          }
                        >
                          {cell.label}
                          {cell.shiftCount > 1 ? (
                            <span className={styles.badge}>{cell.shiftCount}</span>
                          ) : null}
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
      )}

      {picking ? (
        <div className={styles.bulkBar} role="status">
          <span>
            {chosen.length > 0
              ? `Đã chọn ${chosen.length} ô, duyệt theo đề xuất của hệ thống`
              : 'Bấm vào các ô viền đứt để chọn'}
          </span>
          <span className={styles.bulkActions}>
            <Button size="small" onClick={() => setPickedCells(selectable.map(({ id }) => id))}>
              Chọn mọi ô cần duyệt
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              disabled={chosen.length === 0}
              loading={bulk.busy}
              onClick={() => bulk.confirm(chosen.flatMap(({ cell }) => cell.approvable))}
            >
              Duyệt {chosen.length}
            </Button>
          </span>
        </div>
      ) : null}

      {isWeek ? (
        <p className={styles.weekLegend}>
          Khung sọc là giờ ca, thanh nâu là thời gian có mặt. Ca đêm hiện trọn trong ô của ngày bắt đầu ca.
        </p>
      ) : (
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
      )}

      <DayDrawer target={dayTarget} onClose={() => setDayTarget(null)} onChanged={refresh} />
      <EmployeeDrawer target={employeeTarget} onClose={() => setEmployeeTarget(null)} />
    </div>
  );
}
