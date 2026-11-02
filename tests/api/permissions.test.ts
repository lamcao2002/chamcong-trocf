import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, employeeBody, locationBody, login, positionBody, shiftBody, sql } from './helpers';

const NIL = '00000000-0000-0000-0000-000000000000';

type Role = 'none' | 'manager' | 'hr' | 'admin';

/** Bảng API của PRD: ai được gọi. Thêm endpoint mới thì thêm dòng ở đây. */
const MATRIX: { method: string; path: string; allowed: Role[]; body?: unknown }[] = [
  { method: 'GET', path: '/me', allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/company', allowed: ['admin'] },
  { method: 'PATCH', path: '/company', allowed: ['admin'], body: {} },
  { method: 'GET', path: '/shifts', allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/shifts', allowed: ['hr', 'admin'], body: {} },
  { method: 'PATCH', path: `/shifts/${NIL}`, allowed: ['hr', 'admin'], body: {} },
  { method: 'DELETE', path: `/shifts/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'GET', path: '/positions', allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/positions', allowed: ['hr', 'admin'], body: {} },
  { method: 'PATCH', path: `/positions/${NIL}`, allowed: ['hr', 'admin'], body: {} },
  { method: 'DELETE', path: `/positions/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'GET', path: '/locations', allowed: ['admin'] },
  { method: 'POST', path: '/locations', allowed: ['admin'], body: {} },
  { method: 'PATCH', path: `/locations/${NIL}`, allowed: ['admin'], body: {} },
  { method: 'DELETE', path: `/locations/${NIL}`, allowed: ['admin'] },
  { method: 'GET', path: '/holidays', allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/holidays', allowed: ['hr', 'admin'], body: {} },
  { method: 'DELETE', path: `/holidays/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/holidays/seed-vn', allowed: ['hr', 'admin'] },
  { method: 'GET', path: '/employees', allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/employees', allowed: ['hr', 'admin'], body: {} },
  { method: 'POST', path: '/employees/bulk', allowed: ['hr', 'admin'], body: {} },
  { method: 'GET', path: `/employees/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'PATCH', path: `/employees/${NIL}`, allowed: ['hr', 'admin'], body: {} },
  { method: 'POST', path: `/employees/${NIL}/reset-pin`, allowed: ['hr', 'admin'] },
  { method: 'GET', path: '/schedule?week=2026-11-02', allowed: ['manager', 'hr', 'admin'] },
  { method: 'PUT', path: '/schedule', allowed: ['manager', 'hr', 'admin'], body: {} },
  { method: 'GET', path: `/day/${NIL}/2026-11-02`, allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/inbox', allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/timesheet', allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/timesheet/export', allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/payroll', allowed: ['hr', 'admin'] },
  { method: 'GET', path: '/payroll/export', allowed: ['hr', 'admin'] },
  { method: 'GET', path: `/payroll/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/payroll/publish?period=2099-01', allowed: ['hr', 'admin'] },
  { method: 'POST', path: '/adjustments', allowed: ['hr', 'admin'], body: {} },
  { method: 'DELETE', path: `/adjustments/${NIL}`, allowed: ['hr', 'admin'] },
  { method: 'GET', path: `/timesheet/${NIL}`, allowed: ['manager', 'hr', 'admin'] },
  { method: 'GET', path: '/overview/today', allowed: ['manager', 'hr', 'admin'] },
  { method: 'POST', path: '/approvals', allowed: ['manager', 'hr', 'admin'], body: {} },
  { method: 'POST', path: '/approvals/bulk', allowed: ['manager', 'hr', 'admin'], body: {} },
  { method: 'DELETE', path: `/approvals/${NIL}`, allowed: ['manager', 'hr', 'admin'] },
  { method: 'POST', path: `/requests/${NIL}/decide`, allowed: ['manager', 'hr', 'admin'], body: {} },
];

let cookies: Record<Exclude<Role, 'none'>, string>;
let otherAdmin: string;
let otherCompanyId: string;
let foreign: { shift: string; location: string; position: string; employee: string; holiday: string };
let own: { shift: string; location: string };

beforeAll(async () => {
  cookies = {
    admin: await login('ha@phonho.vn'),
    hr: await login('quynh@phonho.vn'),
    manager: await login('minh@phonho.vn'),
  };

  // Công ty thứ hai để thử rò rỉ dữ liệu; dùng lại pin_hash để đăng nhập được
  const [{ pin_hash: pinHash }] =
    (await sql`select pin_hash from employees where email = 'ha@phonho.vn'`) as any;
  const code = `KHAC${Date.now().toString(36).toUpperCase()}`;
  const [company] = await sql`insert into companies (code, name) values (${code}, 'Quán khác') returning id`;
  otherCompanyId = company!.id;
  const [boss] = await sql`insert into employees (company_id, email, name, pin_hash, onboard_date, role)
    values (${otherCompanyId}, 'boss@khac.vn', 'Chủ khác', ${pinHash}, '2026-01-01', 'admin') returning id`;
  otherAdmin = await login('boss@khac.vn', 'admin', code);

  const created = await api('POST', '/shifts', { cookie: otherAdmin, body: shiftBody() });
  const location = await api('POST', '/locations', { cookie: otherAdmin, body: locationBody() });
  const position = await api('POST', '/positions', {
    cookie: otherAdmin,
    body: positionBody(created.body.shift.id, location.body.location.id),
  });
  const holiday = await api('POST', '/holidays', {
    cookie: otherAdmin,
    body: { date: '2026-12-25', name: 'Lễ khác' },
  });
  foreign = {
    shift: created.body.shift.id,
    location: location.body.location.id,
    position: position.body.position.id,
    employee: boss!.id,
    holiday: holiday.body.holiday.id,
  };

  const [shift] = await sql`select s.id from shifts s join companies c on c.id = s.company_id
    where c.code = 'PHONHO' and s.code = 'CA1'`;
  const [place] = await sql`select l.id from locations l join companies c on c.id = l.company_id
    where c.code = 'PHONHO' limit 1`;
  own = { shift: shift!.id, location: place!.id };
});

afterAll(() => sql.end());

describe('ma trận quyền (US02)', () => {
  it.each(MATRIX)('$method $path', async ({ method, path, allowed, body }) => {
    expect((await api(method, path, { body })).status).toBe(401);

    for (const role of ['manager', 'hr', 'admin'] as const) {
      const { status } = await api(method, path, { cookie: cookies[role], body });
      expect(status, `${role} không được gây lỗi server`).toBeLessThan(500);
      if (allowed.includes(role)) {
        expect([401, 403], `${role} phải được gọi`).not.toContain(status);
      } else {
        expect(status, `${role} phải bị chặn`).toBe(403);
      }
    }
  });
});

describe('Nhân sự không sửa được Quản trị viên (US02)', () => {
  const adminId = async () =>
    (await sql`select id from employees where email = 'ha@phonho.vn'`)[0]!.id as string;

  it('không sửa hồ sơ', async () => {
    const result = await api('PATCH', `/employees/${await adminId()}`, {
      cookie: cookies.hr,
      body: { name: 'Bị đổi tên' },
    });
    expect(result.status).toBe(403);
  });

  it('không đặt lại PIN', async () => {
    const result = await api('POST', `/employees/${await adminId()}/reset-pin`, { cookie: cookies.hr });
    expect(result.status).toBe(403);
    expect(result.text).not.toContain('"pin"');
  });

  it('không tạo Quản trị viên mới', async () => {
    const result = await api('POST', '/employees', {
      cookie: cookies.hr,
      body: employeeBody({ role: 'admin' }),
    });
    expect(result.status).toBe(403);
  });

  it('không nâng người khác lên Quản trị viên', async () => {
    const created = await api('POST', '/employees', { cookie: cookies.hr, body: employeeBody() });
    const result = await api('PATCH', `/employees/${created.body.employee.id}`, {
      cookie: cookies.hr,
      body: { role: 'admin' },
    });
    expect(result.status).toBe(403);
  });
});

describe('cách ly công ty', () => {
  it('danh sách chỉ có dữ liệu công ty mình', async () => {
    const shifts = await api('GET', '/shifts', { cookie: cookies.admin });
    expect(shifts.body.shifts.some((shift: any) => shift.id === foreign.shift)).toBe(false);
    const employees = await api('GET', '/employees', { cookie: cookies.admin });
    expect(employees.body.employees.some((employee: any) => employee.email === 'boss@khac.vn')).toBe(false);
  });

  const CROSS_TENANT: [string, 'shift' | 'position' | 'location' | 'holiday', string][] = [
    ['PATCH', 'shift', '/shifts'],
    ['DELETE', 'shift', '/shifts'],
    ['DELETE', 'position', '/positions'],
    ['DELETE', 'location', '/locations'],
    ['DELETE', 'holiday', '/holidays'],
  ];

  it.each(CROSS_TENANT)('%s %s của công ty khác → 404', async (method, kind, base) => {
    const body = method === 'PATCH' ? shiftBody() : undefined;
    const { status } = await api(method, `${base}/${foreign[kind]}`, { cookie: cookies.admin, body });
    expect(status).toBe(404);
  });

  it('không đọc, sửa, đặt lại PIN nhân viên công ty khác', async () => {
    const path = `/employees/${foreign.employee}`;
    expect((await api('GET', path, { cookie: cookies.admin })).status).toBe(404);
    expect((await api('PATCH', path, { cookie: cookies.admin, body: { name: 'x' } })).status).toBe(404);
    expect((await api('POST', `${path}/reset-pin`, { cookie: cookies.admin })).status).toBe(404);
  });

  it('không gắn ca, địa điểm, vị trí của công ty khác', async () => {
    const position = await api('POST', '/positions', {
      cookie: cookies.admin,
      body: positionBody(foreign.shift, own.location),
    });
    expect(position.status).toBe(400);
    expect(position.body.fields.shiftIds).toBeTruthy();

    const place = await api('POST', '/positions', {
      cookie: cookies.admin,
      body: positionBody(own.shift, foreign.location),
    });
    expect(place.status).toBe(400);

    const location = await api('POST', '/locations', {
      cookie: cookies.admin,
      body: locationBody([foreign.position]),
    });
    expect(location.status).toBe(400);

    const employee = await api('POST', '/employees', {
      cookie: cookies.admin,
      body: employeeBody({ positionId: foreign.position }),
    });
    expect(employee.status).toBe(400);

    const bulk = await api('POST', '/employees/bulk', {
      cookie: cookies.admin,
      body: { employees: [{ ...employeeBody(), positionId: foreign.position }] },
    });
    expect(bulk.status).toBe(400);

    const manager = await api('POST', '/employees', {
      cookie: cookies.admin,
      body: employeeBody({ managerId: foreign.employee }),
    });
    expect(manager.status).toBe(400);
  });
});
