import { describe, expect, it } from 'vitest';
import { isBreakInsideShift, isOvernight, shiftWorkLabel, shiftWorkMinutes } from './shift';

const CA1 = { startTime: '06:00', endTime: '14:00', breakStart: '10:00', breakEnd: '10:30' };

describe('isOvernight', () => {
  it('tự nhận khi giờ ra nhỏ hơn giờ vào', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true);
    expect(isOvernight('06:00', '14:00')).toBe(false);
  });
});

describe('shiftWorkLabel', () => {
  it('ghi rõ đã trừ nghỉ', () => {
    expect(shiftWorkLabel(CA1)).toBe('Làm 7 giờ 30 phút (đã trừ nghỉ)');
  });

  it('ca không nghỉ, tròn giờ', () => {
    expect(shiftWorkLabel({ startTime: '17:00', endTime: '22:00' })).toBe('Làm 5 giờ');
  });

  it('ca qua đêm', () => {
    expect(shiftWorkLabel({ startTime: '22:00', endTime: '06:00' })).toBe('Làm 8 giờ');
    expect(
      shiftWorkMinutes({ startTime: '22:00', endTime: '06:00', breakStart: '01:00', breakEnd: '01:30' }),
    ).toBe(450);
  });

  it('dưới một giờ', () => {
    expect(shiftWorkLabel({ startTime: '06:00', endTime: '06:45' })).toBe('Làm 45 phút');
  });
});

describe('isBreakInsideShift', () => {
  it('nhận giờ nghỉ trong ca, kể cả qua đêm', () => {
    expect(isBreakInsideShift(CA1)).toBe(true);
    expect(
      isBreakInsideShift({ startTime: '22:00', endTime: '06:00', breakStart: '23:30', breakEnd: '00:30' }),
    ).toBe(true);
  });

  it('từ chối giờ nghỉ ngoài ca hoặc ngược', () => {
    expect(isBreakInsideShift({ ...CA1, breakStart: '15:00', breakEnd: '15:30' })).toBe(false);
    expect(isBreakInsideShift({ ...CA1, breakStart: '11:00', breakEnd: '10:00' })).toBe(false);
  });
});
