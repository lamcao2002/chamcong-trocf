import { getTableName, isTable, type Table } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';
import {
  SEED_EMPLOYEES,
  SEED_HOLIDAYS,
  SEED_LOCATIONS,
  SEED_POSITION_LOCATIONS,
  SEED_POSITIONS,
  SEED_SHIFTS,
} from './seed-data';

describe('schema', () => {
  it('có đủ 21 bảng của PRD và bảng thông báo', () => {
    const tables = (Object.values(schema).filter(isTable) as Table[]).map(getTableName).sort();
    expect(tables).toEqual(
      [
        'adjustments',
        'approvals',
        'attendance_logs',
        'audit_logs',
        'companies',
        'day_records',
        'employee_locations',
        'employee_shifts',
        'employees',
        'explanations',
        'holidays',
        'locations',
        'notifications',
        'payroll_periods',
        'payslips',
        'position_locations',
        'position_shifts',
        'positions',
        'requests',
        'schedule_cells',
        'sessions',
        'shifts',
      ].sort(),
    );
  });
});

describe('dữ liệu mẫu', () => {
  it('đúng số lượng của Sprint 1', () => {
    expect(SEED_SHIFTS).toHaveLength(6);
    expect(SEED_POSITIONS).toHaveLength(5);
    expect(Object.keys(SEED_LOCATIONS)).toHaveLength(2);
    expect(SEED_EMPLOYEES).toHaveLength(8);
    expect(SEED_HOLIDAYS).toHaveLength(5);
  });

  it('đơn giá vị trí đúng bản tham khảo', () => {
    const payOf = (name: string) => SEED_POSITIONS.find((position) => position.name === name)?.payAmount;
    expect(payOf('Quản lý ca')).toBe(10_000_000);
    expect(payOf('Thu ngân')).toBe(7_000_000);
    expect(payOf('Pha chế')).toBe(28_000);
    expect(payOf('Phục vụ')).toBe(25_000);
    expect(payOf('Tạp vụ')).toBe(60_000);
  });

  it('mọi tham chiếu đều trỏ tới bản ghi có thật', () => {
    const shiftCodes = SEED_SHIFTS.map((shift) => shift.code);
    const positionNames = SEED_POSITIONS.map((position) => position.name);
    const emails = SEED_EMPLOYEES.map((employee) => employee.email);
    const locationKeys = Object.keys(SEED_LOCATIONS);

    expect(new Set(emails).size).toBe(emails.length);
    expect(SEED_POSITIONS.flatMap((position) => position.shifts)).toEqual(expect.arrayContaining(shiftCodes));
    for (const position of SEED_POSITIONS)
      expect(shiftCodes).toEqual(expect.arrayContaining(position.shifts));
    expect(locationKeys).toEqual(expect.arrayContaining(SEED_POSITION_LOCATIONS));
    for (const employee of SEED_EMPLOYEES) {
      expect(employee.email).toBe(employee.email.toLowerCase());
      expect(positionNames).toContain(employee.position);
      if (employee.manager) expect(emails).toContain(employee.manager);
      expect(locationKeys).toEqual(expect.arrayContaining(employee.locations ?? []));
    }
  });

  it('vị trí cố định có đúng một ca', () => {
    for (const position of SEED_POSITIONS.filter(({ shiftMode }) => shiftMode === 'fixed')) {
      expect(position.shifts).toHaveLength(1);
    }
  });
});
