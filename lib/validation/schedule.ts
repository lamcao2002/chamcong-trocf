import { z } from 'zod';
import { isoDate, uuid, uuidList } from './common';

const MONDAY = 1;

/** Tuần xác định bằng ngày Thứ Hai. */
export const weekSchema = isoDate.refine(
  (value) => new Date(`${value}T00:00:00Z`).getUTCDay() === MONDAY,
  'Tuần phải bắt đầu từ Thứ Hai',
);

const cellSchema = z
  .object({
    employeeId: uuid,
    date: isoDate,
    shiftIds: uuidList,
    isOff: z.boolean(),
    /** Mã ca → vị trí; ca không có ở đây là vị trí chính. */
    positions: z.record(uuid, uuid).optional(),
  })
  .refine(({ isOff, shiftIds }) => !isOff || shiftIds.length === 0, {
    message: 'Ngày Cho nghỉ không có ca',
    path: ['shiftIds'],
  });

export const scheduleSaveSchema = z
  .object({ cells: z.array(cellSchema).min(1).max(500) })
  .refine(
    ({ cells }) =>
      new Set(cells.map(({ employeeId, date }) => `${employeeId}|${date}`)).size === cells.length,
    { message: 'Một ô bị gửi hai lần', path: ['cells'] },
  );

export type ScheduleSaveInput = z.infer<typeof scheduleSaveSchema>;

/** Công bố hoặc bỏ nháp của một tuần. */
export const scheduleWeekSchema = z.object({ week: weekSchema });

export type ScheduleWeekInput = z.infer<typeof scheduleWeekSchema>;
