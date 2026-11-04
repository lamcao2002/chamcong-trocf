import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, sql, publishCells } from './helpers';

let admin: string;
let manager: string;
let positions: Record<string, any>;
let shifts: Record<string, any>;
let yesterday: string;
let tomorrow: string;

type Employee = { id: string; session: string };

const newEmployee = async (overrides: object = {}, position = 'Phục vụ'): Promise<Employee> => {
  const body = employeeBody({ positionId: positions[position].id, onboardDate: '2026-01-01', ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, session: await login(body.email, 'app', COMPANY, pin) };
};

const schedule = (employeeId: string, date: string, shiftIds: string[]) =>
  publishCells(admin, [{ employeeId, date, shiftIds, isOff: false }]);

const send = (session: string, body: object) => api('POST', '/app/requests', { cookie: session, body });
const decide = (id: string, body: object, cookie = admin) =>
  api('POST', `/requests/${id}/decide`, { cookie, body });
const balance = async (session: string) =>
  (await api('GET', '/app/requests', { cookie: session })).body.balance;

const leave = (fromDate: string, toDate = fromDate, leaveType = 'annual') => ({
  type: 'leave',
  leaveType,
  fromDate,
  toDate,
  reason: 'Việc gia đình',
});

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, true from employees where id = ${employeeId}`;

const record = async (employeeId: string, date = yesterday) =>
  (
    await sql`select status, cong::float as cong, worked_min, ot_proposed, ot_approved, ot_state
    from day_records where employee_id = ${employeeId} and date = ${date}`
  )[0]!;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positionRows = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positions = Object.fromEntries(positionRows.map((row: any) => [row.name, row]));
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
  yesterday = addDays(vietnamToday(), -1);
  tomorrow = addDays(vietnamToday(), 1);
});

afterAll(async () => {
  await sql.end();
});

describe('đơn nghỉ phép (US29)', () => {
  it('cần phiên app', async () => {
    expect((await api('GET', '/app/requests')).status).toBe(401);
    expect((await api('POST', '/app/requests', { cookie: admin, body: leave(tomorrow) })).status).toBe(401);
  });

  it('ca thường trừ 1 ngày, ca ghép trừ 0,5, đơn chờ giữ chỗ', async () => {
    const { id, session } = await newEmployee();
    const start = (await balance(session)).remaining;
    await schedule(id, tomorrow, [shifts.SANG.id]);
    const created = await send(session, leave(tomorrow));
    expect(created.status).toBe(201);
    expect(created.body.request.payload).toMatchObject({ leaveType: 'annual', days: 0.5 });
    expect((await balance(session)).remaining).toBe(start - 0.5);
  });

  it('ca thường cả ngày trừ 1, hai ca ghép một ngày trừ 1', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id, shifts.CHIEU.id]);
    expect((await send(session, leave(tomorrow))).body.request.payload.days).toBe(1);
  });

  it('ngày chưa có ca không xin được, kể cả nghỉ ốm', async () => {
    const { session } = await newEmployee();
    const result = await send(session, leave(tomorrow));
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('chưa có ca');
    expect((await send(session, leave(tomorrow, tomorrow, 'sick'))).status).toBe(400);
  });

  it('vượt phép còn lại không gửi được, đã trừ đơn chờ; nghỉ ốm không giới hạn', async () => {
    const position = positions['Phục vụ'];
    const { id, session } = await newEmployee({
      payOverride: { payType: position.payType, payAmount: position.payAmount, leaveDays: 1 },
    });
    const days = [1, 2, 3].map((offset) => addDays(vietnamToday(), offset));
    for (const day of days) await schedule(id, day, [shifts.SANG.id, shifts.CHIEU.id]);

    expect((await send(session, leave(days[0]!))).status).toBe(201);
    const over = await send(session, leave(days[1]!));
    expect(over.status).toBe(400);
    expect(over.body.fields.toDate).toContain('Vượt phép');
    expect((await send(session, leave(days[2]!, days[2]!, 'sick'))).status).toBe(201);
  });

  it('trùng khoảng ngày với đơn đang có bị chặn', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id]);
    await send(session, leave(tomorrow));
    expect((await send(session, leave(tomorrow, tomorrow, 'sick'))).status).toBe(409);
  });

  it('từ ngày sau đến ngày, thiếu lý do thì 400', async () => {
    const { session } = await newEmployee();
    expect((await send(session, leave(tomorrow, yesterday))).status).toBe(400);
    expect((await send(session, { ...leave(tomorrow), reason: '' })).status).toBe(400);
    expect((await send(session, { ...leave(tomorrow), leaveType: 'khac' })).status).toBe(400);
  });

  it('duyệt thì ngày thành nghỉ phép, hết vắng; ca cố định được đủ công', async () => {
    const { id, session } = await newEmployee({}, 'Tạp vụ');
    const created = await send(session, leave(yesterday));
    expect(created.status).toBe(201);
    expect((await decide(created.body.request.id, { decision: 'approve' })).status).toBe(200);
    expect(await record(id)).toMatchObject({ status: 'nghi_phep', cong: 1 });
  });
});

describe('đơn quên chấm (US30)', () => {
  it('duyệt xong thêm lần chấm tổng hợp và tính lại', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '06:59');
    await schedule(id, yesterday, [shifts.SANG.id]);
    expect(await record(id)).toMatchObject({ status: 'thieu_gio', cong: 0 });

    const created = await send(session, {
      type: 'forgot',
      date: yesterday,
      shiftId: shifts.SANG.id,
      inTime: '',
      outTime: '12:05',
      reason: 'Quên bấm khi về',
    });
    expect(created.status).toBe(201);
    expect((await record(id)).status).toBe('thieu_gio');

    await decide(created.body.request.id, { decision: 'approve' });
    expect(await record(id)).toMatchObject({ status: 'du', cong: 1, worked_min: 300 });
    const [log] = await sql`select synthetic, source_request_id, in_zone from attendance_logs
      where employee_id = ${id} and synthetic`;
    expect(log).toMatchObject({ synthetic: true, source_request_id: created.body.request.id, in_zone: null });
  });

  it('thiếu cả hai giờ, ngày tương lai, ca không được làm đều bị chặn', async () => {
    const { session } = await newEmployee();
    const body = {
      type: 'forgot',
      date: yesterday,
      shiftId: shifts.SANG.id,
      inTime: '07:00',
      outTime: '',
      reason: 'Quên',
    };
    expect((await send(session, { ...body, inTime: '' })).status).toBe(400);
    expect((await send(session, { ...body, date: tomorrow })).status).toBe(400);
    expect((await send(session, { ...body, shiftId: shifts.CA1.id })).status).toBe(400);
  });

  it('từ chối thì không thêm lần chấm', async () => {
    const { id, session } = await newEmployee();
    const { request } = (
      await send(session, {
        type: 'forgot',
        date: yesterday,
        shiftId: shifts.SANG.id,
        inTime: '07:00',
        outTime: '12:00',
        reason: 'Quên',
      })
    ).body;
    await decide(request.id, { decision: 'reject', note: 'Không có mặt' });
    expect(await sql`select 1 from attendance_logs where employee_id = ${id}`).toHaveLength(0);
  });
});

describe('đơn làm thêm (US31)', () => {
  it('duyệt xong, phần trong khung đơn được duyệt sẵn, phần vượt chờ duyệt (T15)', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '17:00');
    await punch(id, yesterday, 'out', '23:38');
    await schedule(id, yesterday, [shifts.TOI.id]);
    expect(await record(id)).toMatchObject({ ot_proposed: 98, ot_approved: 0 });

    const { request } = (
      await send(session, {
        type: 'overtime',
        date: yesterday,
        when: 'after',
        from: '22:00',
        to: '23:00',
        reason: 'Dọn kho',
      })
    ).body;
    await decide(request.id, { decision: 'approve' });
    expect(await record(id)).toMatchObject({ ot_proposed: 98, ot_approved: 60, ot_state: 'cho_duyet' });
  });
});

describe('nút Duyệt sau khi đơn làm thêm đã duyệt một phần', () => {
  it('gửi con số tổng thì không làm mất phần đã duyệt sẵn', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '17:00');
    await punch(id, yesterday, 'out', '23:38');
    await schedule(id, yesterday, [shifts.TOI.id]);
    const { request } = (
      await send(session, {
        type: 'overtime',
        date: yesterday,
        when: 'after',
        from: '22:00',
        to: '23:00',
        reason: 'Dọn kho',
      })
    ).body;
    await decide(request.id, { decision: 'approve' });

    const { inbox } = (await api('GET', `/inbox?period=${yesterday.slice(0, 7)}`, { cookie: admin })).body;
    const item = inbox.items.find((row: any) => row.employeeId === id && row.kind === 'ot_cho');
    expect(item.suggestion.label).toBe('Duyệt 38 phút');
    expect(item.otProposed).toBe(98);
    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: item.otProposed },
    });
    expect(await record(id)).toMatchObject({ ot_approved: 98, ot_state: 'da_duyet' });
  });
});

describe('quyết định đơn (US33)', () => {
  it('từ chối có lý do, nhân viên thấy trạng thái, không quyết định lại được', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id]);
    const { request } = (await send(session, leave(tomorrow))).body;
    const before = await auditCount('request.decide');

    expect((await decide(request.id, { decision: 'reject', note: 'Thiếu người' })).status).toBe(200);
    expect(await auditCount('request.decide')).toBe(before + 1);
    const mine = (await api('GET', '/app/requests', { cookie: session })).body.requests;
    expect(mine[0]).toMatchObject({ status: 'rejected', rejectNote: 'Thiếu người' });
    expect((await decide(request.id, { decision: 'approve' })).status).toBe(409);
  });

  it('đơn từ chối trả lại phép', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id]);
    const start = (await balance(session)).remaining;
    const { request } = (await send(session, leave(tomorrow))).body;
    await decide(request.id, { decision: 'reject' });
    expect((await balance(session)).remaining).toBe(start);
  });

  it('đơn hiện ở Hộp việc đúng người, Quản lý nhóm không quyết định được đơn ngoài phạm vi', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id]);
    const { request } = (await send(session, leave(tomorrow))).body;

    const { inbox } = (await api('GET', `/inbox?period=${tomorrow.slice(0, 7)}`, { cookie: admin })).body;
    const item = inbox.items.find(({ requestId }: any) => requestId === request.id);
    expect(item).toMatchObject({ kind: 'don', employeeId: id });
    expect(item.description).toContain('Phép năm');
    expect((await decide(request.id, { decision: 'approve' }, manager)).status).toBe(404);
    expect(
      (
        await api('POST', `/requests/${request.id}/decide`, {
          cookie: session,
          body: { decision: 'approve' },
        })
      ).status,
    ).toBe(401);
  });

  it('duyệt đơn trong kỳ đã công bố làm kỳ cần công bố lại', async () => {
    const { id, session } = await newEmployee();
    await schedule(id, tomorrow, [shifts.SANG.id]);
    await schedule(id, yesterday, [shifts.SANG.id]);
    const { request } = (await send(session, leave(yesterday))).body;
    const [period] =
      await sql`insert into payroll_periods (company_id, period_key, from_date, to_date, published)
      select company_id, ${`RQ${Date.now()}`}, ${yesterday}, ${yesterday}, true from employees where id = ${id} returning id`;
    try {
      expect((await decide(request.id, { decision: 'approve' })).status).toBe(200);
      expect((await sql`select stale from payroll_periods where id = ${period!.id}`)[0]!.stale).toBe(true);
    } finally {
      await sql`delete from payroll_periods where id = ${period!.id}`;
    }
  });

  it('ID sai trả 404, quyết định sai trả 400', async () => {
    expect((await decide('abc', { decision: 'approve' })).status).toBe(404);
    expect((await decide('00000000-0000-0000-0000-000000000000', { decision: 'approve' })).status).toBe(404);
    expect((await decide('00000000-0000-0000-0000-000000000000', { decision: 'x' })).status).toBe(400);
  });
});

describe('giải trình (US32)', () => {
  const explain = (session: string, body: object) =>
    api('POST', '/app/explanations', { cookie: session, body });

  it('hiện đề xuất Duyệt 1 công ở Hộp việc, duyệt thì đóng, gửi lại thì cập nhật', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '06:59');
    await schedule(id, yesterday, [shifts.SANG.id]);

    const body = { date: yesterday, shiftId: shifts.SANG.id, reason: 'Ra 12:05 nhưng quên bấm' };
    expect((await explain(session, body)).status).toBe(201);
    expect((await explain(session, { ...body, reason: 'Ra 12:10 nhưng quên bấm nút' })).status).toBe(201);
    const rows = await sql`select reason, status from explanations where employee_id = ${id}`;
    expect(rows).toEqual([{ reason: 'Ra 12:10 nhưng quên bấm nút', status: 'pending' }]);

    const { inbox } = (await api('GET', `/inbox?period=${yesterday.slice(0, 7)}`, { cookie: admin })).body;
    const item = inbox.items.find((row: any) => row.employeeId === id);
    expect(item.suggestion.label).toBe('Duyệt 1 công');
    expect(item.evidence).toContain('Giải trình: Ra 12:10 nhưng quên bấm nút');

    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.SANG.id, approveMissing: true },
    });
    expect(await sql`select status from explanations where employee_id = ${id}`).toEqual([
      { status: 'approved' },
    ]);
    expect(await record(id)).toMatchObject({ cong: 1 });
  });

  it('giải trình cho dòng không gắn ca, gửi lại không trùng', async () => {
    const { id, session } = await newEmployee();
    const body = { date: yesterday, shiftId: null, reason: 'Chấm nhầm giờ hôm qua' };
    expect((await explain(session, body)).status).toBe(201);
    expect((await explain(session, body)).status).toBe(201);
    expect(await sql`select 1 from explanations where employee_id = ${id}`).toHaveLength(1);
  });

  it('lý do dưới 10 ký tự, ngày tương lai bị chặn', async () => {
    const { session } = await newEmployee();
    expect((await explain(session, { date: yesterday, shiftId: null, reason: 'ngắn' })).status).toBe(400);
    expect(
      (await explain(session, { date: tomorrow, shiftId: null, reason: 'đủ mười ký tự rồi' })).status,
    ).toBe(400);
  });
});
