import { z } from 'zod';
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
    otMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    approveMissing: z.boolean().optional(),
    waiveLate: z.boolean().optional(),
    waiveEarly: z.boolean().optional(),
    confirmShiftId: uuid.nullable().optional(),
    approveGps: z.boolean().optional(),
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
