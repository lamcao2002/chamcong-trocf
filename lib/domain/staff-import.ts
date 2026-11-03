import { z } from 'zod';

/** Giới hạn một lần dán: mỗi người băm một PIN, nhiều hơn dễ quá thời gian của request. */
export const MAX_IMPORT_ROWS = 100;

export type ImportLine = { line: number; name: string; email: string; positionText: string };

export type ImportRow = ImportLine & { positionId: string | null; error: string | null };

const validEmail = z.string().email();
const HEADER_NAMES = new Set(['ho ten', 'ho va ten', 'ten', 'nhan vien']);

/** Bỏ dấu, hoa thường, khoảng trắng thừa: "PHA  chế" và "Pha che" là một. */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mỗi dòng: họ tên, email, vị trí; ngăn bằng phẩy, chấm phẩy hoặc tab khi dán từ Excel. */
export function parseStaffLines(text: string): ImportLine[] {
  const rows = text.split(/\r?\n/).flatMap((raw, index) => {
    if (!raw.trim()) return [];
    const [name = '', email = '', positionText = ''] = raw.split(/[\t;,]/).map((cell) => cell.trim());
    return [{ line: index + 1, name, email: email.toLowerCase(), positionText }];
  });
  // Dán cả bảng từ Excel thường kèm dòng tiêu đề, dòng đó không phải một người lỗi
  const first = rows[0];
  const isHeader = first && !first.email.includes('@') && HEADER_NAMES.has(normalizeName(first.name));
  return isHeader ? rows.slice(1) : rows;
}

/** Gắn vị trí và lỗi cho từng dòng; vị trí không khớp vẫn nhận, người dùng chọn lại ở bảng xem trước. */
export function reviewStaffLines(
  lines: readonly ImportLine[],
  positions: readonly { id: string; name: string }[],
  takenEmails: ReadonlySet<string>,
): ImportRow[] {
  const positionIds = new Map(positions.map(({ id, name }) => [normalizeName(name), id]));
  const firstLine = new Map<string, number>();

  return lines.map((row) => {
    const positionId = positionIds.get(normalizeName(row.positionText)) ?? null;
    let error: string | null = null;
    if (!row.name) error = 'Thiếu họ tên';
    else if (!validEmail.safeParse(row.email).success) error = 'Thiếu email hoặc email sai';
    else if (takenEmails.has(row.email)) error = 'Email đã có người dùng';
    else if (firstLine.has(row.email)) error = `Trùng email với dòng ${firstLine.get(row.email)}`;
    else firstLine.set(row.email, row.line);
    return { ...row, positionId, error };
  });
}
