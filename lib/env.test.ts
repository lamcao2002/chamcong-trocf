import { describe, expect, it } from 'vitest';
import { migrationUrl, parseServerEnv } from './env';

const LOCAL = 'postgres://postgres:postgres@localhost:5432/chamcong';

describe('parseServerEnv', () => {
  it('nhận cấu hình tối thiểu và điền mặc định', () => {
    const env = parseServerEnv({ DATABASE_URL: LOCAL });
    expect(env.APP_ENV).toBe('local');
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.NODE_ENV).toBe('development');
  });

  it('coi chuỗi rỗng là chưa đặt', () => {
    const env = parseServerEnv({ DATABASE_URL: LOCAL, DATABASE_URL_DIRECT: '', APP_TIMEZONE: '' });
    expect(env.DATABASE_URL_DIRECT).toBeUndefined();
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('báo lỗi khi thiếu DATABASE_URL', () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it('báo lỗi khi DATABASE_URL không phải PostgreSQL', () => {
    expect(() => parseServerEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/PostgreSQL/);
  });
});

describe('migrationUrl', () => {
  it('ưu tiên kết nối trực tiếp', () => {
    const env = parseServerEnv({
      DATABASE_URL: 'postgres://u:p@pooler.example.com:6543/postgres',
      DATABASE_URL_DIRECT: 'postgres://u:p@db.example.com:5432/postgres',
    });
    expect(migrationUrl(env)).toContain(':5432/');
  });

  it('dùng DATABASE_URL khi không có kết nối trực tiếp', () => {
    expect(migrationUrl(parseServerEnv({ DATABASE_URL: LOCAL }))).toBe(LOCAL);
  });
});
