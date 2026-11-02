import 'server-only';
import ExcelJS from 'exceljs';
import { SYMBOL_LEGEND, type DaySymbolKey } from '@/lib/domain/symbols';
import { formatDate, formatDayLabel } from '@/lib/format';
import type { TimesheetView } from '@/lib/services/timesheet';
import { startSheet } from './xlsx';

/** Trên lưới màu phân biệt các ô này; ra Excel không màu thì đủ công không được trùng ô trống. */
const EXPORT_LABELS: Partial<Record<DaySymbolKey, string>> = { du: 'X', ot_cho: '+?' };

const labelOf = (key: DaySymbolKey, label: string) => EXPORT_LABELS[key] ?? label;

export function timesheetWorkbook(timesheet: TimesheetView, companyName: string) {
  const { period, dates, employees } = timesheet;
  const workbook = new ExcelJS.Workbook();

  const grid = workbook.addWorksheet('Bảng công');
  const days = dates.map((date) => `${formatDayLabel(date).split(' ')[0]} ${date.slice(8)}`);
  const totals = ['Công', 'Muộn (phút)', 'Thiếu (lần)', 'OT duyệt (phút)', 'OT chờ (phút)'];
  startSheet(
    grid,
    `${companyName} · Bảng công ${formatDate(period.from)} – ${formatDate(period.to)}`,
    ['Nhân viên', 'Vị trí', ...days, ...totals],
    2,
  );

  for (const { name, positionName, cells, totals: sum } of employees) {
    const byDate = new Map(cells.map((cell) => [cell.date, cell]));
    const row = grid.addRow([
      name,
      positionName ?? '',
      ...dates.map((date) => {
        const cell = byDate.get(date);
        return cell ? labelOf(cell.symbol as DaySymbolKey, cell.label) : '';
      }),
      sum.cong,
      sum.lateMin,
      sum.missing,
      sum.otApproved,
      sum.otPending,
    ]);
    row.alignment = { horizontal: 'center' };
    row.getCell(1).alignment = { horizontal: 'left' };
    row.getCell(2).alignment = { horizontal: 'left' };
  }

  grid.getColumn(1).width = 24;
  grid.getColumn(2).width = 16;
  dates.forEach((_date, index) => {
    grid.getColumn(index + 3).width = 6;
  });
  totals.forEach((_total, index) => {
    grid.getColumn(dates.length + 3 + index).width = 10;
  });

  const legend = workbook.addWorksheet('Chú thích');
  legend.addRow(['Ký hiệu', 'Ý nghĩa']).font = { bold: true };
  for (const { key, label, title } of SYMBOL_LEGEND) legend.addRow([labelOf(key, label), title]);
  legend.getColumn(2).width = 28;

  return workbook;
}
