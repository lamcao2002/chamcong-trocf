import { describe, expect, it } from 'vitest';
import { editableUntil, registrationWindow } from './request-window';

/** Giờ Việt Nam: 2026-11-05 là Thứ Năm. */
const at = (local: string) => new Date(`${local}+07:00`);

describe('đợt đăng ký ca', () => {
  it.each([
    ['Thứ Năm 06:59 còn đóng', '2026-11-05T06:59:00', false, '2026-11-09'],
    ['Thứ Năm 07:00 mở', '2026-11-05T07:00:00', true, '2026-11-09'],
    ['Thứ Sáu tối vẫn mở', '2026-11-06T22:00:00', true, '2026-11-09'],
    ['Thứ Bảy 06:59 vẫn mở', '2026-11-07T06:59:00', true, '2026-11-09'],
    ['Thứ Bảy 07:00 đóng, chờ đợt tuần sau', '2026-11-07T07:00:00', false, '2026-11-16'],
    ['Thứ Hai đóng, đợt Thứ Năm này', '2026-11-02T10:00:00', false, '2026-11-09'],
    ['Chủ nhật đóng', '2026-11-08T12:00:00', false, '2026-11-16'],
  ])('%s', (_name, local, open, week) => {
    const window = registrationWindow(at(local));
    expect(window.open).toBe(open);
    expect(window.week).toBe(week);
  });

  it('giờ mở và đóng là 07:00 giờ Việt Nam', () => {
    const window = registrationWindow(at('2026-11-02T10:00:00'));
    expect(window.opensAt.toISOString()).toBe('2026-11-05T00:00:00.000Z');
    expect(window.closesAt.toISOString()).toBe('2026-11-07T00:00:00.000Z');
  });
});

describe('hạn sửa, xoá đơn', () => {
  const sent = at('2026-11-03T09:00:00');
  const leave = { type: 'leave', status: 'pending', fromDate: '2026-11-10', createdAt: sent };

  it('trong 10 phút từ lúc gửi', () => {
    expect(editableUntil(leave, at('2026-11-03T09:09:59'))?.toISOString()).toBe('2026-11-03T02:10:00.000Z');
    expect(editableUntil(leave, at('2026-11-03T09:10:00'))).toBeNull();
  });

  it('đơn đã quyết định thì khoá ngay', () => {
    expect(editableUntil({ ...leave, status: 'approved' }, at('2026-11-03T09:01:00'))).toBeNull();
    expect(editableUntil({ ...leave, status: 'rejected' }, at('2026-11-03T09:01:00'))).toBeNull();
  });

  it('đăng ký ca theo đợt mở, không theo 10 phút', () => {
    const register = {
      ...leave,
      type: 'shift_register',
      fromDate: '2026-11-11',
      createdAt: at('2026-11-05T08:00:00'),
    };
    expect(editableUntil(register, at('2026-11-06T20:00:00'))?.toISOString()).toBe(
      '2026-11-07T00:00:00.000Z',
    );
    expect(editableUntil(register, at('2026-11-07T07:00:00'))).toBeNull();
    expect(editableUntil({ ...register, fromDate: '2026-11-18' }, at('2026-11-06T20:00:00'))).toBeNull();
  });
});
