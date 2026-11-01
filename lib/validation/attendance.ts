import { z } from 'zod';
import { uuid } from './common';

const MAX_ACCURACY_M = 100_000;

/** Giờ chấm luôn lấy ở server: schema này cố tình không có trường thời gian. */
export const punchSchema = z.object({
  type: z.enum(['in', 'out']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(MAX_ACCURACY_M),
  chosenShiftId: uuid.nullable().optional(),
});

export type PunchInput = z.infer<typeof punchSchema>;
