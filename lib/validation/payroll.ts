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
