import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, shiftBody, sql } from './helpers';

const NEAR = { lat: 21.02452, lng: 105.85308, accuracy: 12 };
const FAR = { lat: 21.1, lng: 105.9, accuracy: 12 };

let admin: string;
let positionId: string;
let shifts: Record<string, any>;

type Employee = { id: string; session: string };

const newEmployee = async (overrides: object = {}): Promise<Employee> => {
  const body = employeeBody({ positionId, onboardDate: '2026-01-01', ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, session: await login(body.email, 'app', COMPANY, pin) };
};

const scheduleToday = (employeeId: string, shiftIds: string[]) =>
  api('PUT', '/schedule', {
    cookie: admin,
    body: { cells: [{ employeeId, date: vietnamToday(), shiftIds, isOff: false }] },
  });

const punch = (cookie: string, body: object) => api('POST', '/app/punch', { cookie, body });
const home = async (cookie: string) => (await api('GET', '/app/home', { cookie })).body.home;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find((position: any) => position.name === 'Phục vụ').id;
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
});

afterAll(async () => {
  await sql.end();
});

describe('GET /app/home (US17, US20)', () => {
  it('cần phiên app, phiên quản trị không dùng được', async () => {
    expect((await api('GET', '/app/home')).status).toBe(401);
    expect((await api('GET', '/app/home', { cookie: admin })).status).toBe(401);
    expect((await punch(admin, { type: 'in', ...NEAR })).status).toBe(401);
  });

  it('trả ca hôm nay, ca được chọn, địa điểm, chưa có lần chấm', async () => {
    const { id, session } = await newEmployee();
    await scheduleToday(id, [shifts.SANG.id]);
    const body = await home(session);

    expect(body.date).toBe(vietnamToday());
    expect(body.shifts.map(({ code }: any) => code)).toEqual(['SANG']);
    expect(body.choices.map(({ code }: any) => code).sort()).toEqual(['CHIEU', 'SANG', 'TOI']);
    expect(body.locations.length).toBeGreaterThan(0);
    expect(body).toMatchObject({ nextAction: 'in', timeline: [], isOff: false });
  });

  it('ngày Cho nghỉ báo rõ', async () => {
    const { id, session } = await newEmployee();
    await api('PUT', '/schedule', {
      cookie: admin,
      body: { cells: [{ employeeId: id, date: vietnamToday(), shiftIds: [], isOff: true }] },
    });
    expect(await home(session)).toMatchObject({ isOff: true, shifts: [] });
  });
});

describe('POST /app/punch (US18, US19)', () => {
  it('ghi giờ server, tính trong vùng ở server, có audit, nút đổi thành RA CA', async () => {
    const { id, session } = await newEmployee();
    const before = await auditCount('attendance.punch');
    const started = Date.now();

    const result = await punch(session, { type: 'in', ...NEAR, chosenShiftId: shifts.SANG.id });
    expect(result.status).toBe(201);
    expect(result.body.result).toMatchObject({ type: 'in', inZone: true, distanceM: 0 });
    expect(await auditCount('attendance.punch')).toBe(before + 1);

    const [log] =
      await sql`select at, in_zone, accuracy_m, location_id from attendance_logs where employee_id = ${id}`;
    expect(Math.abs(log!.at.getTime() - started)).toBeLessThan(30_000);
    expect(log).toMatchObject({ in_zone: true, accuracy_m: 12 });
    expect(log!.location_id).not.toBeNull();

    const next = await home(session);
    expect(next).toMatchObject({ nextAction: 'out', openShiftId: shifts.SANG.id });
    expect(next.timeline).toHaveLength(1);
  });

  it('không nhận giờ từ client', async () => {
    const { id, session } = await newEmployee();
    await punch(session, { type: 'in', ...NEAR, at: '2020-01-01T00:00:00Z' });
    const [log] = await sql`select at from attendance_logs where employee_id = ${id}`;
    expect(log!.at.getFullYear()).toBeGreaterThan(2020);
  });

  it('ngoài vùng vẫn ghi, kèm khoảng cách', async () => {
    const { session } = await newEmployee();
    const result = await punch(session, { type: 'in', ...FAR, chosenShiftId: shifts.SANG.id });
    expect(result.body.result.inZone).toBe(false);
    expect(result.body.result.distanceM).toBeGreaterThan(1000);
  });

  it('tính lại ngày công ngay trong lần chấm', async () => {
    const { id, session } = await newEmployee();
    await punch(session, { type: 'in', ...NEAR, chosenShiftId: shifts.SANG.id });
    expect(
      await sql`select 1 from day_records where employee_id = ${id} and date = ${vietnamToday()}`,
    ).toHaveLength(1);
    await punch(session, { type: 'out', ...NEAR, chosenShiftId: shifts.SANG.id });
    expect((await home(session)).nextAction).toBe('in');
  });

  it('chọn đúng ca có lịch nhưng chấm ngoài giờ ca vẫn ghi được, bất kể lúc nào', async () => {
    const { id, session } = await newEmployee();
    await scheduleToday(id, [shifts.SANG.id, shifts.TOI.id]);
    const result = await punch(session, { type: 'in', ...NEAR, chosenShiftId: shifts.TOI.id });
    expect(result.status).toBe(201);
    const late = await punch(session, { type: 'out', ...NEAR, chosenShiftId: shifts.TOI.id });
    expect(late.status).toBe(201);
    expect(await sql`select 1 from attendance_logs where employee_id = ${id}`).toHaveLength(2);
  });

  it('bấm lặp không tạo dòng ngày công trùng', async () => {
    const { id, session } = await newEmployee();
    const body = { type: 'in', ...NEAR, chosenShiftId: shifts.SANG.id };
    const results = await Promise.all([punch(session, body), punch(session, body), punch(session, body)]);
    expect(results.every(({ status }) => status === 201)).toBe(true);
    expect(await sql`select 1 from attendance_logs where employee_id = ${id}`).toHaveLength(3);
    expect(
      await sql`select 1 from day_records where employee_id = ${id} and date = ${vietnamToday()}`,
    ).toHaveLength(1);
  });

  it('ca đêm hôm qua: lần ra sáng nay về đúng ngày bắt đầu', async () => {
    const night = shiftBody();
    const created = await api('POST', '/shifts', {
      cookie: admin,
      body: { ...night, startTime: '22:00', endTime: '06:00', stdHours: 8, minFull: 420, minHalf: 210 },
    });
    expect(created.status).toBe(201);
    const shift = created.body.shift;
    const { id } = await newEmployee({ shiftIds: [shift.id] });
    const yesterday = addDays(vietnamToday(), -1);
    await sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
      select company_id, id, ${new Date(`${yesterday}T21:58:00+07:00`)}, 'in', true from employees where id = ${id}`;
    await sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
      select company_id, id, ${new Date(`${vietnamToday()}T06:02:00+07:00`)}, 'out', true from employees where id = ${id}`;
    await api('PUT', '/schedule', {
      cookie: admin,
      body: { cells: [{ employeeId: id, date: yesterday, shiftIds: [shift.id], isOff: false }] },
    });

    const rows = await sql`select date::text, status, worked_min from day_records where employee_id = ${id}`;
    expect(rows).toEqual([{ date: yesterday, status: 'du', worked_min: 480 }]);
  });

  it('từ chối dữ liệu sai và ca không được làm', async () => {
    const { session } = await newEmployee();
    const bad = async (body: object) => expect((await punch(session, body)).status).toBe(400);
    await bad({ type: 'in', lat: 95, lng: 105, accuracy: 5 });
    await bad({ type: 'in', lat: 21, accuracy: 5 });
    await bad({ type: 've', ...NEAR });
    await bad({ type: 'in', ...NEAR, chosenShiftId: 'abc' });
    await bad({ type: 'in', ...NEAR, chosenShiftId: shifts.CA1.id });
  });

  it('người Đã nghỉ mất quyền chấm ngay', async () => {
    const { id, session } = await newEmployee();
    await api('PATCH', `/employees/${id}`, { cookie: admin, body: { status: 'left' } });
    expect((await punch(session, { type: 'in', ...NEAR })).status).toBe(401);
  });
});

describe('GET /day/:employeeId/:date (US22)', () => {
  it('trả lần chấm và ngày công, tính tại chỗ cho hôm nay', async () => {
    const { id, session } = await newEmployee();
    await scheduleToday(id, [shifts.SANG.id]);
    await punch(session, { type: 'in', ...NEAR, chosenShiftId: shifts.SANG.id });

    const result = await api('GET', `/day/${id}/${vietnamToday()}`, { cookie: admin });
    expect(result.status).toBe(200);
    expect(result.body.day.punches).toHaveLength(1);
    expect(result.body.day.records.some(({ shiftId }: any) => shiftId === shifts.SANG.id)).toBe(true);
  });

  it('Quản lý nhóm không xem được người ngoài phạm vi, ID sai trả 404', async () => {
    const { id } = await newEmployee();
    const manager = await login('minh@phonho.vn');
    expect((await api('GET', `/day/${id}/${vietnamToday()}`, { cookie: manager })).status).toBe(404);
    expect((await api('GET', `/day/abc/${vietnamToday()}`, { cookie: admin })).status).toBe(404);
    expect((await api('GET', `/day/${id}/hom-nay`, { cookie: admin })).status).toBe(404);
  });
});
