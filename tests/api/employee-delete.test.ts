import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, sql } from './helpers';

let admin: string;
let hr: string;
let manager: string;
let positionId: string;
let toi: string;
let yesterday: string;

type Person = { id: string; email: string; session: string };

const newPerson = async (overrides: object = {}): Promise<Person> => {
  const body = employeeBody({ positionId, onboardDate: '2026-01-01', ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  const kind = (overrides as { role?: string }).role ? 'admin' : 'app';
  return { id, email: body.email, session: await login(body.email, kind, COMPANY, pin) };
};

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string, inZone = true) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, ${inZone} from employees where id = ${employeeId}`;

/** Ca tối hôm qua, vào ngoài vùng: có ngày công, có việc để duyệt. */
const workedYesterday = async (person: Person) => {
  await punch(person.id, yesterday, 'in', '17:00', false);
  await punch(person.id, yesterday, 'out', '22:00');
  await api('PUT', '/schedule', {
    cookie: admin,
    body: { cells: [{ employeeId: person.id, date: yesterday, shiftIds: [toi], isOff: false }] },
  });
};

const remove = (person: Person, cookie = admin, email = person.email) =>
  api('DELETE', `/employees/${person.id}`, { cookie, body: { email } });

const TABLES = [
  'attendance_logs',
  'day_records',
  'requests',
  'explanations',
  'approvals',
  'adjustments',
  'payslips',
  'schedule_cells',
  'notifications',
  'sessions',
  'employee_shifts',
  'employee_locations',
];

const leftovers = async (id: string) => {
  const found: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${table} where employee_id = $1`, [id]);
    if (row!.n > 0) found[table] = row!.n;
  }
  return found;
};

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  hr = await login('quynh@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find((position: any) => position.name === 'Phục vụ').id;
  const shifts = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  toi = shifts.find((shift: any) => shift.code === 'TOI').id;
  yesterday = addDays(vietnamToday(), -1);
});

afterAll(async () => {
  await sql.end();
});

describe('xoá nhân viên', () => {
  it('cho biết trước sẽ mất gì, rồi xoá sạch mọi bảng, nhật ký chỉ còn một dòng không có email', async () => {
    const person = await newPerson();
    await workedYesterday(person);
    await api('POST', '/app/explanations', {
      cookie: person.session,
      body: { date: yesterday, shiftId: toi, reason: 'Điện thoại mất sóng lúc vào ca' },
    });
    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: person.id, date: yesterday, shiftId: toi, approveGps: true },
    });
    const forgot = await api('POST', '/app/requests', {
      cookie: person.session,
      body: {
        type: 'forgot',
        date: yesterday,
        shiftId: toi,
        inTime: '17:00',
        outTime: null,
        reason: 'Quên bấm',
      },
    });
    await api('POST', `/requests/${forgot.body.request.id}/decide`, {
      cookie: admin,
      body: { decision: 'approve' },
    });
    await api('POST', '/adjustments', {
      cookie: admin,
      body: {
        periodKey: yesterday.slice(0, 7),
        employeeId: person.id,
        kind: 'bonus',
        amount: 10_000,
        note: 'Thử',
      },
    });

    const { impact } = (await api('GET', `/employees/${person.id}/deletion`, { cookie: admin })).body;
    expect(impact).toMatchObject({ email: person.email, requests: 1, adjustments: 1 });
    expect(impact.punches).toBeGreaterThanOrEqual(3);
    expect(Object.keys(await leftovers(person.id)).length).toBeGreaterThan(5);

    const before = await auditCount('employee.delete');
    expect((await remove(person)).status).toBe(200);

    expect(await leftovers(person.id)).toEqual({});
    expect(await sql`select 1 from employees where id = ${person.id}`).toHaveLength(0);
    expect(await sql`select 1 from audit_logs where entity_id = ${person.id}`).toHaveLength(0);
    expect(await auditCount('employee.delete')).toBe(before + 1);
    const [log] =
      await sql`select before from audit_logs where action = 'employee.delete' order by at desc limit 1`;
    expect(JSON.stringify(log!.before)).not.toContain(person.email);
    expect((await api('GET', '/app/home', { cookie: person.session })).status).toBe(401);
  });

  it('quyết định đã đưa ra cho người khác vẫn giữ: công của họ không đổi, chỉ bỏ tên người duyệt', async () => {
    const approver = await newPerson({ role: 'hr' });
    const worker = await newPerson({ managerId: approver.id });
    await workedYesterday(worker);
    const approved = await api('POST', '/approvals', {
      cookie: approver.session,
      body: { employeeId: worker.id, date: yesterday, shiftId: toi, approveGps: true },
    });
    expect(approved.status).toBe(201);
    const record = async () =>
      (
        await sql`select status, cong::float as cong, needs_review from day_records
        where employee_id = ${worker.id} and date = ${yesterday}`
      )[0];
    const dayBefore = await record();

    expect((await remove(approver)).status).toBe(200);
    expect(await record()).toEqual(dayBefore);
    const [approval] =
      await sql`select by from approvals where employee_id = ${worker.id} and revoked_at is null`;
    expect(approval).toMatchObject({ by: null });
    const [row] = await sql`select manager_id from employees where id = ${worker.id}`;
    expect(row!.manager_id).toBeNull();
    expect((await api('GET', `/timesheet?period=${yesterday.slice(0, 7)}`, { cookie: admin })).status).toBe(
      200,
    );
  });

  it('gõ sai email thì không xoá gì', async () => {
    const person = await newPerson();
    await workedYesterday(person);
    const result = await remove(person, admin, 'nham@phonho.vn');
    expect(result.status).toBe(400);
    expect(result.body.fields.email).toBeTruthy();
    expect(await sql`select 1 from employees where id = ${person.id}`).toHaveLength(1);
    expect(await leftovers(person.id)).toHaveProperty('attendance_logs');
  });

  it('chỉ Quản trị viên được xoá; không tự xoá mình', async () => {
    const person = await newPerson();
    expect((await remove(person, hr)).status).toBe(403);
    expect((await remove(person, manager)).status).toBe(403);
    expect((await api('GET', `/employees/${person.id}/deletion`, { cookie: hr })).status).toBe(403);

    const [me] = await sql`select id from employees where email = 'ha@phonho.vn'`;
    const self = await api('DELETE', `/employees/${me!.id}`, {
      cookie: admin,
      body: { email: 'ha@phonho.vn' },
    });
    expect(self.status).toBe(409);
  });

  it('người của công ty khác → 404', async () => {
    const [company] =
      await sql`insert into companies (code, name) values (${`X${Date.now()}`}, 'Khác') returning id`;
    const [other] = await sql`insert into employees (company_id, email, name, pin_hash, onboard_date)
      values (${company!.id}, 'x@khac.vn', 'Khác', 'x', '2026-01-01') returning id`;
    const result = await api('DELETE', `/employees/${other!.id}`, {
      cookie: admin,
      body: { email: 'x@khac.vn' },
    });
    expect(result.status).toBe(404);
    expect(await sql`select 1 from employees where id = ${other!.id}`).toHaveLength(1);
  });

  it('xoá người đã có phiếu lương công bố: trang Lương vẫn mở được', async () => {
    const person = await newPerson();
    await workedYesterday(person);
    const period = yesterday.slice(0, 7);
    await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
    await sql`delete from payroll_periods where period_key = ${period}`;
    await api('POST', `/payroll/publish?period=${period}`, { cookie: admin });
    expect((await leftovers(person.id)).payslips).toBe(1);

    expect((await remove(person)).status).toBe(200);
    expect((await api('GET', `/payroll?period=${period}`, { cookie: admin })).status).toBe(200);
    await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
    await sql`delete from payroll_periods where period_key = ${period}`;
  });
});
