import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, activeNavKey, initials, navForRole } from './admin';

describe('navForRole', () => {
  const keys = (role: Parameters<typeof navForRole>[0]) => navForRole(role).map((item) => item.key);

  it('quản trị viên thấy đủ 8 mục', () => {
    expect(keys('admin')).toEqual(ADMIN_NAV.map((item) => item.key));
  });

  it('nhân sự không thấy Địa điểm và Cài đặt', () => {
    expect(keys('hr')).toEqual(['inbox', 'timesheet', 'schedule', 'payroll', 'staff', 'positions']);
  });

  it('quản lý nhóm không thấy Lương và phần Thiết lập', () => {
    expect(keys('manager')).toEqual(['inbox', 'timesheet', 'schedule']);
  });

  it('nhân viên không có mục quản trị nào', () => {
    expect(keys('app')).toEqual([]);
  });
});

describe('activeNavKey', () => {
  it('trang chủ chỉ khớp đúng /app', () => {
    expect(activeNavKey('/app')).toBe('inbox');
    expect(activeNavKey('/app/')).toBe('inbox');
    expect(activeNavKey('/app/khong-co')).toBeUndefined();
  });

  it('khớp cả trang con nhưng không khớp tiền tố giả', () => {
    expect(activeNavKey('/app/nhan-su')).toBe('staff');
    expect(activeNavKey('/app/nhan-su/123')).toBe('staff');
    expect(activeNavKey('/app/nhan-su-cu')).toBeUndefined();
  });
});

describe('initials', () => {
  it('lấy hai từ cuối của họ tên', () => {
    expect(initials('Nguyễn Thu Hà')).toBe('TH');
    expect(initials('Trần Đức Minh')).toBe('ĐM');
    expect(initials('  Hà ')).toBe('H');
  });
});
