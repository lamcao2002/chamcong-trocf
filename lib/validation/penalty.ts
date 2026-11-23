import { z } from 'zod';
import { MAX_PENALTY_AMOUNT, MAX_SCARS, MIN_PENALTY_NOTE, PENALTY_ISSUES } from '@/lib/domain/penalties';
import { isoDate, optionalText, requiredText, uuid } from './common';

const scars = z.number().int().min(0).max(MAX_SCARS);
const amount = z.number().int().min(0).max(MAX_PENALTY_AMOUNT);
const NO_VALUE = 'Nhập số sẹo hoặc số tiền lớn hơn 0';
const issue = z.enum(PENALTY_ISSUES);

/** Quy định: sẹo, tiền hoặc cả hai, ít nhất một số lớn hơn 0. */
export const penaltyRuleSchema = z
  .object({ name: requiredText(120), scars, amount, note: optionalText(300) })
  .refine(({ scars, amount }) => scars > 0 || amount > 0, { message: NO_VALUE, path: ['scars'] });

export type PenaltyRuleInput = z.infer<typeof penaltyRuleSchema>;

/**
 * Một lần phạt. `ruleId` null là mục Khác, khi đó bắt buộc `otherReason`. Số sẹo, tiền lấy theo quy
 * định nhưng sửa được cho lần này. Ngày vi phạm kiểm ở service vì cần hôm nay theo giờ Việt Nam.
 * Gắn lỗi chấm công thì gửi cả `shiftId` và `issue`; service tính lại ngày công để kiểm lỗi còn thật.
 */
export const penaltySchema = z
  .object({
    employeeId: uuid,
    date: isoDate,
    ruleId: uuid.nullable(),
    otherReason: optionalText(120),
    scars,
    amount,
    note: z
      .string()
      .trim()
      .min(MIN_PENALTY_NOTE, `Ghi rõ bằng chứng, ít nhất ${MIN_PENALTY_NOTE} ký tự`)
      .max(1000),
    shiftId: uuid.nullable().default(null),
    issue: issue.nullable().default(null),
  })
  .refine(({ scars, amount }) => scars > 0 || amount > 0, { message: NO_VALUE, path: ['scars'] })
  .refine(({ shiftId, issue }) => (shiftId === null) === (issue === null), {
    message: 'Chọn lại lỗi chấm công',
    path: ['issue'],
  })
  .refine(({ ruleId, otherReason }) => ruleId !== null || Boolean(otherReason), {
    message: 'Ghi lý do phạt',
    path: ['otherReason'],
  });

export type PenaltyInput = z.infer<typeof penaltySchema>;

export const penaltyCancelSchema = z.object({ reason: requiredText(300) });

export type PenaltyCancelInput = z.infer<typeof penaltyCancelSchema>;

/** Một ngày của một người, để xem chấm công làm bằng chứng. */
export const penaltyDaySchema = z.object({ employeeId: uuid, date: isoDate });

/** Một lỗi chấm công: Bỏ qua trong gợi ý phạt. */
export const penaltyIssueSchema = penaltyDaySchema.extend({ shiftId: uuid, issue });

export type PenaltyIssueInput = z.infer<typeof penaltyIssueSchema>;
