import { describe, expect, it } from 'vitest';
import { normalizeName, parseStaffLines, reviewStaffLines } from './staff-import';

const positions = [
  { id: 'p1', name: 'Pha chế' },
  { id: 'p2', name: 'Đầu bếp' },
];

describe('normalizeName', () => {
  it('bỏ dấu, kể cả chữ đ, không phân biệt hoa thường', () => {
    expect(normalizeName('  ĐẦU   Bếp ')).toBe('dau bep');
    expect(normalizeName('Pha che')).toBe(normalizeName('Pha chế'));
  });
});

describe('parseStaffLines', () => {
  it('nhận phẩy, chấm phẩy và tab, bỏ dòng trống, giữ số dòng gốc', () => {
    const text = 'An, an@x.vn, Pha chế\r\n\nBình; BINH@x.vn; Đầu bếp\nChi\tchi@x.vn\tPha chế';
    expect(parseStaffLines(text)).toEqual([
      { line: 1, name: 'An', email: 'an@x.vn', positionText: 'Pha chế' },
      { line: 3, name: 'Bình', email: 'binh@x.vn', positionText: 'Đầu bếp' },
      { line: 4, name: 'Chi', email: 'chi@x.vn', positionText: 'Pha chế' },
    ]);
  });

  it('bỏ dòng tiêu đề dán từ Excel, không bỏ người có email', () => {
    expect(parseStaffLines('Họ tên\tEmail\tVị trí\nAn\tan@x.vn\t')).toHaveLength(1);
    expect(parseStaffLines('Nguyễn Văn Tên, sai')).toHaveLength(1);
  });

  it('dòng thiếu cột vẫn ra dòng để báo lỗi', () => {
    expect(parseStaffLines('Chỉ có tên')[0]).toMatchObject({ name: 'Chỉ có tên', email: '' });
  });
});

describe('reviewStaffLines', () => {
  const review = (text: string, taken: string[] = []) =>
    reviewStaffLines(parseStaffLines(text), positions, new Set(taken));

  it('khớp vị trí không dấu, không khớp thì để trống chứ không báo lỗi', () => {
    const [a, b] = review('An, an@x.vn, pha che\nBình, binh@x.vn, Bảo vệ');
    expect(a).toMatchObject({ positionId: 'p1', error: null });
    expect(b).toMatchObject({ positionId: null, error: null });
  });

  it('báo từng loại lỗi', () => {
    const rows = review(', a@x.vn\nAn, sai\nBình, co@x.vn\nChi, c@x.vn\nDũng, c@x.vn', ['co@x.vn']);
    expect(rows.map(({ error }) => error)).toEqual([
      'Thiếu họ tên',
      'Thiếu email hoặc email sai',
      'Email đã có người dùng',
      null,
      'Trùng email với dòng 4',
    ]);
  });
});
