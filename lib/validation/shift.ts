import { z } from 'zod';
import { isBreakInsideShift, shiftSpanMinutes, shiftWorkMinutes } from '@/lib/domain/shift';
import { optionalTimeOfDay, requiredText, timeOfDay } from './common';

const minutes = z.number().int().min(0).max(1440);

export const shiftSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_]{1,12}$/, 'Mã gồm 1–12 chữ cái không dấu, số hoặc _')),
    name: requiredText(),
    startTime: timeOfDay,
    endTime: timeOfDay,
    breakStart: optionalTimeOfDay,
    breakEnd: optionalTimeOfDay,
    calc: z.enum(['block', 'actual', 'actual_strict']),
    stdHours: z.number().gt(0, 'Phải lớn hơn 0').max(24),
    minFull: minutes,
    minHalf: minutes,
    graceMin: z.number().int().min(0).max(240),
    minOt: z.number().int().min(0).max(1440).nullable(),
    isPart: z.boolean(),
    noLateCheck: z.boolean(),
  })
  .superRefine((shift, ctx) => {
    if (shift.startTime === shift.endTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Giờ ra phải khác giờ vào' });
      return;
    }
    if (Boolean(shift.breakStart) !== Boolean(shift.breakEnd)) {
      const path = shift.breakStart ? 'breakEnd' : 'breakStart';
      ctx.addIssue({ code: 'custom', path: [path], message: 'Nhập đủ giờ bắt đầu và kết thúc nghỉ' });
    } else if (!isBreakInsideShift(shift)) {
      ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'Giờ nghỉ phải nằm trong ca' });
    }
    if (shift.minHalf > shift.minFull) {
      ctx.addIssue({ code: 'custom', path: ['minHalf'], message: 'Không được lớn hơn số phút đủ 1 công' });
    }
    if (shiftSpanMinutes(shift) > 0 && shift.minFull > shiftWorkMinutes(shift)) {
      ctx.addIssue({ code: 'custom', path: ['minFull'], message: 'Không được lớn hơn số phút làm của ca' });
    }
  });

export type ShiftInput = z.infer<typeof shiftSchema>;
