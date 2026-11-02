import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays, mondayOf } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, sql } from './helpers';

let admin: string;
let manager: string;
let shifts: Record<string, any>;
let positions: Record<string, any>;
let today: string;
let yesterday: string;
let nextMonday: string;

type Person = { id: string; session: string };

const newPerson = async (position = 'Phục vụ'): Promise<Person> => {
  const body = employeeBody({ positionId: positions[position].id, onboardDate: '2026-01-01' });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, session: await login(body.email, 'app', COMPANY, pin) };
};

const schedule = (employeeId: string, date: string, shiftIds: string[], isOff = false) =>
  api('PUT', '/schedule', { cookie: admin, body: { cells: [{ employeeId, date, shiftIds, isOff }] } });

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, true from employees where id = ${employeeId}`;

const send = (person: Person, body: object) =>
  api('POST', '/app/requests', { cookie: person.session, body: { reason: 'Việc gia đình', ...body } });

const decide = (id: string, decision: 'approve' | 'reject', note?: string, cookie = admin) =>
  api('POST', `/requests/${id}/decide`, { cookie, body: { decision, note } });

const cell = async (employeeId: string, date: string) =>
  (
    await sql`select shift_ids, is_off from schedule_cells where employee_id = ${employeeId} and date = ${date}`
  )[0];

const feed = async (person: Person) =>
  (await api('GET', '/app/notifications', { cookie: person.session })).body;

const status = async (id: string) => (await sql`select status from requests where id = ${id}`)[0]!.status;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positionRows = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positions = Object.fromEntries(positionRows.map((row: any) => [row.name, row]));
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
  today = vietnamToday();
  yesterday = addDays(today, -1);
  nextMonday = addDays(mondayOf(today), 7);
});

afterAll(async () => {
  await sql.end();
});

describe('thông báo trong app (EMP-17)', () => {
  it('duyệt đơn báo đúng người; đọc xong hết chưa đọc, có nhật ký', async () => {
    const person = await newPerson();
    const other = await newPerson();
    const { request } = (
      await send(person, { type: 'overtime', date: today, when: 'after', from: '22:00', to: '23:00' })
    ).body;
    expect((await feed(person)).unread).toBe(0);

    await decide(request.id, 'approve');
    const mine = await feed(person);
    expect(mine.unread).toBe(1);
    expect(mine.notifications[0]).toMatchObject({
      kind: 'request',
      title: 'Đơn đã được duyệt',
      href: '#/lich',
    });
    expect((await feed(other)).unread).toBe(0);

    const before = await auditCount('notification.read');
    await api('POST', '/app/notifications/read', { cookie: person.session, body: {} });
    expect((await feed(person)).unread).toBe(0);
    expect(await auditCount('notification.read')).toBe(before + 1);
  });

  it('từ chối thì kèm lý do của quản lý', async () => {
    const person = await newPerson();
    const { request } = (
      await send(person, { type: 'overtime', date: today, when: 'after', from: '22:00', to: '23:00' })
    ).body;
    await decide(request.id, 'reject', 'Hôm đó đủ người');
    const [item] = (await feed(person)).notifications;
    expect(item).toMatchObject({ title: 'Đơn bị từ chối' });
    expect(item.body).toContain('Hôm đó đủ người');
  });

  it('không đọc hộ được thông báo của người khác', async () => {
    const person = await newPerson();
    const other = await newPerson();
    await schedule(person.id, addDays(today, 1), [shifts.TOI.id]);
    const [item] = (await feed(person)).notifications;
    await api('POST', '/app/notifications/read', { cookie: other.session, body: { ids: [item.id] } });
    expect((await feed(person)).unread).toBe(1);
  });

  it('đổi lịch từ hôm nay trở đi mới báo, lưu lại y hệt và ngày đã qua thì không', async () => {
    const person = await newPerson();
    await schedule(person.id, yesterday, [shifts.TOI.id]);
    expect((await feed(person)).unread).toBe(0);

    const date = addDays(today, 1);
    await schedule(person.id, date, [shifts.TOI.id]);
    expect((await feed(person)).unread).toBe(1);
    await schedule(person.id, date, [shifts.TOI.id]);
    expect((await feed(person)).unread).toBe(1);
  });

  it('công bố lương báo từng người, chưa đăng nhập thì 401', async () => {
    const person = await newPerson();
    const period = today.slice(0, 7);
    await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
    await sql`delete from payroll_periods where period_key = ${period}`;
    await api('POST', `/payroll/publish?period=${period}`, { cookie: admin });
    expect((await feed(person)).notifications[0]).toMatchObject({
      kind: 'payslip',
      title: 'Có phiếu lương mới',
      href: '#/luong',
    });
    await api('POST', `/payroll/publish?period=${period}`, { cookie: admin });
    expect((await feed(person)).notifications[0].title).toBe('Phiếu lương đã cập nhật');
    await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
    await sql`delete from payroll_periods where period_key = ${period}`;

    expect((await api('GET', '/app/notifications')).status).toBe(401);
    expect((await api('POST', '/app/notifications/read', { body: {} })).status).toBe(401);
  });
});

describe('đơn Muộn/sớm (EMP-13)', () => {
  const record = async (id: string) =>
    (
      await sql`select status, late_min, waived_late from day_records where employee_id = ${id} and date = ${yesterday}`
    )[0]!;

  it('duyệt thì ngày hết muộn; số phút hiển thị giữ nguyên', async () => {
    const person = await newPerson();
    await punch(person.id, yesterday, 'in', '17:20');
    await punch(person.id, yesterday, 'out', '22:00');
    await schedule(person.id, yesterday, [shifts.TOI.id]);
    expect(await record(person.id)).toMatchObject({ status: 'muon', late_min: 20, waived_late: false });

    const sent = await send(person, {
      type: 'late_early',
      date: yesterday,
      kind: 'late',
      minutes: 30,
      shiftId: '',
    });
    expect(sent.status).toBe(201);
    await decide(sent.body.request.id, 'approve');
    expect(await record(person.id)).toMatchObject({ status: 'du', late_min: 20, waived_late: true });
  });

  it('từ chối thì giữ nguyên muộn', async () => {
    const person = await newPerson();
    await punch(person.id, yesterday, 'in', '17:20');
    await punch(person.id, yesterday, 'out', '22:00');
    await schedule(person.id, yesterday, [shifts.TOI.id]);
    const sent = await send(person, {
      type: 'late_early',
      date: yesterday,
      kind: 'late',
      minutes: 30,
      shiftId: '',
    });
    await decide(sent.body.request.id, 'reject');
    expect(await record(person.id)).toMatchObject({ status: 'muon', waived_late: false });
  });

  it('một ngày không gửi hai đơn cùng loại; khác loại thì được', async () => {
    const person = await newPerson();
    const body = { type: 'late_early', date: today, minutes: 10, shiftId: '' };
    expect((await send(person, { ...body, kind: 'late' })).status).toBe(201);
    expect((await send(person, { ...body, kind: 'late' })).status).toBe(409);
    expect((await send(person, { ...body, kind: 'early' })).status).toBe(201);
  });

  it.each([
    ['0 phút', { minutes: 0 }],
    ['quá 480 phút', { minutes: 481 }],
    ['loại lạ', { kind: 'muon' }],
  ])('%s → 400', async (_name, fields) => {
    const person = await newPerson();
    const body = { type: 'late_early', date: today, kind: 'late', minutes: 10, shiftId: '', ...fields };
    expect((await send(person, body)).status).toBe(400);
  });
});

describe('đơn Đổi ca (EMP-13)', () => {
  const swapBody = (off: string, work: string) => ({
    type: 'shift_swap',
    offDate: off,
    offShiftId: shifts.TOI.id,
    workDate: work,
    workShiftId: shifts.TOI.id,
  });

  it('duyệt thì lịch đổi cả hai ngày, ngày hết ca thành Cho nghỉ', async () => {
    const person = await newPerson();
    const off = addDays(today, 2);
    const work = addDays(today, 3);
    await schedule(person.id, off, [shifts.TOI.id]);
    const sent = await send(person, swapBody(off, work));
    expect(sent.status).toBe(201);
    expect(sent.body.request).toMatchObject({ fromDate: off, toDate: work });

    await decide(sent.body.request.id, 'approve');
    expect(await cell(person.id, off)).toMatchObject({ shift_ids: [], is_off: true });
    expect(await cell(person.id, work)).toMatchObject({ shift_ids: [shifts.TOI.id], is_off: false });
  });

  it('đã chấm công ngày đó thì chặn duyệt, đơn và lịch giữ nguyên', async () => {
    const person = await newPerson();
    const work = addDays(today, 3);
    await schedule(person.id, today, [shifts.TOI.id]);
    const sent = await send(person, swapBody(today, work));
    await punch(person.id, today, 'in', '00:01');

    const result = await decide(sent.body.request.id, 'approve');
    expect(result.status).toBe(409);
    expect(result.body.error).toContain('đã có lần chấm');
    expect(await status(sent.body.request.id)).toBe('pending');
    expect(await cell(person.id, work)).toBeUndefined();
    expect((await feed(person)).notifications.filter(({ kind }: any) => kind === 'request')).toHaveLength(0);
  });

  it('lịch đổi sau khi gửi đơn thì không duyệt được', async () => {
    const person = await newPerson();
    const off = addDays(today, 2);
    await schedule(person.id, off, [shifts.TOI.id]);
    const sent = await send(person, swapBody(off, addDays(today, 3)));
    await schedule(person.id, off, [], true);
    expect((await decide(sent.body.request.id, 'approve')).status).toBe(409);
  });

  it('từ chối thì lịch không đổi', async () => {
    const person = await newPerson();
    const off = addDays(today, 2);
    await schedule(person.id, off, [shifts.TOI.id]);
    const sent = await send(person, swapBody(off, addDays(today, 3)));
    await decide(sent.body.request.id, 'reject');
    expect(await cell(person.id, off)).toMatchObject({ shift_ids: [shifts.TOI.id], is_off: false });
  });

  it('ca cố định: ngày nghỉ thành Cho nghỉ thay vì quay lại ca cố định', async () => {
    const person = await newPerson('Tạp vụ');
    const off = addDays(today, 2);
    const work = addDays(today, 3);
    const fixedId = positions['Tạp vụ'].fixedShiftId;
    await schedule(person.id, work, [], true);

    const sent = await send(person, {
      type: 'shift_swap',
      offDate: off,
      offShiftId: fixedId,
      workDate: work,
      workShiftId: fixedId,
    });
    expect(sent.status).toBe(201);
    await decide(sent.body.request.id, 'approve');
    expect(await cell(person.id, off)).toMatchObject({ shift_ids: [], is_off: true });
    expect(await cell(person.id, work)).toMatchObject({ shift_ids: [fixedId], is_off: false });
  });

  it('cùng ngày cùng ca → 400', async () => {
    const person = await newPerson();
    const date = addDays(today, 2);
    await schedule(person.id, date, [shifts.TOI.id]);
    expect((await send(person, swapBody(date, date))).status).toBe(400);
  });

  it.each([
    ['ngày đã qua', () => swapBody(yesterday, addDays(today, 1))],
    ['không có ca đó', () => swapBody(addDays(today, 4), addDays(today, 5))],
  ])('%s → 400', async (_name, body) => {
    const person = await newPerson();
    expect((await send(person, body())).status).toBe(400);
  });
});

describe('đăng ký ca (EMP-12, SCH-11, SCH-12)', () => {
  const mine = async (person: Person) =>
    (await api('GET', '/app/shift-registrations', { cookie: person.session })).body.registration;
  const register = (person: Person, items: object[]) =>
    api('POST', '/app/shift-registrations', { cookie: person.session, body: { items } });
  const week = async (date: string, cookie = admin) =>
    (await api('GET', `/schedule?week=${date}`, { cookie })).body.schedule;
  const decideMany = (ids: string[], decision: string, cookie = admin) =>
    api('POST', '/schedule/registrations', { cookie, body: { ids, decision } });

  it('gửi rồi nhận: ca vào lịch, app thấy Đã xếp lịch, chỉ một thông báo gộp', async () => {
    const person = await newPerson();
    const items = [
      { date: nextMonday, shiftId: shifts.TOI.id },
      { date: addDays(nextMonday, 1), shiftId: shifts.TOI.id },
    ];
    expect((await register(person, items)).body.result).toEqual({ sent: 2, skipped: 0 });
    expect((await mine(person)).cells.map(({ state }: any) => state)).toEqual(['pending', 'pending']);

    const view = await week(nextMonday);
    const rows = view.registrations.filter(({ employeeId }: any) => employeeId === person.id);
    expect(rows).toHaveLength(2);
    expect((await week(mondayOf(today))).nextWeekRegistrations).toBeGreaterThanOrEqual(2);

    const decided = await decideMany(
      rows.map(({ id }: any) => id),
      'approve',
    );
    expect(decided.body.result).toEqual({ decided: 2, skipped: 0 });
    expect(await cell(person.id, nextMonday)).toMatchObject({ shift_ids: [shifts.TOI.id] });
    expect((await mine(person)).cells.map(({ state }: any) => state)).toEqual(['scheduled', 'scheduled']);
    const notes = (await feed(person)).notifications.filter(({ title }: any) => title.startsWith('Đăng ký'));
    expect(notes).toHaveLength(1);
  });

  it('gửi lại ô đã gửi hoặc đã có trong lịch thì bỏ qua, không tạo trùng', async () => {
    const person = await newPerson();
    await schedule(person.id, addDays(nextMonday, 2), [shifts.TOI.id]);
    const items = [{ date: nextMonday, shiftId: shifts.TOI.id }];
    await register(person, items);
    expect((await register(person, items)).status).toBe(201);
    const again = await register(person, [
      ...items,
      { date: addDays(nextMonday, 2), shiftId: shifts.TOI.id },
    ]);
    expect(again.body.result).toEqual({ sent: 0, skipped: 2 });
    expect(await sql`select 1 from requests where employee_id = ${person.id}`).toHaveLength(1);
  });

  it('bấm gửi hai lần cùng lúc vẫn chỉ có một đơn', async () => {
    const person = await newPerson();
    const items = [{ date: nextMonday, shiftId: shifts.TOI.id }];
    await Promise.all([register(person, items), register(person, items)]);
    expect(await sql`select 1 from requests where employee_id = ${person.id}`).toHaveLength(1);
  });

  it('từ chối thì lịch không đổi, ô chọn lại được', async () => {
    const person = await newPerson();
    await register(person, [{ date: nextMonday, shiftId: shifts.TOI.id }]);
    const { registrations } = await week(nextMonday);
    const ids = registrations
      .filter(({ employeeId }: any) => employeeId === person.id)
      .map(({ id }: any) => id);
    await decideMany(ids, 'reject');
    expect(await cell(person.id, nextMonday)).toBeUndefined();
    expect((await mine(person)).cells).toHaveLength(0);
  });

  it('Hộp việc có loại riêng; duyệt ở đó cũng ghi lịch; không giữ người đó ở chưa sẵn sàng', async () => {
    const person = await newPerson();
    const date = addDays(today, 8);
    const within = mondayOf(date) === nextMonday ? date : nextMonday;
    await register(person, [{ date: within, shiftId: shifts.TOI.id }]);
    const period = within.slice(0, 7);
    const { inbox } = (await api('GET', `/inbox?period=${period}`, { cookie: admin })).body;
    const item = inbox.items.find((row: any) => row.employeeId === person.id);
    expect(item).toMatchObject({ kind: 'dang_ky', kindLabel: 'Đăng ký ca' });

    const { payroll } = (await api('GET', `/payroll?period=${period}`, { cookie: admin })).body;
    expect(payroll.employees.find((row: any) => row.id === person.id).issues).toBe(0);

    await decide(item.requestId, 'approve');
    expect(await cell(person.id, within)).toMatchObject({ shift_ids: [shifts.TOI.id] });
  });

  it('Quản lý nhóm không nhận được đăng ký của người ngoài nhóm', async () => {
    const person = await newPerson();
    await register(person, [{ date: nextMonday, shiftId: shifts.TOI.id }]);
    const { registrations } = await week(nextMonday);
    const ids = registrations
      .filter(({ employeeId }: any) => employeeId === person.id)
      .map(({ id }: any) => id);
    const result = await decideMany(ids, 'approve', manager);
    expect(result.body.result).toEqual({ decided: 0, skipped: 1 });
    expect(await cell(person.id, nextMonday)).toBeUndefined();
  });

  it('ca cố định không đăng ký được', async () => {
    const person = await newPerson('Tạp vụ');
    expect(await mine(person)).toBeNull();
    const result = await register(person, [{ date: nextMonday, shiftId: positions['Tạp vụ'].fixedShiftId }]);
    expect(result.status).toBe(409);
  });

  it('chỉ đăng ký tuần sau và ca của mình', async () => {
    const person = await newPerson();
    expect((await register(person, [{ date: today, shiftId: shifts.TOI.id }])).status).toBe(400);
    const foreign = positions['Tạp vụ'].fixedShiftId;
    expect((await register(person, [{ date: nextMonday, shiftId: foreign }])).status).toBe(400);
  });
});
