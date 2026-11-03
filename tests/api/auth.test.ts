import { afterAll, describe, expect, it } from 'vitest';
import { COMPANY, PIN, api, auditCount, employeeBody, login, sql } from './helpers';

afterAll(() => sql.end());

const credentials = { companyCode: COMPANY, email: 'ha@phonho.vn', pin: PIN };
const INVALID = 'Thông tin đăng nhập không đúng. Sai 5 lần liên tiếp sẽ bị khoá 15 phút.';

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
});

describe('khoá sau 5 lần sai PIN (US01)', () => {
  type Account = { id: string; email: string; pin: string };

  const newAccount = async (): Promise<Account> => {
    const admin = await login('ha@phonho.vn');
    const body = employeeBody();
    const created = await api('POST', '/employees', { cookie: admin, body });
    expect(created.status).toBe(201);
    return { id: created.body.employee.id, email: body.email, pin: created.body.employee.pin };
  };

  const attempt = ({ email }: Account, pin: string, kind: 'app' | 'admin' = 'app') =>
    api('POST', `/auth/${kind}/login`, { body: { companyCode: COMPANY, email, pin } });
  const fail = async (account: Account, times: number, kind?: 'app' | 'admin') => {
    const wrong = account.pin === '0000' ? '1111' : '0000';
    for (let i = 0; i < times; i += 1) await attempt(account, wrong, kind);
  };
  const lockedUntil = async ({ id }: Account) =>
    (await sql`select locked_until from employees where id = ${id}`)[0]!.locked_until as Date | null;

  it('4 lần sai vẫn vào được, đăng nhập đúng thì đếm lại từ đầu', async () => {
    const account = await newAccount();
    await fail(account, 4);
    expect((await attempt(account, account.pin)).status).toBe(200);
    await fail(account, 4);
    expect((await attempt(account, account.pin)).status).toBe(200);
    expect(await lockedUntil(account)).toBeNull();
  });

  it('lần sai thứ 5 khoá 15 phút, PIN đúng cũng bị từ chối và ghi nhật ký', async () => {
    const account = await newAccount();
    const before = await auditCount('auth.lock');
    await fail(account, 5);
    expect(await auditCount('auth.lock')).toBe(before + 1);

    const minutes = ((await lockedUntil(account))!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThanOrEqual(15);

    const result = await attempt(account, account.pin);
    expect(result.status).toBe(401);
    expect(result.cookies).toHaveLength(0);
  });

  it('phản hồi lúc khoá giống hệt tài khoản không tồn tại, dù PIN đúng hay sai', async () => {
    const account = await newAccount();
    await fail(account, 5);
    const missing = await attempt({ ...account, email: 'khong-co-ai@phonho.vn' }, account.pin);
    const right = await attempt(account, account.pin);
    const wrong = await attempt(account, '0000');
    expect([right.status, right.text]).toEqual([missing.status, missing.text]);
    expect([wrong.status, wrong.text]).toEqual([missing.status, missing.text]);
    expect(right.body.error).toBe(INVALID);
  });

  it('thử tiếp trong lúc khoá không kéo dài thời hạn', async () => {
    const account = await newAccount();
    await fail(account, 5);
    const until = await lockedUntil(account);
    await fail(account, 3);
    await attempt(account, account.pin);
    expect(await lockedUntil(account)).toEqual(until);
  });

  it('hết hạn thì đăng nhập lại được và có đủ 5 lần thử mới', async () => {
    const account = await newAccount();
    await fail(account, 5);
    await sql`update employees set locked_until = now() - interval '1 second' where id = ${account.id}`;
    await fail(account, 4);
    expect((await attempt(account, account.pin)).status).toBe(200);
  });

  it('gửi song song không vượt được giới hạn: đúng một lần khoá', async () => {
    const account = await newAccount();
    const before = await auditCount('auth.lock');
    await Promise.all(Array.from({ length: 20 }, () => attempt(account, '0000')));
    expect(await auditCount('auth.lock')).toBe(before + 1);
    expect(await lockedUntil(account)).not.toBeNull();
  });

  it('khoá chung cho app và quản trị, không ảnh hưởng người khác và phiên đang mở', async () => {
    const account = await newAccount();
    const other = await newAccount();
    const session = await login(account.email, 'app', COMPANY, account.pin);
    await fail(account, 3, 'app');
    await fail(account, 2, 'admin');
    expect(await lockedUntil(account)).not.toBeNull();

    expect((await attempt(other, other.pin)).status).toBe(200);
    expect((await api('GET', '/me?kind=app', { cookie: session })).status).toBe(200);
  });

  it('Đặt lại PIN mở khoá ngay', async () => {
    const account = await newAccount();
    await fail(account, 5);
    const admin = await login('ha@phonho.vn');
    const { pin } = (await api('POST', `/employees/${account.id}/reset-pin`, { cookie: admin })).body;
    expect(await lockedUntil(account)).toBeNull();
    expect((await attempt(account, pin)).status).toBe(200);
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
