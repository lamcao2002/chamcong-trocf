import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { COMPANY, api, auditCount, employeeBody, login, sql } from './helpers';

let cookie: string;
let hr: string;
let positionId: string;
let shiftId: string;
let locationId: string;
let adminId: string;

beforeAll(async () => {
  cookie = await login('ha@phonho.vn');
  hr = await login('quynh@phonho.vn');
  const positions = await api('GET', '/positions', { cookie });
  positionId = positions.body.positions.find((position: any) => position.name === 'Phục vụ').id;
  shiftId = (await api('GET', '/shifts', { cookie })).body.shifts[0].id;
  locationId = (await api('GET', '/locations', { cookie })).body.locations[0].id;
  adminId = (await api('GET', '/me', { cookie })).body.user.id;
});

afterAll(() => sql.end());

const create = async (overrides: object = {}) => {
  const body = employeeBody(overrides);
  const result = await api('POST', '/employees', { cookie, body });
  expect(result.status).toBe(201);
  return {
    id: result.body.employee.id as string,
    pin: result.body.employee.pin as string,
    email: body.email,
  };
};

describe('thêm nhân viên (US11)', () => {
  it('PIN tự sinh 4 số, đăng nhập được, ghi nhật ký không chứa PIN', async () => {
    const before = await auditCount('employee.create');
    const { pin, email, id } = await create();

    expect(pin).toMatch(/^\d{4}$/);
    await expect(login(email, 'app', COMPANY, pin)).resolves.toContain('cc_app_session=');
    expect(await auditCount('employee.create')).toBe(before + 1);

    const [log] = await sql`select after from audit_logs where entity_id = ${id}`;
    expect(JSON.stringify(log!.after)).not.toMatch(/pin/i);
  });

  it('chỉ lưu PIN dạng băm', async () => {
    const { id, pin } = await create();
    const [row] = await sql`select pin_hash from employees where id = ${id}`;
    expect(row!.pin_hash).toMatch(/^\$argon2id\$/);
    expect(row!.pin_hash).not.toContain(pin);
  });

  it('không API đọc nào trả PIN', async () => {
    const { id } = await create();
    const list = await api('GET', '/employees', { cookie });
    const detail = await api('GET', `/employees/${id}`, { cookie });
    expect(list.text).not.toMatch(/pin|argon/i);
    expect(detail.text).not.toMatch(/pin|argon/i);
  });

  it('email viết hoa được chuẩn hoá; trùng email → 409 ở trường email', async () => {
    const { email } = await create();
    const result = await api('POST', '/employees', {
      cookie,
      body: employeeBody({ email: email.toUpperCase() }),
    });
    expect(result.status).toBe(409);
    expect(result.body.fields.email).toBeTruthy();
  });

  it.each([
    ['thiếu họ tên', { name: '  ' }, 'name'],
    ['email sai', { email: 'khong-phai-email' }, 'email'],
    ['ngày vào làm sai', { onboardDate: '31/12/2026' }, 'onboardDate'],
    ['quyền lạ', { role: 'owner' }, 'role'],
    ['bật ca riêng mà không chọn', { shiftIds: [] }, 'shiftIds'],
    ['bật địa điểm riêng mà không chọn', { locationIds: [] }, 'locationIds'],
    ['lương riêng bằng 0', { payOverride: { payAmount: 0 } }, 'payOverride.payAmount'],
  ])('%s → 400 đúng trường', async (_name, change, field) => {
    const result = await api('POST', '/employees', { cookie, body: employeeBody(change) });
    expect(result.status).toBe(400);
    expect(result.body.fields[field]).toBeTruthy();
  });
});

describe('sửa hồ sơ và ghi đè (US12)', () => {
  it('bật rồi tắt 3 công tắc riêng', async () => {
    const { id } = await create({ positionId });
    const on = await api('PATCH', `/employees/${id}`, {
      cookie,
      body: { payOverride: { payAmount: 27000 }, shiftIds: [shiftId], locationIds: [locationId] },
    });
    expect(on.body.employee).toMatchObject({
      payOverride: { payAmount: 27000 },
      shiftIds: [shiftId],
      locationIds: [locationId],
    });

    const off = await api('PATCH', `/employees/${id}`, {
      cookie,
      body: { payOverride: null, shiftIds: null, locationIds: null },
    });
    expect(off.body.employee).toMatchObject({
      payOverride: null,
      shiftIds: null,
      locationIds: null,
      positionId,
    });
  });

  it('chỉ đổi trường gửi lên, giữ ghi đè', async () => {
    const { id } = await create({ shiftIds: [shiftId] });
    const result = await api('PATCH', `/employees/${id}`, { cookie, body: { name: 'Tên mới' } });
    expect(result.body.employee).toMatchObject({ name: 'Tên mới', shiftIds: [shiftId] });
  });

  it('đặt lại PIN: trả một lần, PIN cũ hết tác dụng, đăng xuất mọi máy', async () => {
    const { id, pin, email } = await create();
    const session = await login(email, 'app', COMPANY, pin);
    const before = await auditCount('employee.reset_pin');

    const result = await api('POST', `/employees/${id}/reset-pin`, { cookie });
    expect(result.body.pin).toMatch(/^\d{4}$/);
    expect(await auditCount('employee.reset_pin')).toBe(before + 1);

    expect((await api('GET', '/me?kind=app', { cookie: session })).status).toBe(401);
    if (result.body.pin !== pin) {
      await expect(login(email, 'app', COMPANY, pin)).rejects.toThrow();
    }
    await expect(login(email, 'app', COMPANY, result.body.pin)).resolves.toBeTruthy();
  });

  it('không tự quản lý mình', async () => {
    const { id } = await create();
    const result = await api('PATCH', `/employees/${id}`, { cookie, body: { managerId: id } });
    expect(result.status).toBe(400);
  });

  it('không tự đổi quyền, không tự chuyển Đã nghỉ', async () => {
    expect((await api('PATCH', `/employees/${adminId}`, { cookie, body: { role: 'app' } })).status).toBe(409);
    expect((await api('PATCH', `/employees/${adminId}`, { cookie, body: { status: 'left' } })).status).toBe(
      409,
    );
  });

  it('Nhân sự sửa được nhân viên thường', async () => {
    const { id } = await create();
    const result = await api('PATCH', `/employees/${id}`, { cookie: hr, body: { name: 'Nhân sự sửa' } });
    expect(result.status).toBe(200);
  });
});

describe('lọc danh sách (S1-17)', () => {
  it('theo trạng thái và vị trí', async () => {
    const left = await create({ positionId });
    await api('PATCH', `/employees/${left.id}`, { cookie, body: { status: 'left' } });

    const active = await api('GET', '/employees?status=active', { cookie });
    const gone = await api('GET', '/employees?status=left', { cookie });
    expect(active.body.employees.some((employee: any) => employee.id === left.id)).toBe(false);
    expect(gone.body.employees.some((employee: any) => employee.id === left.id)).toBe(true);

    const byPosition = await api('GET', `/employees?positionId=${positionId}`, { cookie });
    expect(byPosition.body.employees.every((employee: any) => employee.positionId === positionId)).toBe(true);
  });

  it('bộ lọc sai → 400', async () => {
    expect((await api('GET', '/employees?status=abc', { cookie })).status).toBe(400);
    expect((await api('GET', '/employees?positionId=abc', { cookie })).status).toBe(400);
  });
});

describe('Đã nghỉ (US13)', () => {
  it('đá khỏi phiên đang mở, không đăng nhập lại được, kích hoạt lại được', async () => {
    const { id, email, pin } = await create();
    const session = await login(email, 'app', COMPANY, pin);

    await api('PATCH', `/employees/${id}`, { cookie, body: { status: 'left' } });
    expect((await api('GET', '/me?kind=app', { cookie: session })).status).toBe(401);
    await expect(login(email, 'app', COMPANY, pin)).rejects.toThrow();
    expect((await sql`select 1 from sessions where employee_id = ${id}`).length).toBe(0);

    await api('PATCH', `/employees/${id}`, { cookie, body: { status: 'active' } });
    await expect(login(email, 'app', COMPANY, pin)).resolves.toBeTruthy();
  });

  it('ghi ngày nghỉ, PATCH lặp lại không đổi ngày, kích hoạt lại thì xoá', async () => {
    const { id } = await create();
    const leftDate = async () => (await api('GET', `/employees/${id}`, { cookie })).body.employee.leftDate;

    await api('PATCH', `/employees/${id}`, { cookie, body: { status: 'left' } });
    expect(await leftDate()).toBe(vietnamToday());

    await sql`update employees set left_date = '2026-01-15' where id = ${id}`;
    await api('PATCH', `/employees/${id}`, { cookie, body: { status: 'left', name: 'Đổi tên' } });
    expect(await leftDate()).toBe('2026-01-15');

    await api('PATCH', `/employees/${id}`, { cookie, body: { status: 'active' } });
    expect(await leftDate()).toBeNull();
  });
});

describe('thêm hàng loạt (STF-10)', () => {
  const person = (positionId: string | null = null) => {
    const { name, email } = employeeBody({ name: 'Người lô' });
    return { name, email, positionId };
  };
  const bulk = (employees: unknown[]) => api('POST', '/employees/bulk', { cookie, body: { employees } });

  it('tạo cả lô, ai cũng đăng nhập được bằng PIN riêng, một dòng nhật ký không có PIN', async () => {
    const before = await auditCount('employee.bulk_create');
    const rows = [person(), person()];
    const result = await bulk(rows);
    expect(result.status).toBe(201);
    expect(await auditCount('employee.bulk_create')).toBe(before + 1);

    for (const { email, pin } of result.body.employees) {
      await expect(login(email, 'app', COMPANY, pin)).resolves.toBeTruthy();
    }
    const [row] = await sql`select after from audit_logs
      where action = 'employee.bulk_create' order by at desc limit 1`;
    expect(row!.after.count).toBe(2);
    expect(JSON.stringify(row!.after)).not.toMatch(/pin/i);
  });

  it('một email đã có thì không tạo ai trong lô', async () => {
    const fresh = person();
    const result = await bulk([fresh, { ...person(), email: 'ha@phonho.vn' }]);
    expect(result.status).toBe(409);
    expect(result.body.error).toContain('ha@phonho.vn');
    expect(await sql`select 1 from employees where email = ${fresh.email}`).toHaveLength(0);
  });

  it('email trùng trong lô, lô rỗng, quá 100 người → 400', async () => {
    const one = person();
    expect((await bulk([one, { ...one, name: 'Khác' }])).status).toBe(400);
    expect((await bulk([])).status).toBe(400);
    expect((await bulk(Array.from({ length: 101 }, () => person()))).status).toBe(400);
  });
});
