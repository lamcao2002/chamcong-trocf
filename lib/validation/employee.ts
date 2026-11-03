import { z } from 'zod';
import { MAX_IMPORT_ROWS } from '@/lib/domain/staff-import';
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

/** Một dòng của Thêm hàng loạt; hợp đồng, quyền và ngày vào làm lấy mặc định, sửa sau ở hồ sơ. */
export const employeeBulkSchema = z.object({
  employees: z
    .array(z.object({ name: employeeFields.name, email: employeeFields.email, positionId: uuid.nullable() }))
    .min(1)
    .max(MAX_IMPORT_ROWS)
    .refine(
      (rows) => new Set(rows.map(({ email }) => email)).size === rows.length,
      'Danh sách có email trùng',
    ),
});

export type EmployeeBulkInput = z.infer<typeof employeeBulkSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeePatchInput = z.infer<typeof employeePatchSchema>;

/** Gõ lại email của người bị xoá, để không xoá nhầm người chỉ vì bấm nhanh. */
export const employeeDeleteSchema = z.object({ email: z.string().trim().toLowerCase() });

export type EmployeeDeleteInput = z.infer<typeof employeeDeleteSchema>;
