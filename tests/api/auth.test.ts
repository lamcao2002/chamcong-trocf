import { afterAll, describe, expect, it } from 'vitest';
import { COMPANY, PIN, api, auditCount, login, sql } from './helpers';

afterAll(() => sql.end());

const credentials = { companyCode: COMPANY, email: 'ha@phonho.vn', pin: PIN };
const INVALID = 'Thông tin đăng nhập không đúng';

describe('đăng nhập quản trị (US01)', () => {
  it('đúng thì trả người dùng và cookie httpOnly, không lộ PIN', async () => {
    const before = await auditCount('auth.login');
    const result = await api('POST', '/auth/admin/login', { body: credentials });

    expect(result.status).toBe(200);
    expect(result.body.user.role).toBe('admin');
    expect(result.text).not.toMatch(/pin|argon/i);
    expect(result.cookies[0]).toMatch(/HttpOnly/i);
    expect(result.cookies[0]).toMatch(/SameSite=lax/i);
    expect(result.cookies[0]).toMatch(/Max-Age=1209600/);
    expect(await auditCount('auth.login')).toBe(before + 1);
  });

  it.each([
    ['sai PIN', { ...credentials, pin: '0000' }],
    ['sai email', { ...credentials, email: 'khong-co@phonho.vn' }],
    ['sai mã công ty', { ...credentials, companyCode: 'KHONGCO' }],
    ['PIN sai định dạng', { ...credentials, pin: '12' }],
    ['thiếu trường', { email: 'ha@phonho.vn' }],
  ])('%s: cùng một thông báo, không cookie', async (_name, body) => {
    const result = await api('POST', '/auth/admin/login', { body });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe(INVALID);
    expect(result.cookies).toHaveLength(0);
  });

  it('quyền app không vào được trang quản trị', async () => {
    const result = await api('POST', '/auth/admin/login', {
      body: { ...credentials, email: 'anh@phonho.vn' },
    });
    expect(result.status).toBe(403);
    expect(result.cookies).toHaveLength(0);
  });

  it('không khoá tài khoản sau nhiều lần sai (theo quyết định ở S1-07)', async () => {
    for (let i = 0; i < 6; i += 1) {
      await api('POST', '/auth/admin/login', { body: { ...credentials, pin: '0000' } });
    }
    expect((await api('POST', '/auth/admin/login', { body: credentials })).status).toBe(200);
  });
});

describe('đăng nhập app và phiên (US03, US04)', () => {
  it('nhân viên vào app, phiên 90 ngày', async () => {
    const result = await api('POST', '/auth/app/login', { body: { ...credentials, email: 'anh@phonho.vn' } });
    expect(result.status).toBe(200);
    expect(result.cookies[0]).toMatch(/Max-Age=7776000/);
  });

  it('cookie app không dùng được cho trang quản trị và ngược lại', async () => {
    const app = await login('anh@phonho.vn', 'app');
    const admin = await login('ha@phonho.vn');
    expect((await api('GET', '/me', { cookie: app })).status).toBe(401);
    expect((await api('GET', '/me?kind=app', { cookie: admin })).status).toBe(401);
    expect((await api('GET', '/me?kind=app', { cookie: app })).status).toBe(200);
  });

  it('token app đặt vào cookie quản trị bị từ chối', async () => {
    const app = await login('anh@phonho.vn', 'app');
    const token = app.split('=')[1]!;
    expect((await api('GET', '/me', { cookie: `cc_admin_session=${token}` })).status).toBe(401);
  });

  it('chỉ lưu bản băm của token', async () => {
    const cookie = await login('ha@phonho.vn');
    const token = cookie.split('=')[1]!;
    expect((await sql`select 1 from sessions where token_hash = ${token}`).length).toBe(0);
  });

  it('đăng xuất làm mất hiệu lực cookie cũ và ghi nhật ký', async () => {
    const cookie = await login('ha@phonho.vn');
    const before = await auditCount('auth.logout');
    expect((await api('POST', '/auth/logout', { cookie })).status).toBe(200);
    expect((await api('GET', '/me', { cookie })).status).toBe(401);
    expect(await auditCount('auth.logout')).toBe(before + 1);
    expect((await api('POST', '/auth/logout', { cookie })).status).toBe(200);
  });

  it('phiên hết hạn không dùng được', async () => {
    const cookie = await login('hoa@phonho.vn', 'app');
    await sql`update sessions set expires_at = now() - interval '1 minute'
      where employee_id = (select id from employees where email = 'hoa@phonho.vn')`;
    expect((await api('GET', '/me?kind=app', { cookie })).status).toBe(401);
  });
});
