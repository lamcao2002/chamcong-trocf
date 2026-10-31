import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';

const valid = { companyCode: 'PHONHO', email: 'ha@phonho.vn', pin: '1234' };

describe('loginSchema', () => {
  it('chuẩn hoá mã công ty và email', () => {
    expect(loginSchema.parse({ ...valid, companyCode: ' phonho ', email: ' HA@PhoNho.vn ' })).toEqual(valid);
  });

  it('nhận PIN 4–8 chữ số', () => {
    expect(loginSchema.safeParse({ ...valid, pin: '12345678' }).success).toBe(true);
    expect(loginSchema.safeParse({ ...valid, pin: '123' }).success).toBe(false);
    expect(loginSchema.safeParse({ ...valid, pin: '123456789' }).success).toBe(false);
    expect(loginSchema.safeParse({ ...valid, pin: '12a4' }).success).toBe(false);
  });

  it('từ chối email sai và mã công ty trống', () => {
    expect(loginSchema.safeParse({ ...valid, email: 'ha' }).success).toBe(false);
    expect(loginSchema.safeParse({ ...valid, companyCode: '  ' }).success).toBe(false);
  });
});
