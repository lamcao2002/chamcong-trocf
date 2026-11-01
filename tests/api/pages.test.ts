import { afterAll, describe, expect, it } from 'vitest';
import { BASE_URL, login, sql } from './helpers';

const page = (path: string, cookie?: string) =>
  fetch(`${BASE_URL}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });

afterAll(async () => {
  await sql.end();
});

describe('chặn trang theo phiên và quyền (US02)', () => {
  it.each(['/app', '/app/xep-ca', '/app/bang-cong', '/app/nhan-su', '/app/luong'])(
    'chưa đăng nhập vào %s thì về trang đăng nhập',
    async (path) => {
      const response = await page(path);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/app/login');
    },
  );

  it('Quản lý nhóm vào được Xếp ca, Bảng công', async () => {
    const manager = await login('minh@phonho.vn');
    for (const path of ['/app/xep-ca', '/app/bang-cong']) {
      const html = await (await page(path, manager)).text();
      expect(html).not.toContain('NEXT_REDIRECT');
    }
  });

  it('Quản lý nhóm vào trang không có quyền thì bị chuyển về, không có dữ liệu trang', async () => {
    const manager = await login('minh@phonho.vn');
    for (const path of ['/app/luong', '/app/nhan-su', '/app/cai-dat']) {
      const html = await (await page(path, manager)).text();
      expect(html).toContain('NEXT_REDIRECT');
      expect(html).not.toContain('phonho.vn');
    }
  });

  it('nhân viên chưa đăng nhập ở /m thấy form, không thấy màn chấm', async () => {
    const html = await (await page('/m')).text();
    expect(html).toContain('Đăng nhập');
    expect(html).not.toContain('VÀO CA');
  });
});
