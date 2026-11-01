import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BASE_URL, api, login, sql } from './helpers';

type Run = { code: number; output: string };

/** Chạy script thật; đặt cả URL trực tiếp để `.env.local` không kéo script ra CSDL khác. */
const run = (args: string[], databaseUrl = process.env.DATABASE_URL!) =>
  new Promise<Run>((resolve) => {
    execFile(
      'npx',
      ['tsx', 'scripts/create-company.ts', ...args],
      {
        env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_DIRECT: databaseUrl, CONFIRM_DB: '' },
      },
      (error, stdout, stderr) => {
        resolve({ code: error ? Number(error.code) : 0, output: stdout + stderr });
      },
    );
  });

const uniqueCode = () => `T${Date.now().toString(36)}`.toUpperCase();
const argsFor = (code: string, email = 'chu@quan.vn') => [
  `--ma=${code}`,
  '--ten=Quán Thử',
  '--admin-ten=Chủ Quán',
  `--admin-email=${email}`,
];

describe('npm run company:create', () => {
  it('tạo được công ty trống dùng được ngay, Quản trị viên đăng nhập bằng PIN vừa in', async () => {
    const code = uniqueCode();
    const created = await run(argsFor(code.toLowerCase(), 'Chu@Quan.vn'));
    expect(created.code).toBe(0);
    const pin = /PIN \(chỉ hiện một lần\): (\d{4})/.exec(created.output)![1]!;

    const cookie = await login('chu@quan.vn', 'admin', code, pin);
    const { company } = (await api('GET', '/company', { cookie })).body;
    expect(company).toMatchObject({ code, name: 'Quán Thử', cutoffLocked: false });

    for (const path of [
      '/employees',
      '/shifts',
      '/positions',
      '/locations',
      '/holidays',
      '/inbox',
      '/overview/today',
      '/timesheet',
      '/payroll',
    ]) {
      expect([path, (await api('GET', path, { cookie })).status]).toEqual([path, 200]);
    }
    for (const path of [
      '',
      '/nhan-su',
      '/xep-ca',
      '/bang-cong',
      '/luong',
      '/vi-tri',
      '/dia-diem',
      '/cai-dat',
    ]) {
      const page = await fetch(`${BASE_URL}/app${path}`, { headers: { cookie }, redirect: 'manual' });
      expect([path, page.status]).toEqual([path, 200]);
    }

    const [audit] = await sql`select l.action, l.actor_id, l.after from audit_logs l
      join companies c on c.id = l.company_id where c.code = ${code} and l.action = 'company.create'`;
    expect(audit).toMatchObject({ actor_id: null });
    expect(JSON.stringify(audit)).not.toContain(pin);
  });

  it('mã đã có thì báo lỗi, không sửa công ty cũ và không in PIN', async () => {
    const code = uniqueCode();
    expect((await run(argsFor(code, 'a@quan.vn'))).code).toBe(0);
    const again = await run(argsFor(code, 'b@quan.vn'));
    expect(again.code).toBe(1);
    expect(again.output).toContain('đã có người dùng');
    expect(again.output).not.toContain('PIN (');
    const rows = await sql`select e.email from employees e join companies c on c.id = e.company_id
      where c.code = ${code}`;
    expect(rows.map(({ email }) => email)).toEqual(['a@quan.vn']);
  });

  it.each([
    ['thiếu tham số', ['--ma=ABCD']],
    ['mã có dấu cách', argsFor('A B')],
    ['mã quá ngắn', argsFor('AB')],
    ['email sai', argsFor('ABCDE', 'khong-phai-email')],
  ])('%s → từ chối', async (_name, args) => {
    const result = await run(args);
    expect(result.code).toBe(1);
    expect(result.output).toContain('Tạo công ty lỗi');
  });

  it('CSDL ngoài máy chưa xác nhận thì dừng trước khi kết nối, không lộ mật khẩu', async () => {
    const result = await run(argsFor(uniqueCode()), 'postgres://u.ref:bi-mat@db.invalid:6543/postgres');
    expect(result.code).toBe(1);
    expect(result.output).toContain('CONFIRM_DB="u.ref@db.invalid/postgres"');
    expect(result.output).not.toContain('bi-mat');
  });
});
