import { z } from 'zod';
import { hasAtMostTwoDecimals, isMismatch, MAX_QUANTITY } from '@/lib/domain/inventory';
import { optionalText, requiredText, uuid, uuidList } from './common';

const quantity = z.number().min(0).max(MAX_QUANTITY).refine(hasAtMostTwoDecimals, 'Tối đa 2 chữ số lẻ');

export const inventoryKind = z.enum(['vat_dung', 'nguyen_lieu']);

/** Một món trong danh mục của quán. */
export const inventoryItemSchema = z.object({
  kind: inventoryKind,
  name: requiredText(80),
  unit: requiredText(20),
  quantity,
  note: optionalText(200),
});

/** Phiếu kiểm kê: thứ tự `itemIds` là thứ tự nhân viên đếm. */
export const inventorySheetSchema = z.object({
  name: requiredText(80),
  positionIds: uuidList.refine((ids) => ids.length > 0, 'Chọn ít nhất một vị trí'),
  itemIds: uuidList.refine((ids) => ids.length > 0, 'Thêm ít nhất một món'),
});

const countedLine = { counted: quantity, note: optionalText(200) };

/** Nhân viên gửi số đếm của mọi món trong phiếu; lý do lệch kiểm ở service vì cần số hiện có. */
export const inventoryReportSchema = z.object({
  sheetId: uuid,
  lines: z.array(z.object({ itemId: uuid, ...countedLine })).min(1),
});

/** Sửa trong 10 phút: sửa số đếm và lý do theo từng dòng đã gửi. */
export const inventoryReportEditSchema = z.object({
  lines: z.array(z.object({ id: uuid, ...countedLine })).min(1),
});

/** Lỗi theo dòng: số lệch mà chưa ghi lý do. Dùng ở service, và ở form để báo trước khi gửi. */
export function missingReasons(
  lines: readonly { expected: number; counted: number; note: string | null }[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  lines.forEach(({ expected, counted, note }, index) => {
    if (isMismatch(expected, counted) && !note?.trim()) fields[`lines.${index}.note`] = 'Ghi lý do lệch';
  });
  return fields;
}

export type InventoryKind = z.infer<typeof inventoryKind>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type InventorySheetInput = z.infer<typeof inventorySheetSchema>;
export type InventoryReportInput = z.infer<typeof inventoryReportSchema>;
export type InventoryReportEditInput = z.infer<typeof inventoryReportEditSchema>;
