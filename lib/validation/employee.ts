import { z } from 'zod';
import { isoDate, requiredText, uuid } from './common';

/** Công tắc riêng đang bật thì phải chọn ít nhất một mục; null là tắt. */
const overrideIds = z
  .array(uuid)
  .min(1, 'Chọn ít nhất một mục')
  .transform((ids) => [...new Set(ids)])
  .nullable();

const otRate = z.number().int().min(100).max(1000);

export const payOverrideSchema = z
  .object({
    payType: z.enum(['month', 'hour', 'unit']),
    payAmount: z.number().int().min(1).max(10_000_000_000),
    stdDays: z.number().int().min(1).max(31),
    leaveDays: z.number().int().min(0).max(60),
    otWeekday: otRate,
    otSaturday: otRate,
    otOffday: otRate,
    otHoliday: otRate,
  })
  .partial()
  .strict();

const employeeFields = {
  name: requiredText(),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  contract: z.enum(['full_time', 'part_time', 'intern', 'collaborator']),
  onboardDate: isoDate,
  role: z.enum(['app', 'manager', 'hr', 'admin']),
  managerId: uuid.nullable(),
  positionId: uuid.nullable(),
  /** null = theo vị trí; có giá trị = công tắc riêng đang bật (US12). */
  payOverride: payOverrideSchema.nullable(),
  shiftIds: overrideIds,
  locationIds: overrideIds,
};

export const employeeCreateSchema = z.object(employeeFields);

export const employeePatchSchema = z
  .object({ ...employeeFields, status: z.enum(['active', 'left']) })
  .partial();

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeePatchInput = z.infer<typeof employeePatchSchema>;
