import { toMinutes } from '@/lib/domain/shift';
import { weekDay } from './time';
import type { DayInput, EngineShift } from './types';

export type ExpectedReason = 'shifts' | 'inactive' | 'off' | 'not_scheduled' | 'off_day';

export type ExpectedDay = { shifts: EngineShift[]; reason: ExpectedReason };

type ExpectedInput = Pick<DayInput, 'date' | 'employee' | 'schedule' | 'shifts'>;

/** Bước A: ca nhân viên phải làm trong ngày; quy tắc đầu tiên khớp sẽ quyết định. */
export function expectedShifts({ date, employee, schedule, shifts }: ExpectedInput): ExpectedDay {
  // Chuỗi `YYYY-MM-DD` so sánh được trực tiếp. Công đến hết `leftDate` được giữ (US13)
  if (date < employee.onboardDate || (employee.leftDate && date > employee.leftDate)) {
    return { shifts: [], reason: 'inactive' };
  }
  if (schedule?.isOff) return { shifts: [], reason: 'off' };

  if (schedule && schedule.shiftIds.length > 0) {
    const scheduled = shifts.filter(({ id }) => schedule.shiftIds.includes(id));
    return {
      shifts: scheduled.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
      reason: 'shifts',
    };
  }

  if (employee.shiftMode === 'flexible') return { shifts: [], reason: 'not_scheduled' };
  if (!employee.workDays.includes(weekDay(date))) return { shifts: [], reason: 'off_day' };

  const fixed = shifts.find(({ id }) => id === employee.fixedShiftId);
  return { shifts: fixed ? [fixed] : [], reason: fixed ? 'shifts' : 'not_scheduled' };
}
