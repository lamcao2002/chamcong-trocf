import { describe, expect, it } from 'vitest';
import {
  SESSION_POLICY,
  canOpen,
  generateSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from './session-policy';

describe('token phiên', () => {
  it('mỗi lần sinh một token dài 256 bit', () => {
    const token = generateSessionToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(generateSessionToken()).not.toBe(token);
  });

  it('băm ổn định và không chứa token gốc', () => {
    const hash = hashSessionToken('abc');
    expect(hash).toBe(hashSessionToken('abc'));
    expect(hash).not.toContain('abc');
    expect(hash).toHaveLength(64);
  });
});

describe('thời hạn phiên', () => {
  it('quản trị 14 ngày, nhân viên 90 ngày', () => {
    expect(SESSION_POLICY.admin.maxAgeSeconds).toBe(1_209_600);
    expect(SESSION_POLICY.app.maxAgeSeconds).toBe(7_776_000);
  });
});

describe('canOpen', () => {
  it('quyền app không vào được trang quản trị', () => {
    expect(canOpen('admin', 'app')).toBe(false);
    expect(canOpen('admin', 'manager')).toBe(true);
    expect(canOpen('admin', 'hr')).toBe(true);
    expect(canOpen('admin', 'admin')).toBe(true);
  });

  it('mọi quyền đều vào được app nhân viên', () => {
    expect(canOpen('app', 'app')).toBe(true);
    expect(canOpen('app', 'admin')).toBe(true);
  });
});

describe('sessionCookieOptions', () => {
  it('luôn httpOnly và theo thời hạn của loại phiên', () => {
    expect(sessionCookieOptions('admin', true)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 1_209_600,
    });
  });
});
