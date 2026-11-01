import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { dayRecords, employees } from '@/lib/db/schema';
import {
  canAssignRole,
  canEditEmployee,
  canManage,
  canSeePay,
  hasRole,
  scopeToCompany,
  scopeToStaff,
  type AuthContext,
} from './policy';
import { HR_UP, MANAGERS } from './roles';
import type { Role } from './roles';

const ctx = (role: Role): AuthContext => ({
  kind: 'admin',
  employee: { id: 'me', name: 'Tôi', email: 'me@x.vn', role },
  company: { id: 'co', code: 'X', name: 'X', appName: null, brandColor: null },
});
const render = (query: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(query);

describe('nhóm quyền', () => {
  it('Nhân sự+ gồm hr và admin; QL có thêm manager; app không thuộc nhóm nào', () => {
    expect(hasRole('hr', HR_UP)).toBe(true);
    expect(hasRole('manager', HR_UP)).toBe(false);
    expect(hasRole('manager', MANAGERS)).toBe(true);
    expect(hasRole('app', MANAGERS)).toBe(false);
  });
});

describe('canSeePay', () => {
  it('Quản lý nhóm và nhân viên không thấy số tiền', () => {
    expect(canSeePay('admin')).toBe(true);
    expect(canSeePay('hr')).toBe(true);
    expect(canSeePay('manager')).toBe(false);
    expect(canSeePay('app')).toBe(false);
  });
});

describe('canManage', () => {
  it('Quản lý nhóm chỉ quản lý người báo cáo trực tiếp', () => {
    const manager = { id: 'me', role: 'manager' as const };
    expect(canManage(manager, { managerId: 'me' })).toBe(true);
    expect(canManage(manager, { managerId: 'khac' })).toBe(false);
    expect(canManage(manager, { managerId: null })).toBe(false);
  });

  it('Nhân sự và Quản trị viên quản lý cả công ty', () => {
    expect(canManage({ id: 'me', role: 'hr' }, { managerId: 'khac' })).toBe(true);
    expect(canManage({ id: 'me', role: 'admin' }, { managerId: null })).toBe(true);
  });
});

describe('canEditEmployee', () => {
  it('Nhân sự không sửa được Quản trị viên', () => {
    const hr = { id: 'me', role: 'hr' as const };
    expect(canEditEmployee(hr, { role: 'admin' })).toBe(false);
    expect(canEditEmployee(hr, { role: 'hr' })).toBe(true);
    expect(canEditEmployee(hr, { role: 'app' })).toBe(true);
  });

  it('Quản trị viên sửa được mọi người, Quản lý nhóm không sửa được ai', () => {
    expect(canEditEmployee({ id: 'me', role: 'admin' }, { role: 'admin' })).toBe(true);
    expect(canEditEmployee({ id: 'me', role: 'manager' }, { role: 'app' })).toBe(false);
  });
});

describe('canAssignRole', () => {
  it('Nhân sự không tự nâng ai lên Quản trị viên', () => {
    expect(canAssignRole('hr', 'admin')).toBe(false);
    expect(canAssignRole('hr', 'manager')).toBe(true);
    expect(canAssignRole('admin', 'admin')).toBe(true);
    expect(canAssignRole('manager', 'app')).toBe(false);
  });
});

describe('điều kiện truy vấn', () => {
  it('luôn lọc company_id', () => {
    const query = render(scopeToCompany(ctx('admin'), employees.companyId));
    expect(query.sql).toContain('"company_id" = $1');
    expect(query.params).toEqual(['co']);
  });

  it('Nhân sự thấy cả công ty, không thêm điều kiện người quản lý', () => {
    const query = render(
      scopeToStaff(ctx('hr'), { companyId: dayRecords.companyId, employeeId: dayRecords.employeeId }),
    );
    expect(query.sql).not.toContain('manager_id');
    expect(query.params).toEqual(['co']);
  });

  it('Quản lý nhóm bị giới hạn theo manager_id, vẫn giữ company_id', () => {
    const query = render(
      scopeToStaff(ctx('manager'), { companyId: dayRecords.companyId, employeeId: dayRecords.employeeId }),
    );
    expect(query.sql).toContain('"manager_id"');
    expect(query.sql).toContain('"company_id"');
    expect(query.params).toEqual(['co', 'me']);
  });
});
