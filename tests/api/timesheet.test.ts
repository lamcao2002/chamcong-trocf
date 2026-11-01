import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, employeeBody, login, sql } from './helpers';

let admin: string;
let manager: string;
let positionId: string;
let shifts: Record<string, any>;
let yesterday: string;
let period: string;

type Employee = { id: string; session: string; name: string };

const newEmployee = async (): Promise<Employee> => {
  const name = `Bảng công ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const body = employeeBody({ name, positionId, onboardDate: '2026-01-01' });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, name, session: await login(body.email, 'app', COMPANY, pin) };
};

const schedule = (employeeId: string, date: string, shiftIds: string[]) =>
  api('PUT', '/schedule', { cookie: admin, body: { cells: [{ employeeId, date, shiftIds, isOff: false }] } });

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string, inZone = true) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, ${inZone} from employees where id = ${employeeId}`;

const grid = async (cookie = admin) =>
  (await api('GET', `/timesheet?period=${period}`, { cookie })).body.timesheet;
const rowOf = async (id: string) => (await grid()).employees.find((row: any) => row.id === id);

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find((position: any) => position.name === 'Phục vụ').id;
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
  yesterday = addDays(vietnamToday(), -1);
  period = yesterday.slice(0, 7);
});

afterAll(async () => {
  await sql.end();
});

describe('GET /timesheet (US27)', () => {
  it('ô theo ký hiệu, cột tổng khớp dòng ngày công', async () => {
    const { id } = await newEmployee();
    await punch(id, yesterday, 'in', '07:14');
    await punch(id, yesterday, 'out', '12:00');
    await schedule(id, yesterday, [shifts.SANG.id, shifts.TOI.id]);

    const row = await rowOf(id);
    expect(row.cells).toHaveLength(1);
    expect(row.cells[0]).toMatchObject({ date: yesterday, symbol: 'vang', label: 'V', shiftCount: 2 });
    expect(row.totals).toMatchObject({ cong: 1, lateMin: 14, missing: 0 });
  });

  it('OT tách phần đã duyệt và phần chờ', async () => {
    const { id } = await newEmployee();
    await punch(id, yesterday, 'in', '17:00');
    await punch(id, yesterday, 'out', '23:00');
    await schedule(id, yesterday, [shifts.TOI.id]);
    expect((await rowOf(id)).totals).toMatchObject({ otApproved: 0, otPending: 60 });
    expect((await rowOf(id)).cells[0].symbol).toBe('ot_cho');

    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: 45 },
    });
    expect((await rowOf(id)).totals).toMatchObject({ otApproved: 45, otPending: 0 });
    expect((await rowOf(id)).cells[0].symbol).toBe('ot_duyet');
  });

  it('kỳ có đủ ngày, kỳ sai trả 400, Quản lý nhóm chỉ thấy người của mình', async () => {
    const view = await grid();
    expect(view.dates[0]).toBe(view.period.from);
    expect(view.dates[view.dates.length - 1]).toBe(view.period.to);
    expect((await api('GET', '/timesheet?period=abc', { cookie: admin })).status).toBe(400);

    const { id } = await newEmployee();
    const scoped = await grid(manager);
    expect(scoped.employees.some((row: any) => row.id === id)).toBe(false);
    expect(JSON.stringify(scoped)).not.toMatch(/payAmount|payOverride/);
  });
});

describe('GET /timesheet/:employeeId (US28)', () => {
  it('liệt kê từng ca theo ngày, ngoài phạm vi trả 404', async () => {
    const { id } = await newEmployee();
    await schedule(id, yesterday, [shifts.SANG.id]);
    const result = await api('GET', `/timesheet/${id}?period=${period}`, { cookie: admin });
    expect(result.status).toBe(200);
    expect(result.body.timesheet.rows).toHaveLength(1);
    expect(result.body.timesheet.rows[0]).toMatchObject({ date: yesterday, status: 'vang' });
    expect((await api('GET', `/timesheet/${id}?period=${period}`, { cookie: manager })).status).toBe(404);
    expect((await api('GET', '/timesheet/abc', { cookie: admin })).status).toBe(404);
  });
});

describe('app nhân viên (M3)', () => {
  it('lịch tuần: ca, Cho nghỉ; chặn tuần không phải Thứ Hai', async () => {
    const { id, session } = await newEmployee();
    const today = vietnamToday();
    await schedule(id, today, [shifts.SANG.id]);
    const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const result = await api('GET', `/app/schedule?week=${monday}`, { cookie: session });
    expect(result.status).toBe(200);
    expect(result.body.schedule.days).toHaveLength(7);
    const day = result.body.schedule.days.find((row: any) => row.date === today);
    expect(day.shifts[0]).toMatchObject({ id: shifts.SANG.id, startTime: '07:00' });
    expect((await api('GET', `/app/schedule?week=${addDays(monday, 1)}`, { cookie: session })).status).toBe(
      400,
    );
  });

  it('bảng công của tôi chỉ có dữ liệu của tôi, phiên quản trị không dùng được', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, yesterday, [shifts.SANG.id]);
    const result = await api('GET', `/app/timesheet?month=${period}`, { cookie: session });
    expect(result.status).toBe(200);
    const day = result.body.timesheet.days.find((row: any) => row.date === yesterday);
    expect(day).toMatchObject({ symbol: 'vang' });
    expect(day.records).toHaveLength(1);
    expect((await api('GET', '/app/timesheet', { cookie: admin })).status).toBe(401);
    expect((await api('GET', '/app/timesheet?month=abc', { cookie: session })).status).toBe(400);
  });
});

describe('ba màn cùng một con số', () => {
  it('Hộp việc, Bảng công và M3 khớp nhau trước và sau khi duyệt', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '17:00', false);
    await punch(id, yesterday, 'out', '23:00');
    await schedule(id, yesterday, [shifts.TOI.id]);

    const inbox = async () =>
      (await api('GET', `/inbox?period=${period}`, { cookie: admin })).body.inbox.items.filter(
        (item: any) => item.employeeId === id,
      );
    const mine = async () => {
      const { timesheet } = (await api('GET', `/app/timesheet?month=${period}`, { cookie: session })).body;
      return timesheet.days.find((day: any) => day.date === yesterday);
    };
    const manager_ = async () => (await rowOf(id)).cells[0];

    expect(await inbox()).toHaveLength(2);
    expect((await mine()).symbol).toBe((await manager_()).symbol);
    expect((await mine()).symbol).toBe('vung');

    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, approveGps: true, otMinutes: 60 },
    });
    expect(await inbox()).toHaveLength(0);
    expect((await mine()).symbol).toBe((await manager_()).symbol);
    expect((await mine()).symbol).toBe('ot_duyet');
    expect((await rowOf(id)).totals).toMatchObject({ cong: 1, otApproved: 60, otPending: 0 });
  });
});
