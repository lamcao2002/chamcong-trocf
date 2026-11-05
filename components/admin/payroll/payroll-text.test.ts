import { describe, expect, it } from 'vitest';
import { hoursMinutes, payRate, periodTitle } from './payroll-text';

describe('payroll-text', () => {
  it('giờ phút kiểu bảng công', () => {
    expect(hoursMinutes(283)).toBe('4g43');
    expect(hoursMinutes(300)).toBe('5g');
    expect(hoursMinutes(65)).toBe('1g05');
    expect(hoursMinutes(45)).toBe('45p');
  });

  it('tên kỳ và mức lương', () => {
    expect(periodTitle('2026-10')).toBe('Tháng 10/2026');
    expect(payRate('hour', 25_000)).toBe('Lương giờ 25.000đ/giờ');
  });
});
