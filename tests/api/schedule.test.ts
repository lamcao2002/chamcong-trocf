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
    expect(row(fixed).cells[0]).toMatchObject({ shiftIds: [], defaultShiftIds: [shifts.TV2.id] });
    expect(row(flexible).cells[0]).toMatchObject({ shiftIds: [], defaultShiftIds: [] });
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
    const before = await auditCount('schedule.update');

    const result = await save(admin, [cell(id, vietnamToday(), [shifts.SANG.id, shifts.CHIEU.id])]);
    expect(result.status).toBe(200);
    expect(await auditCount('schedule.update')).toBe(before + 1);
    const [row] = await sql`select shift_ids from schedule_cells where employee_id = ${id}`;
    expect(row!.shift_ids.sort()).toEqual([shifts.SANG.id, shifts.CHIEU.id].sort());

    await save(admin, [cell(id, vietnamToday())]);
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

describe('nháp và công bố', () => {
  const drafts = (id: string) =>
    sql`select date::text, shift_ids, is_off, positions from schedule_drafts where employee_id = ${id} order by date`;
  const published = (id: string) =>
    sql`select date::text, shift_ids, positions from schedule_cells where employee_id = ${id} order by date`;
  const publish = (week: string, cookie = admin) =>
    api('POST', '/schedule/publish', { cookie, body: { week } });

  it('từ ngày mai trở đi vào nháp; công bố chép sang lịch thật, báo một lần', async () => {
    const id = await newEmployee();
    const date = addDays(vietnamToday(), 1);
    const week = mondayOf(date);

    const before = await auditCount('schedule.draft');
    expect((await save(admin, [cell(id, date, [shifts.SANG.id])])).status).toBe(200);
    expect(await auditCount('schedule.draft')).toBe(before + 1);
    expect(await published(id)).toHaveLength(0);
    expect(await drafts(id)).toMatchObject([{ date, shift_ids: [shifts.SANG.id] }]);

    const grid = (await api('GET', `/schedule?week=${week}`, { cookie: admin })).body.schedule;
    const row = grid.employees.find((employee: any) => employee.id === id);
    expect(row.cells.find((entry: any) => entry.date === date)).toMatchObject({
      shiftIds: [],
      draft: { shiftIds: [shifts.SANG.id], isOff: false },
    });
    expect(grid.draftCount).toBeGreaterThanOrEqual(1);
    expect(grid.firstDraftDate).toBe(date);

    const result = await publish(week);
    expect(result.status).toBe(200);
    expect(result.body.result.cells).toBeGreaterThanOrEqual(1);
    expect(await published(id)).toMatchObject([
      { date, shift_ids: [shifts.SANG.id], positions: { [shifts.SANG.id]: positions['Phục vụ'] } },
    ]);
    expect(await drafts(id)).toHaveLength(0);
    const notes = await sql`select title from notifications where employee_id = ${id}`;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toMatch(/^Lịch tuần .* đã công bố$/);
  });

  it('nháp giống lịch đã công bố thì tự xoá; bỏ nháp giữ nguyên lịch thật', async () => {
    const id = await newEmployee();
    const date = addDays(vietnamToday(), 2);
    const week = mondayOf(date);
    await save(admin, [cell(id, date, [shifts.SANG.id])]);
    await publish(week);

    await save(admin, [cell(id, date, [shifts.CHIEU.id])]);
    await save(admin, [cell(id, date, [shifts.SANG.id])]);
    expect(await drafts(id)).toHaveLength(0);

    await save(admin, [cell(id, date, [], true)]);
    const discarded = await api('POST', '/schedule/discard', { cookie: admin, body: { week } });
    expect(discarded.status).toBe(200);
    expect(await drafts(id)).toHaveLength(0);
    expect(await published(id)).toMatchObject([{ shift_ids: [shifts.SANG.id] }]);
  });

  it('hôm nay có hiệu lực ngay, không qua nháp', async () => {
    const id = await newEmployee();
    await save(admin, [cell(id, vietnamToday(), [shifts.SANG.id])]);
    expect(await drafts(id)).toHaveLength(0);
    expect(await published(id)).toHaveLength(1);
  });

  it('Quản lý nhóm chỉ công bố nháp của người mình quản lý', async () => {
    const [mine] = await sql`select id from employees where email = 'tuan@phonho.vn'`;
    const other = await newEmployee();
    const date = addDays(vietnamToday(), 5);
    const week = mondayOf(date);
    await save(admin, [cell(other, date, [shifts.SANG.id])]);
    await save(manager, [cell(mine!.id, date, [shifts.SANG.id])]);

    expect((await publish(week, manager)).status).toBe(200);
    expect(await drafts(other)).toHaveLength(1);
    expect(await drafts(mine!.id)).toHaveLength(0);
    await publish(week);
    await save(admin, [cell(mine!.id, date)]);
    await publish(week);
  });

  it('tuần không có nháp: công bố không đổi gì; tuần sai → 400', async () => {
    const empty = await publish('2020-01-06');
    expect(empty.body.result).toEqual({ cells: 0, people: 0, registrations: 0 });
    expect((await publish('2020-01-07')).status).toBe(400);
  });

  it('vị trí của ca: chỉ vị trí người đó làm được, ca chưa chọn là vị trí chính', async () => {
    const id = await newEmployee('Phục vụ', { extraPositionIds: [positions['Pha chế']] });
    const date = addDays(vietnamToday(), 1);
    const both = [shifts.SANG.id, shifts.TOI.id];
    const bad = await save(admin, [
      { ...cell(id, date, both), positions: { [shifts.SANG.id]: positions['Thu ngân'] } },
    ]);
    expect(bad.status).toBe(400);

    await save(admin, [{ ...cell(id, date, both), positions: { [shifts.TOI.id]: positions['Pha chế'] } }]);
    expect((await drafts(id))[0]!.positions).toEqual({
      [shifts.SANG.id]: positions['Phục vụ'],
      [shifts.TOI.id]: positions['Pha chế'],
    });
    const grid = (await api('GET', `/schedule?week=${mondayOf(date)}`, { cookie: admin })).body.schedule;
    expect(grid.employees.find((employee: any) => employee.id === id).positionIds).toEqual([
      positions['Phục vụ'],
      positions['Pha chế'],
    ]);
    await publish(mondayOf(date));
    expect((await published(id))[0]!.positions[shifts.TOI.id]).toBe(positions['Pha chế']);
  });

  it('người làm nhiều vị trí được xếp ca của mọi vị trí', async () => {
    const plain = await newEmployee('Tạp vụ');
    const multi = await newEmployee('Tạp vụ', { extraPositionIds: [positions['Phục vụ']] });
    const date = addDays(vietnamToday(), 1);
    expect((await save(admin, [cell(plain, date, [shifts.SANG.id])])).status).toBe(400);
    expect((await save(admin, [cell(multi, date, [shifts.SANG.id])])).status).toBe(200);
    await save(admin, [cell(multi, date)]);
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

  it('kỳ đã công bố không bị tính lại khi sửa cấu hình', async () => {
    const id = await newEmployee();
    await punch(id, yesterday, 'in', '07:14');
    await punch(id, yesterday, 'out', '12:00');
    await save(admin, [cell(id, yesterday, [shifts.SANG.id])]);
    const [period] =
      await sql`insert into payroll_periods (company_id, period_key, from_date, to_date, published)
      select company_id, ${`TEST${Date.now()}`}, ${addDays(yesterday, -30)}, ${yesterday}, true
      from employees where id = ${id} returning id`;

    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'phan_vuot' } });
    await api('PATCH', '/company', { cookie: admin, body: { graceMode: 'toan_bo' } }).finally(
      () => sql`delete from payroll_periods where id = ${period!.id}`,
    );
    // Hai lần đổi bù trừ nhau nên kiểm tra thời điểm tính, không kiểm tra số phút
    const [frozen] = await sql`select computed_at from day_records
      where employee_id = ${id} and date = ${yesterday}`;
    const [saved] = await sql`select at from audit_logs where action = 'schedule.update'
      order by at desc limit 1`;
    expect(frozen!.computed_at.getTime()).toBeLessThanOrEqual(saved!.at.getTime() + 2000);
    expect(await records(id, yesterday)).toMatchObject([{ late_min: 14 }]);
  });

  it('lưu lịch của một người không đụng ngày công của người khác', async () => {
    const first = await newEmployee();
    const second = await newEmployee();
    await save(admin, [cell(second, yesterday, [shifts.SANG.id])]);
    const before = await sql`select computed_at from day_records where employee_id = ${second}`;
    await save(admin, [cell(first, yesterday, [shifts.SANG.id])]);
    expect(await sql`select computed_at from day_records where employee_id = ${second}`).toEqual(before);
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

describe('cron chạy lặp', () => {
  it('chạy hai lần cho cùng kết quả, không nhân đôi dòng', async () => {
    const authorization = `Bearer ${CRON_SECRET}`;
    const id = await newEmployee('Tạp vụ');
    const day = addDays(vietnamToday(), -1);
    const once = await fetch(`${BASE_URL}/api/internal/recompute`, { headers: { authorization } });
    expect(once.status).toBe(200);
    const first = await records(id, day);
    const twice = await fetch(`${BASE_URL}/api/internal/recompute`, { headers: { authorization } });
    expect(twice.status).toBe(200);
    expect(await records(id, day)).toEqual(first);
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
    expect((await api('GET', `/day/${boss!.id}/${date}`, { cookie: admin })).status).toBe(404);

    const week = mondayOf(vietnamToday());
    const grid = await api('GET', `/schedule?week=${week}`, { cookie: admin });
    expect(grid.text).not.toContain(boss!.id);
    expect(grid.text).not.toContain(foreignShift!.id);
  });
});
