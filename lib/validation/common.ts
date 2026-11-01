import { z, type ZodError } from 'zod';

// Thông báo tiếng Việt mặc định cho mọi schema, dùng chung ở form và API
z.setErrorMap((issue, ctx) => {
  if (issue.code === 'invalid_type' && (issue.received === 'undefined' || issue.received === 'null')) {
    return { message: 'Trường này là bắt buộc' };
  }
  if (issue.code === 'too_small' && issue.type === 'string') return { message: 'Trường này là bắt buộc' };
  if (issue.code === 'too_small' && issue.type === 'number') {
    return { message: `Tối thiểu ${String(issue.minimum)}` };
  }
  if (issue.code === 'too_big' && issue.type === 'number')
    return { message: `Tối đa ${String(issue.maximum)}` };
  if (issue.code === 'too_big' && issue.type === 'string') return { message: 'Quá dài' };
  if (issue.code === 'invalid_enum_value') return { message: 'Giá trị không hợp lệ' };
  return { message: ctx.defaultError };
});

export const uuid = z.string().uuid('Giá trị không hợp lệ');
export const uuidList = z.array(uuid).transform((ids) => [...new Set(ids)]);
export const requiredText = (max = 120) => z.string().trim().min(1).max(max);

/** Ô để trống gửi lên là '' hoặc null, lưu là null. */
export const optionalText = (max = 200) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value) || null,
    z.string().max(max).nullable(),
  );

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ');
export const optionalTimeOfDay = z.preprocess((value) => value || null, timeOfDay.nullable());
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Ngày không hợp lệ');

/** Thứ trong tuần: 0 = Chủ nhật … 6 = Thứ Bảy. */
export const workDays = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'Chọn ít nhất một ngày')
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

/** Lỗi zod thành { 'duong.dan': 'thông báo' }, giữ lỗi đầu tiên của mỗi trường. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join('.')] ??= issue.message;
  return fields;
}
