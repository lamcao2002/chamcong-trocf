import 'server-only';
import type { Workbook, Worksheet } from 'exceljs';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Dòng 1 là tiêu đề, dòng 2 là tên cột; cố định phần này và các cột định danh khi cuộn. */
export function startSheet(sheet: Worksheet, title: string, header: string[], frozenColumns: number) {
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };
  sheet.addRow([]);
  sheet.getRow(2).values = header;
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', xSplit: frozenColumns, ySplit: 2 }];
}

export async function xlsxResponse(workbook: Workbook, filename: string): Promise<Response> {
  const body = await workbook.xlsx.writeBuffer();
  return new Response(body as ArrayBuffer, {
    headers: { 'content-type': XLSX_TYPE, 'content-disposition': `attachment; filename="${filename}"` },
  });
}
