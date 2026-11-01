import { z } from 'zod';
import { isoDate, requiredText, timeOfDay, uuid } from './common';

const MAX_LEAVE_DAYS = 31;

const reason = requiredText(500);
const optionalTime = z.preprocess((value) => value || null, timeOfDay.nullable());

const dayCount = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;

export const requestSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('leave'),
      leaveType: z.enum(['annual', 'sick', 'unpaid']),
      fromDate: isoDate,
      toDate: isoDate,
      reason,
    }),
    z.object({
      type: z.literal('forgot'),
      date: isoDate,
      shiftId: uuid,
      inTime: optionalTime,
      outTime: optionalTime,
      reason,
    }),
    z.object({
      type: z.literal('overtime'),
      date: isoDate,
      when: z.enum(['before', 'after']),
      from: timeOfDay,
      to: timeOfDay,
      reason,
    }),
  ])
  .superRefine((value, issues) => {
    if (value.type === 'leave') {
      const days = dayCount(value.fromDate, value.toDate);
      if (days < 1)
        issues.addIssue({ code: 'custom', message: 'Đến ngày phải sau Từ ngày', path: ['toDate'] });
      if (days > MAX_LEAVE_DAYS) {
        issues.addIssue({
          code: 'custom',
          message: `Tối đa ${MAX_LEAVE_DAYS} ngày một đơn`,
          path: ['toDate'],
        });
      }
    }
    if (value.type === 'forgot' && !value.inTime && !value.outTime) {
      issues.addIssue({ code: 'custom', message: 'Điền ít nhất giờ vào hoặc giờ ra', path: ['inTime'] });
    }
    if (value.type === 'overtime' && value.from === value.to) {
      issues.addIssue({ code: 'custom', message: 'Giờ kết thúc phải khác giờ bắt đầu', path: ['to'] });
    }
  });

export type RequestInput = z.infer<typeof requestSchema>;

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).nullable().optional(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

export const explanationSchema = z.object({
  date: isoDate,
  shiftId: uuid.nullable(),
  reason: z.string().trim().min(10, 'Lý do cần ít nhất 10 ký tự').max(500),
});

export type ExplanationInput = z.infer<typeof explanationSchema>;

/** Kỳ trên URL, `2026-10`. */
export const periodKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
