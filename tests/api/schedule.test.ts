import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays, weekDay } from '../../lib/engine/time';
import { api, auditCount, employeeBody, login, shiftBody, sql } from './helpers';

const CRON_SECRET = process.env.CRON_SECRET ?? '';
const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

let admin: string;
let manager: string;
let positions: Record<string, string>;
let shifts: Record<string, any>;
let yesterday: string;

const mondayOf = (date: string) => addDays(date, -((weekDay(date) + 6) % 7));

const newEmployee = async (position = 'Phục vụ', overrides: object = {}) => {
  const body = employeeBody({ positionId: positions[position], onboardDate: '2026-01-01', ...overrides });
  const result = await api('POST', '/employees', { cookie: admin, body });
  expect(result.status).toBe(201);
  return result.body.employee.id as string;
};

const save = (cookie: string, cells: object[]) => api('PUT', '/schedule', { cookie, body: { cells } });

const cell = (employeeId: string, date: string, shiftIds: string[] = [], isOff = false) => ({
  employeeId,
  date,
  shiftIds,
  isOff,
});

const punch = async (employeeId: string, date: string, type: 'in' | 'out', clock: string) => {
  const at = new Date(`${date}T${clock}:00+07:00`);
  await sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${at}, ${type}, true from employees where id = ${employeeId}`;
};

const records = (employeeId: string, date: string) => sql`
  select dr.status, dr.cong::float as cong, dr.late_min, dr.off_day, dr.shift_id
  from day_records dr where employee_id = ${employeeId} and date = ${date} order by shift_id`;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positionRows = await api('GET', '/positions', { cookie: admin });
  positions = Object.fromEntries(positionRows.body.positions.map((row: any) => [row.name, row.id]));
  const shiftRows = await api('GET', '/shifts', { cookie: admin });
  shifts = Object.fromEntries(shiftRows.body.shifts.map((row: any) => [row.code, row]));
  // Hôm qua trùng ngày lễ mẫu thì lùi tiếp, các test dưới cần một ngày thường đã qua
  const holidays = (await api('GET', '/holidays', { cookie: admin })).body.holidays.map(
    (row: any) => row.date,
  );
  yesterday = addDays(vietnamToday(), -1);
  while (holidays.includes(yesterday)) yesterday = addDays(yesterday, -1);
});

afterAll(async () => {
  await sql.end();
});

describe('GET /schedule (US14)', () => {
  it('trả 7 ngày từ Thứ Hai, chặn tuần không phải Thứ Hai', async () => {
    const week = mondayOf(vietnamToday());
    const result = await api('GET', `/schedule?week=${week}`, { cookie: admin });
    expect(result.status).toBe(200);
    expect(result.body.schedule.dates).toHaveLength(7);
    expect(result.body.schedule.dates[6]).toBe(addDays(week, 6));

    const wrong = await api('GET', `/schedule?week=${addDays(week, 1)}`, { cookie: admin });
    expect(wrong.status).toBe(400);
    expect((await api('GET', '/schedule', { cookie: admin })).status).toBe(400);
  });

  it('ca cố định hiện sẵn không cần xếp, người linh hoạt để trống', async () => {
    const fixed = await newEmployee('Tạp vụ');
    const flexible = await newEmployee();
    const { schedule } = (await api('GET', `/schedule?week=${mondayOf(vietnamToday())}`, { cookie: admin }))
      .body;

    const row = (id: string) => schedule.employees.find((employee: any) => employee.id === id);
    expect(row(fixed).shiftMode).toBe('fixed');
    expect(row(fixed).cells[0]).toMatchObject({ shiftIds: [shifts.TV2.id], fixed: true });
    expect(row(flexible).cells[0]).toMatchObject({ shiftIds: [], fixed: false });
    expect(row(flexible).allowedShiftIds).toContain(shifts.SANG.id);
  });

  it('Quản lý nhóm chỉ thấy người mình quản lý, không có số tiền', async () => {
    const result = await api('GET', `/schedule?week=${mondayOf(vietnamToday())}`, { cookie: manager });
    const ids = result.body.schedule.employees.map((employee: any) => employee.id);
    const managed = await sql`select id from employees where manager_id = (
      select id from employees where email = 'minh@phonho.vn')`;
    expect(ids.sort()).toEqual(managed.map(({ id }) => id).sort());
    expect(result.text).not.toMatch(/payAmount|payOverride/);
  });

  it('người đã nghỉ trước tuần này biến mất khỏi lưới', async () => {
    const id = await newEmployee();
    await api('PATCH', `/employees/${id}`, { cookie: admin, body: { status: 'left' } });
    await sql`update employees set left_date = ${addDays(mondayOf(vietnamToday()), -1)} where id = ${id}`;
    const { schedule } = (await api('GET', `/schedule?week=${mondayOf(vietnamToday())}`, { cookie: admin }))
      .body;
    expect(schedule.employees.some((employee: any) => employee.id === id)).toBe(false);
  });
});

describe('PUT /schedule (US15, US16)', () => {
  it('lưu nhiều ca một ngày, ghi audit, ô trống là xoá', async () => {
    const id = await newEmployee();
    const date = addDays(vietnamToday(), 3);
    const before = await auditCount('schedule.update');

    const result = await save(admin, [cell(id, date, [shifts.SANG.id, shifts.CHIEU.id])]);
    expect(result.status).toBe(200);
    expect(await auditCount('schedule.update')).toBe(before + 1);
    const [row] = await sql`select shift_ids from schedule_cells where employee_id = ${id}`;
    expect(row!.shift_ids.sort()).toEqual([shifts.SANG.id, shifts.CHIEU.id].sort());

    await save(admin, [cell(id, date)]);
    expect(await sql`select 1 from schedule_cells where employee_id = ${id}`).toHaveLength(0);
  });

  it('từ chối dữ liệu sai', async () => {
    const id = await newEmployee();
    const date = addDays(vietnamToday(), 1);
    const bad = async (cells: object[]) => expect((await save(admin, cells)).status).toBe(400);

    await bad([cell(id, date, [shifts.SANG.id], true)]);
    await bad([cell(id, date), cell(id, date, [shifts.SANG.id])]);
    await bad([cell(id, date, [shifts.CA1.id])]);
    await bad([cell(id, '2025-01-01', [shifts.SANG.id])]);
    await bad([cell(id, 'hom-nay', [shifts.SANG.id])]);
    expect((await api('PUT', '/schedule', { cookie: admin, body: { cells: [] } })).status).toBe(400);
  });

  it('không xếp được sau ngày nghỉ việc', async () => {
    const id = await newEmployee();
    await api('PATCH', `/employees/${id}`, { cookie: admin, body: { status: 'left' } });
    const result = await save(admin, [cell(id, addDays(vietnamToday(), 1), [shifts.SANG.id])]);
    expect(result.status).toBe(400);
  });

  it('Quản lý nhóm chỉ xếp được người mình quản lý', async () => {
    const [mine] = await sql`select id from employees where email = 'tuan@phonho.vn'`;
    const [other] = await sql`select id from employees where email = 'anh@phonho.vn'`;
    const date = addDays(vietnamToday(), 2);
    expect((await save(manager, [cell(other!.id, date, [shifts.SANG.id])])).status).toBe(400);
    expect(
      await sql`select 1 from schedule_cells where employee_id = ${other!.id} and date = ${date}`,
    ).toHaveLength(0);
    expect((await save(manager, [cell(mine!.id, date, [])])).status).toBe(200);
  });
});

describe('tính lại ngày công (US22)', () => {
  it('xếp ca thì lần chấm đã có ghép vào, đổi ca thì dòng cũ biến mất', async () => {
    const id = await newEmployee();
    await punch(id, yesterday, 'in', '06:58');
    await punch(id, yesterday, 'out', '12:01');

    await save(admin, [cell(id, yesterday, [shifts.SANG.id])]);
    expect(await records(id, yesterday)).toMatchObject([{ status: 'du', cong: 1, shift_id: shifts.SANG.id }]);

    await save(admin, [cell(id, yesterday, [shifts.TOI.id])]);
    const rows = await records(id, yesterday);
    expect(rows.some(({ shift_id }) => shift_id === shifts.SANG.id)).toBe(false);
    expect(rows.find(({ shift_id }) => shift_id === shifts.TOI.id)).toMatchObject({ status: 'vang' });

    await save(admin, [cell(id, yesterday)]);
    expect((await records(id, yesterday)).every(({ status }) => status === 'ngoai_lich')).toBe(true);
  });

  it('hai lần lưu song song không làm trùng hay mất dòng', async () => {
    const id = await newEmployee();
    await punch(id, yesterday, 'in', '06:58');
    await punch(id, yesterday, 'out', '12:01');
    const results = await Promise.all(
      Array.from({ length: 6 }, () => save(admin, [cell(id, yesterday, [shifts.SANG.id])])),
    );
    expect(results.every(({ status }) => status === 200)).toBe(true);
    expect(await records(id, yesterday)).toHaveLength(1);
  });

  it('Cho nghỉ: 0 công, không vắng; ngày tương lai chưa có dòng', async () => {
    const id = await newEmployee('Tạp vụ');
    await save(admin, [cell(id, yesterday, [], true), cell(id, addDays(vietnamToday(), 4), [], true)]);
    expect(await records(id, yesterday)).toMatchObject([{ status: 'nghi', cong: 0 }]);
    expect(await records(id, addDays(vietnamToday(), 4))).toHaveLength(0);
  });

  it('sửa ca: công các ngày đã qua đổi theo; đổi tên thì không tính lại', async () => {
    const body = shiftBody();
    const created = (await api('POST', '/shifts', { cookie: admin, body })).body.shift;
    const id = await newEmployee('Phục vụ', { shiftIds: [created.id] });
    await punch(id, yesterday, 'in', '08:30');
    await punch(id, yesterday, 'out', body.endTime);
    await save(admin, [cell(id, yesterday, [created.id])]);
    const [before] = await sql`select cong::float as cong, computed_at from day_records
      where employee_id = ${id} and date = ${yesterday}`;
    expect(before!.cong).toBe(1);

    await api('PATCH', `/shifts/${created.id}`, { cookie: admin, body: { ...body, name: 'Tên mới' } });
    const [renamed] =
      await sql`select computed_at from day_records where employee_id = ${id} and date = ${yesterday}`;
    expect(renamed!.computed_at).toEqual(before!.computed_at);

    const shorter = await api('PATCH', `/shifts/${created.id}`, {
      cookie: admin,
      body: { ...body, minFull: 220 },
    });
    expect(shorter.status).toBe(200);
    expect(await records(id, yesterday)).toMatchObject([{ cong: 0.5 }]);
  });

  it('sửa ngày làm của vị trí làm ngày thành ngày nghỉ', async () => {
    const id = await newEmployee('Tạp vụ');
    await punch(id, yesterday, 'in', '06:00');
    await punch(id, yesterday, 'out', '08:00');

    const position = (await api('GET', '/positions', { cookie: admin })).body.positions.find(
      ({ id: positionId }: any) => positionId === positions['Tạp vụ'],
    );
    const body = { ...position, workDays: [(weekDay(yesterday) + 1) % 7] };
    const result = await api('PATCH', `/positions/${position.id}`, { cookie: admin, body });
    expect(result.status).toBe(200);
    expect(await records(id, yesterday)).toMatchObject([{ status: 'ot_cho', off_day: true, shift_id: null }]);

    await api('PATCH', `/positions/${position.id}`, { cookie: admin, body: position });
    expect(await records(id, yesterday)).toMatchObject([{ status: 'du', off_day: false }]);
  });

  it('thêm và xoá ngày lễ áp cho cả công ty', async () => {
    const id = await newEmployee('Tạp vụ');
    const added = await api('POST', '/holidays', {
      cookie: admin,
      body: { date: yesterday, name: 'Lễ thử' },
    });
    expect(added.status).toBe(201);
    expect(await records(id, yesterday)).toMatchObject([{ status: 'le', cong: 1 }]);

    await api('DELETE', `/holidays/${added.body.holiday.id}`, { cookie: admin });
    expect(await records(id, yesterday)).toMatchObject([{ status: 'vang', cong: 0 }]);
  });

  it('đổi chế độ tính muộn áp cho ngày đã qua', async () => {
    const id = await newEmployee();
    await punch(id, yesterday, 'in', '07:14');
    await punch(id, yesterday, 'out', '12:00');
    await save(admin, [cell(id, yesterday, [shifts.SANG.id])]);
    expect(await records(id, yesterday)).toMatchObject([{ late_min: 14 }]);

    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'phan_vuot' } });
    const [changed] = await records(id, yesterday);
    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'toan_bo' } });
    expect(changed!.late_min).toBe(14 - shifts.SANG.graceMin);
    expect(await records(id, yesterday)).toMatchObject([{ late_min: 14 }]);
  });

  it('chuyển Đã nghỉ giữ công đến ngày nghỉ, cả khi tính lại về sau', async () => {
    const id = await newEmployee();
    await punch(id, yesterday, 'in', '06:58');
    await punch(id, yesterday, 'out', '12:01');
    await save(admin, [cell(id, yesterday, [shifts.SANG.id])]);

    await api('PATCH', `/employees/${id}`, { cookie: admin, body: { status: 'left' } });
    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'phan_vuot' } });
    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'toan_bo' } });
    expect(await records(id, yesterday)).toMatchObject([{ status: 'du', cong: 1 }]);
  });
});

describe('cron tính lại (S2-11)', () => {
  const call = (authorization?: string) =>
    fetch(`${BASE_URL}/api/internal/recompute`, { headers: authorization ? { authorization } : {} });

  it('từ chối khi thiếu hoặc sai khoá', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer sai-khoa')).status).toBe(401);
    expect((await call(admin)).status).toBe(401);
  });

  it('tạo ngày vắng cho người không chấm, ghi audit hệ thống', async () => {
    const id = await newEmployee('Tạp vụ');
    const day = addDays(vietnamToday(), -1);
    const before = await auditCount('day.recompute');
    const response = await call(`Bearer ${CRON_SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, failed: 0 });
    expect(await auditCount('day.recompute')).toBeGreaterThan(before);

    const [holiday] = await sql`select 1 from holidays where date = ${day} limit 1`;
    if (!holiday) expect(await records(id, day)).toMatchObject([{ status: 'vang' }]);
  });
});

describe('cách ly công ty', () => {
  it('không xếp được nhân viên hay ca của công ty khác', async () => {
    const [company] =
      await sql`insert into companies (code, name) values (${`S${Date.now()}`}, 'Khác') returning id`;
    const [boss] = await sql`insert into employees (company_id, email, name, pin_hash, onboard_date)
      values (${company!.id}, 'x@khac.vn', 'X', 'h', '2026-01-01') returning id`;
    const [foreignShift] =
      await sql`insert into shifts (company_id, code, name, start_time, end_time, std_hours, min_full, min_half)
      values (${company!.id}, 'K1', 'K', '08:00', '12:00', 4, 200, 100) returning id`;
    const id = await newEmployee();
    const date = addDays(vietnamToday(), 1);
    expect((await save(admin, [cell(boss!.id, date, [shifts.SANG.id])])).status).toBe(400);
    expect((await save(admin, [cell(id, date, [foreignShift!.id])])).status).toBe(400);
  });
});
