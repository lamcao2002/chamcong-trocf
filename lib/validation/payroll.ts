import { z } from 'zod';
import { requiredText, uuid } from './common';
import { periodKeySchema } from './request';

const MAX_AMOUNT = 10_000_000_000;

export const adjustmentSchema = z.object({
  periodKey: periodKeySchema,
  employeeId: uuid,
  kind: z.enum(['bonus', 'penalty']),
  amount: z.number().int().min(1, 'Số tiền phải lớn hơn 0').max(MAX_AMOUNT),
  note: requiredText(300),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

/** Tối đa bằng một lô duyệt loạt: quán nhỏ, chọn cả danh sách vẫn dưới mức này. */
const MAX_PUBLISH_PICK = 500;

/** Không gửi body hoặc không có `employeeIds` là cả kỳ. */
export const publishPickSchema = z
  .object({ employeeIds: z.array(uuid).min(1, 'Chưa chọn nhân viên nào').max(MAX_PUBLISH_PICK).optional() })
  .optional();
