import { z } from 'zod';
import { requiredText, uuid, uuidList, workDays } from './common';

const otRate = z.number().int().min(100).max(1000);

export const positionSchema = z
  .object({
    name: requiredText(),
    shiftMode: z.enum(['fixed', 'flexible']),
    fixedShiftId: uuid.nullable(),
    shiftIds: uuidList,
    workDays,
    anyLocation: z.boolean(),
    locationIds: uuidList,
    /** Vị trí mà người ở vị trí này làm thay được khi nhận pass ca, vd Pha chế làm thay Phục vụ. */
    coverIds: uuidList.default([]),
    payType: z.enum(['month', 'hour', 'unit']),
    payAmount: z.number().int().min(1).max(10_000_000_000),
    stdDays: z.number().int().min(1).max(31),
    leaveDays: z.number().int().min(0).max(60),
    otWeekday: otRate,
    otSaturday: otRate.nullable(),
    otOffday: otRate,
    otHoliday: otRate,
  })
  .superRefine((position, ctx) => {
    if (position.shiftMode === 'fixed' && !position.fixedShiftId) {
      ctx.addIssue({ code: 'custom', path: ['fixedShiftId'], message: 'Chọn ca cố định' });
    }
    if (position.shiftMode === 'flexible' && position.shiftIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['shiftIds'], message: 'Chọn ít nhất một ca được làm' });
    }
    if (!position.anyLocation && position.locationIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['locationIds'],
        message: 'Chọn địa điểm hoặc "Ở đâu cũng được"',
      });
    }
  })
  // Cố định: danh sách ca chỉ có đúng ca đó; ở đâu cũng được: không giữ địa điểm cũ
  .transform((position) => ({
    ...position,
    fixedShiftId: position.shiftMode === 'fixed' ? position.fixedShiftId : null,
    shiftIds: position.shiftMode === 'fixed' ? [position.fixedShiftId!] : position.shiftIds,
    locationIds: position.anyLocation ? [] : position.locationIds,
  }));

export type PositionInput = z.infer<typeof positionSchema>;
