import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { MAX_RANGE_DAYS, rangeDays } from '@/lib/domain/timesheet-view';
import { isoDate } from './common';
import { periodKeySchema } from './request';

export const timesheetQuerySchema = z
  .object({
    period: periodKeySchema.optional(),
    start: z.coerce.number().int().min(1).max(31).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    view: z.literal('week').optional(),
    week: isoDate.optional(),
  })
  .refine(({ from, to }) => Boolean(from) === Boolean(to), 'Cần đủ ngày đầu và ngày cuối')
  .refine(
    ({ from, to }) => !from || !to || (from <= to && rangeDays(from, to) <= MAX_RANGE_DAYS),
    `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày`,
  );

/** Tham số Bảng công từ URL của route API; sai thì 400 chứ không âm thầm về kỳ mặc định. */
export function readTimesheetQuery(request: Request) {
  const parsed = timesheetQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(400, 'Kỳ không hợp lệ');
  return parsed.data;
}
