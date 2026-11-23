/** [Đề xuất] Số lượng kiểm kê tối đa của một món, có tới 2 chữ số lẻ (vd 1,5 kg). */
export const MAX_QUANTITY = 1_000_000;

/** Số lưu numeric(12,2): làm tròn 2 chữ số lẻ trước khi so để 0,1 + 0,2 không thành lệch. */
const cents = (value: number) => Math.round(value * 100);

/** Số đếm khác số hiện có: dòng báo đỏ và nhân viên phải ghi lý do. */
export function isMismatch(expected: number, counted: number): boolean {
  return cents(expected) !== cents(counted);
}

/** Chênh lệch có dấu: âm là thiếu, dương là dư. */
export function quantityDiff(expected: number, counted: number): number {
  return (cents(counted) - cents(expected)) / 100;
}

export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export const INVENTORY_KIND_LABELS = { vat_dung: 'Vật dụng', nguyen_lieu: 'Nguyên liệu' } as const;

/** Nhóm theo loại, giữ thứ tự trong nhóm: phiếu đếm vật dụng trước, nguyên liệu sau. */
export function groupByKind<T extends { kind: keyof typeof INVENTORY_KIND_LABELS }>(rows: readonly T[]) {
  return (Object.keys(INVENTORY_KIND_LABELS) as (keyof typeof INVENTORY_KIND_LABELS)[])
    .map((kind) => ({
      kind,
      label: INVENTORY_KIND_LABELS[kind],
      rows: rows.filter((row) => row.kind === kind),
    }))
    .filter(({ rows: group }) => group.length > 0);
}
