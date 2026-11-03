import 'server-only';
import ExcelJS from 'exceljs';
import { formatDate } from '@/lib/format';
import { splitPayLines } from '@/lib/payroll/compute-pay';
import type { PayrollDocument } from '@/lib/services/payroll';
import { STATE_LABELS } from './labels';
import { startSheet } from './xlsx';

const PAY_LABELS = { month: 'Lương tháng', hour: 'Lương giờ', unit: 'Lương công' } as const;
const MONEY_FORMAT = '#,##0';
const FIRST_MONEY_COLUMN = 6;

export function payrollWorkbook(document: PayrollDocument, companyName: string) {
  const { period, state, slips } = document;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bảng lương');
  const money = ['Lương', 'Nghỉ có lương', 'OT', 'Thưởng', 'Phạt', 'Thực lĩnh'];
  startSheet(
    sheet,
    `${companyName} · Bảng lương ${formatDate(period.from)} – ${formatDate(period.to)} · ${STATE_LABELS[state]}`,
    ['Nhân viên', 'Vị trí', 'Kiểu lương', 'Công', 'OT duyệt (phút)', ...money],
    1,
  );

  const totals = [0, 0, 0, 0, 0, 0];
  for (const { name, positionName, payType, cong, otApprovedMin, lines, net } of slips) {
    const { base, paidLeave, ot, bonus, penalty } = splitPayLines(lines);
    const amounts = [base, paidLeave, ot, bonus, penalty, net];
    amounts.forEach((amount, index) => {
      totals[index]! += amount;
    });
    sheet.addRow([name, positionName ?? '', PAY_LABELS[payType], cong, otApprovedMin, ...amounts]);
  }
  sheet.addRow(['Tổng', '', '', '', '', ...totals]).font = { bold: true };

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 13;
  money.forEach((_label, index) => {
    const column = sheet.getColumn(FIRST_MONEY_COLUMN + index);
    column.width = 14;
    column.numFmt = MONEY_FORMAT;
  });
  return workbook;
}
