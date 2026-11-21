import { describe, expect, it } from 'vitest';
import { groupByKind, hasAtMostTwoDecimals, isMismatch, quantityDiff } from './inventory';

describe('so số kiểm kê', () => {
  it.each([
    [10, 10, false],
    [10, 9, true],
    [1.5, 1.5, false],
    [0.3, 0.1 + 0.2, false],
    [2, 2.01, true],
    [0, 0, false],
  ])('hiện có %s, đếm %s → lệch %s', (expected, counted, mismatch) => {
    expect(isMismatch(expected, counted)).toBe(mismatch);
  });

  it('chênh lệch âm là thiếu, dương là dư', () => {
    expect(quantityDiff(12, 10)).toBe(-2);
    expect(quantityDiff(1.5, 2.25)).toBe(0.75);
  });

  it('chỉ nhận tới 2 chữ số lẻ', () => {
    expect(hasAtMostTwoDecimals(1.25)).toBe(true);
    expect(hasAtMostTwoDecimals(0.1 + 0.2)).toBe(true);
    expect(hasAtMostTwoDecimals(1.255)).toBe(false);
  });
});

describe('nhóm theo loại', () => {
  it('vật dụng trước, nguyên liệu sau, bỏ nhóm trống, giữ thứ tự trong nhóm', () => {
    const rows = [
      { kind: 'nguyen_lieu' as const, name: 'Sữa' },
      { kind: 'vat_dung' as const, name: 'Ly' },
      { kind: 'nguyen_lieu' as const, name: 'Đường' },
    ];
    expect(groupByKind(rows).map(({ label, rows: group }) => [label, group.map(({ name }) => name)])).toEqual(
      [
        ['Vật dụng', ['Ly']],
        ['Nguyên liệu', ['Sữa', 'Đường']],
      ],
    );
    expect(groupByKind(rows.slice(1, 2))).toHaveLength(1);
  });
});
