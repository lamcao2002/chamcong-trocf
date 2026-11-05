import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatWorkDays, shiftHoursLabel } from './format';

describe('formatMoney', () => {
  it('dùng dấu chấm ngăn nghìn và hậu tố đ', () => {
    expect(formatMoney(1234567)).toBe('1.234.567đ');
    expect(formatMoney(25000)).toBe('25.000đ');
    expect(formatMoney(0)).toBe('0đ');
  });
});

describe('formatDate', () => {
  it('đổi sang dd/mm/yyyy', () => {
    expect(formatDate('2026-09-02')).toBe('02/09/2026');
  });
});

describe('formatWorkDays', () => {
  it('thứ Hai đứng đầu, Chủ nhật cuối', () => {
    expect(formatWorkDays([0, 1, 6])).toBe('T2, T7, CN');
    expect(formatWorkDays([0, 1, 2, 3, 4, 5, 6])).toBe('Cả tuần');
  });
});

describe('shiftHoursLabel', () => {
  it('bỏ phút chẵn, giữ phút lẻ', () => {
    expect(shiftHoursLabel('07:00:00', '12:00:00')).toBe('07–12');
    expect(shiftHoursLabel('17:30', '22:00')).toBe('17:30–22');
  });
});
