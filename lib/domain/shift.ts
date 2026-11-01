const DAY_MINUTES = 24 * 60;

export function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Ca qua đêm khi giờ ra nhỏ hơn giờ vào (US05). */
export function isOvernight(startTime: string, endTime: string): boolean {
  return toMinutes(endTime) < toMinutes(startTime);
}

type ShiftTimes = {
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
};

/** Trải mốc giờ lên trục tính từ giờ vào ca, để ca qua đêm so sánh được. */
export function offsetFrom(startTime: string, time: string): number {
  return (toMinutes(time) - toMinutes(startTime) + DAY_MINUTES) % DAY_MINUTES;
}

export function shiftSpanMinutes({ startTime, endTime }: ShiftTimes): number {
  return offsetFrom(startTime, endTime);
}

/** Giờ nghỉ nằm trọn trong ca và nhỏ hơn thời lượng ca. */
export function isBreakInsideShift(shift: ShiftTimes): boolean {
  if (!shift.breakStart || !shift.breakEnd) return true;
  const from = offsetFrom(shift.startTime, shift.breakStart);
  const to = offsetFrom(shift.startTime, shift.breakEnd);
  return from > 0 && to > from && to < shiftSpanMinutes(shift);
}

/** Số phút làm của ca sau khi trừ nghỉ. */
export function shiftWorkMinutes(shift: ShiftTimes): number {
  const span = shiftSpanMinutes(shift);
  if (!shift.breakStart || !shift.breakEnd) return span;
  return span - (offsetFrom(shift.startTime, shift.breakEnd) - offsetFrom(shift.startTime, shift.breakStart));
}

/** Nhãn của form ca: "Làm 7 giờ 30 phút (đã trừ nghỉ)", "Làm 5 giờ". */
export function shiftWorkLabel(shift: ShiftTimes): string {
  const minutes = shiftWorkMinutes(shift);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [hours ? `${hours} giờ` : '', rest ? `${rest} phút` : ''].filter(Boolean).join(' ');
  return `Làm ${parts || '0 phút'}${shift.breakStart && shift.breakEnd ? ' (đã trừ nghỉ)' : ''}`;
}
