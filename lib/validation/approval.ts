import { z } from 'zod';
import { ABSENCE_CHOICES, MAX_BULK_APPROVALS, MAX_PAY_FACTOR } from '@/lib/domain/approval';
import { MAX_RANGE_DAYS, rangeDays } from '@/lib/domain/timesheet-view';
import { isoDate, uuid } from './common';

const CONG_CHOICES = [0, 0.5, 1];

/** Trường không gửi thì giữ nguyên quyết định đã có; `null` là quay về theo hệ thống (US26). */
export const approvalSchema = z
  .object({
    employeeId: uuid,
    date: isoDate,
    shiftId: uuid.nullable(),
    congOverride: z
      .number()
      .refine((value) => CONG_CHOICES.includes(value), 'Số công không hợp lệ')
      .nullable()
      .optional(),
    /** Âm là trừ giờ khỏi lương; giao diện nhập giờ, gửi phút. */
    otMinutes: z.number().int().min(-1440).max(1440).nullable().optional(),
    approveMissing: z.boolean().optional(),
    waiveLate: z.boolean().optional(),
    waiveEarly: z.boolean().optional(),
    confirmShiftId: uuid.nullable().optional(),
    approveGps: z.boolean().optional(),
    /** Hệ số tiền của ca; `null` là về mặc định 1. */
    payFactor: z
      .number()
      .min(0, 'Hệ số không âm')
      .max(MAX_PAY_FACTOR, `Hệ số tối đa ${MAX_PAY_FACTOR}`)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
        'Hệ số tối đa 2 chữ số thập phân',
      )
      .nullable()
      .optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    ({ employeeId: _e, date: _d, shiftId: _s, note: _n, ...decision }) => Object.keys(decision).length > 0,
    {
      message: 'Chưa có quyết định nào',
      path: ['decision'],
    },
  );

export type ApprovalInput = z.infer<typeof approvalSchema>;

/** `label` là đề xuất người duyệt đã thấy; số liệu đổi thì nhãn đổi theo và việc đó bị bỏ qua. */
export const bulkApprovalSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    items: z
      .array(z.object({ key: z.string().min(1).max(200), label: z.string().min(1).max(200) }))
      .min(1)
      .max(MAX_BULK_APPROVALS),
    /** Cách xử lý mọi việc Vắng trong lô; không gửi thì việc Vắng bị bỏ qua. */
    absence: z.enum(ABSENCE_CHOICES).optional(),
  })
  .refine(({ from, to }) => from <= to && rangeDays(from, to) <= MAX_RANGE_DAYS, {
    message: 'Khoảng ngày không hợp lệ',
    path: ['to'],
  });

export type BulkApprovalInput = z.infer<typeof bulkApprovalSchema>;
