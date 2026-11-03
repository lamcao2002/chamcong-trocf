import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { COMPANY, api, auditCount, employeeBody, login, shiftBody, sql } from './helpers';

const HERE = { lat: 21.02452, lng: 105.85308, accuracy: 12 };

let admin: string;
let hr: string;
let positionId: string;
let shiftId: string;

type Person = { id: string; email: string; pin: string; session: string };

const newPerson = async (): Promise<Person> => {
  const body = employeeBody({ positionId, onboardDate: '2026-01-01', shiftIds: [shiftId] });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  await api('PUT', '/schedule', {
    cookie: admin,
    body: { cells: [{ employeeId: id, date: vietnamToday(), shiftIds: [shiftId], isOff: false }] },
  });
  return { id, email: body.email, pin, session: await login(body.email, 'app', COMPANY, pin) };
};

const punch = (person: Person, device?: string, type = 'in', chosen: string | null = shiftId) =>
  api('POST', '/app/punch', {
    cookie: [person.session, device].filter(Boolean).join('; '),
    body: { type, ...HERE, chosenShiftId: chosen },
  });

const deviceOf = ({ cookies }: { cookies: string[] }) =>
  cookies.find((cookie) => cookie.startsWith('cc_device='))?.split(';')[0];

const bound = async (id: string) =>
  (await sql`select device_hash, device_bound_at from employees where id = ${id}`)[0]!;

const logs = async (id: string) =>
  (await sql`select 1 from attendance_logs where employee_id = ${id}`).length;

const setBinding = (deviceBinding: boolean) =>
  api('PATCH', '/company', { cookie: admin, body: { deviceBinding } });

const unlock = (id: string, cookie = hr) => api('POST', `/employees/${id}/unlock-device`, { cookie });

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  hr = await login('quynh@phonho.vn');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find((position: any) => position.name === 'Phục vụ').id;
  const created = await api('POST', '/shifts', {
    cookie: admin,
    body: {
      ...shiftBody(`D${Date.now().toString(36)}`.toUpperCase().slice(0, 12)),
      startTime: '00:00',
      endTime: '23:59',
      breakStart: null,
      breakEnd: null,
      noLateCheck: true,
    },
  });
  shiftId = created.body.shift.id;
});

afterAll(async () => {
  await setBinding(false);
  await sql.end();
});

describe('công ty chưa bật gắn thiết bị', () => {
  it('chấm công như cũ: không cấp cookie, không ghi máy', async () => {
    await setBinding(false);
    const person = await newPerson();
    const result = await punch(person);
    expect(result.status).toBe(201);
    expect(deviceOf(result)).toBeUndefined();
    expect((await bound(person.id)).device_hash).toBeNull();
  });
});

describe('gắn thiết bị (SH-27)', () => {
  beforeAll(() => setBinding(true));

  it('lần chấm đầu gắn máy bằng cookie httpOnly, lưu dạng băm, ghi nhật ký', async () => {
    const person = await newPerson();
    const before = await auditCount('device.bind');
    const result = await punch(person);
    expect(result.status).toBe(201);

    const raw = result.cookies.find((cookie) => cookie.startsWith('cc_device='))!;
    expect(raw).toMatch(/HttpOnly/i);
    const token = raw.split(';')[0]!.slice('cc_device='.length);
    const { device_hash: hash, device_bound_at: at } = await bound(person.id);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(at).toBeTruthy();
    expect(await auditCount('device.bind')).toBe(before + 1);
  });

  it('đúng máy thì chấm tiếp được, kể cả sau khi đăng nhập lại', async () => {
    const person = await newPerson();
    const device = deviceOf(await punch(person));
    expect((await punch(person, device, 'out')).status).toBe(201);

    const again = { ...person, session: await login(person.email, 'app', COMPANY, person.pin) };
    expect((await punch(again, device, 'in')).status).toBe(201);
  });

  it('máy khác đăng nhập được nhưng không chấm được; lần chặn có nhật ký, không có lần chấm', async () => {
    const person = await newPerson();
    await punch(person);
    const count = await logs(person.id);
    const before = await auditCount('device.blocked');

    const other = { ...person, session: await login(person.email, 'app', COMPANY, person.pin) };
    const stranger = await punch(other, 'cc_device=may-khac', 'out');
    expect(stranger.status).toBe(403);
    expect(stranger.body.error).toContain('Mở khoá máy');
    expect((await punch(other, undefined, 'out')).status).toBe(403);

    expect(await logs(person.id)).toBe(count);
    expect(await auditCount('device.blocked')).toBe(before + 2);
  });

  it('chấm lỗi thì không gắn máy, tránh để tài khoản gắn với cookie máy chưa nhận', async () => {
    const person = await newPerson();
    const positions = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
    const wrong = positions.find(({ id }: any) => id !== shiftId).id;
    const result = await punch(person, undefined, 'in', wrong);
    expect(result.status).toBe(400);
    expect((await bound(person.id)).device_hash).toBeNull();
    expect((await punch(person)).status).toBe(201);
  });

  it('một điện thoại không chấm được cho hai tài khoản', async () => {
    const owner = await newPerson();
    const helper = await newPerson();
    const device = deviceOf(await punch(owner));
    const result = await punch(helper, device);
    expect(result.status).toBe(403);
    expect(result.body.error).toContain('tài khoản khác');
    expect((await bound(helper.id)).device_hash).toBeNull();
  });

  it('API không trả mã băm của máy; nhật ký không có mã băm', async () => {
    const person = await newPerson();
    await punch(person);
    const { employee } = (await api('GET', `/employees/${person.id}`, { cookie: admin })).body;
    expect(employee.deviceBoundAt).toBeTruthy();
    expect(employee).not.toHaveProperty('deviceHash');

    await api('PATCH', `/employees/${person.id}`, { cookie: admin, body: { name: 'Đổi tên' } });
    const [log] = await sql`select before from audit_logs
      where action = 'employee.update' and entity_id = ${person.id} order by at desc limit 1`;
    expect(JSON.stringify(log!.before)).not.toMatch(/deviceHash/);
  });

  it('nghỉ việc thì trả lại máy cho người sau dùng', async () => {
    const leaving = await newPerson();
    const device = deviceOf(await punch(leaving));
    await api('PATCH', `/employees/${leaving.id}`, { cookie: admin, body: { status: 'left' } });
    expect((await bound(leaving.id)).device_hash).toBeNull();

    const next = await newPerson();
    expect((await punch(next, device)).status).toBe(201);
  });

  it('tắt tính năng thì máy khác chấm được, bật lại vẫn nhớ máy cũ', async () => {
    const person = await newPerson();
    await punch(person);
    await setBinding(false);
    expect((await punch(person, 'cc_device=may-khac', 'out')).status).toBe(201);
    await setBinding(true);
    expect((await punch(person, 'cc_device=may-khac', 'in')).status).toBe(403);
  });
});

describe('Mở khoá máy (SH-28)', () => {
  beforeAll(() => setBinding(true));

  it('gỡ máy, đăng xuất app, ghi nhật ký; máy mới gắn được', async () => {
    const person = await newPerson();
    await punch(person);
    const before = await auditCount('device.unlock');

    expect((await unlock(person.id)).status).toBe(200);
    expect(await bound(person.id)).toMatchObject({ device_hash: null, device_bound_at: null });
    expect(await auditCount('device.unlock')).toBe(before + 1);
    expect((await api('GET', '/app/home', { cookie: person.session })).status).toBe(401);

    const fresh = { ...person, session: await login(person.email, 'app', COMPANY, person.pin) };
    expect((await punch(fresh, 'cc_device=may-moi', 'out')).status).toBe(201);
  });

  it('chưa gắn máy → 409', async () => {
    expect((await unlock((await newPerson()).id)).status).toBe(409);
  });

  it('Nhân sự không mở khoá được Quản trị viên', async () => {
    const [owner] = await sql`select id from employees where email = 'ha@phonho.vn'`;
    await sql`update employees set device_hash = 'x', device_bound_at = now() where id = ${owner!.id}`;
    expect((await unlock(owner!.id, hr)).status).toBe(403);
    await sql`update employees set device_hash = null, device_bound_at = null where id = ${owner!.id}`;
  });

  it('người ngoài công ty → 404', async () => {
    const [company] = await sql`insert into companies (code, name)
      values (${`K${Date.now()}`}, 'Khác') returning id`;
    const [other] = await sql`insert into employees (company_id, email, name, pin_hash, onboard_date)
      values (${company!.id}, 'x@khac.vn', 'Khác', 'x', '2026-01-01') returning id`;
    expect((await unlock(other!.id, admin)).status).toBe(404);
  });
});
