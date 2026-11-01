import { describe, expect, it } from 'vitest';
import { assertConfirmedTarget, assertSeedTarget, databaseLabel, isLocalDatabase } from './target';

const LOCAL = 'postgres://postgres:postgres@localhost:5432/chamcong';
const POOLER =
  'postgresql://postgres.abcxyz:b%C3%AD-m%E1%BA%ADt@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const LABEL = 'postgres.abcxyz@aws-0-ap-southeast-1.pooler.supabase.com/postgres';

describe('databaseLabel', () => {
  it('giữ project trên pooler dùng chung host, không lộ mật khẩu', () => {
    expect(databaseLabel(POOLER)).toBe(LABEL);
  });
});

describe('isLocalDatabase', () => {
  it.each([
    [LOCAL, true],
    ['postgres://u:p@127.0.0.1:55432/db', true],
    ['postgres://u:p@[::1]:5432/db', true],
    [POOLER, false],
    ['postgres://u:p@localhost.evil.com/db', false],
  ])('%s', (url, expected) => {
    expect(isLocalDatabase(url)).toBe(expected);
  });
});

describe('assertConfirmedTarget', () => {
  it('máy này không cần xác nhận', () => {
    expect(() => assertConfirmedTarget(LOCAL, undefined)).not.toThrow();
  });

  it('CSDL ngoài phải gõ đúng tên, thông báo không lộ mật khẩu', () => {
    expect(() => assertConfirmedTarget(POOLER, LABEL)).not.toThrow();
    expect(() => assertConfirmedTarget(POOLER, undefined)).toThrow(LABEL);
    expect(() => assertConfirmedTarget(POOLER, 'postgres.khac@host/postgres')).toThrow('CONFIRM_DB');
  });
});

describe('assertSeedTarget', () => {
  it('chặn production kể cả khi đã xác nhận hoặc URL ở máy này', () => {
    expect(() => assertSeedTarget('production', POOLER, LABEL)).toThrow('production');
    expect(() => assertSeedTarget('production', LOCAL, undefined)).toThrow('production');
  });

  it('chặn APP_ENV=local trỏ ra ngoài: đây là đường để PIN mặc định lọt lên CSDL thật', () => {
    expect(() => assertSeedTarget('local', POOLER, LABEL)).toThrow('APP_ENV=local');
  });

  it('staging ngoài máy phải xác nhận, ở máy này thì không', () => {
    expect(() => assertSeedTarget('staging', POOLER, undefined)).toThrow('CONFIRM_DB');
    expect(() => assertSeedTarget('staging', POOLER, LABEL)).not.toThrow();
    expect(() => assertSeedTarget('staging', LOCAL, undefined)).not.toThrow();
    expect(() => assertSeedTarget('local', LOCAL, undefined)).not.toThrow();
  });
});
