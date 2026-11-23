import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, publishCells, sql, unique } from './helpers';

let admin: string;
let manager: string;
let managerId: string;
let today: string;
let yesterday: string;
let toi: { id: string; code: string };
let positionId: string;

type Staff = { id: string; session: string };

const newStaff = async (overrides: object = {}): Promise<Staff> => {
  const body = employeeBody({ onboardDate: '2026-01-01', ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, session: await login(body.email, 'app', COMPANY, pin) };
};

const addRule = async (scars: number, amount: number) => {
  const saved = await api('POST', '/penalty-rules', {
    cookie: admin,
    body: { name: `Vi phạm ${unique('')}`, scars, amount, note: null },
  });
  expect(saved.status).toBe(201);
  return saved.body.rule as { id: string; name: string; scars: number; amount: number };
};

const NOTE = 'Quản lý thấy lúc 7:20, camera quầy có ghi lại';

const penalize = (employeeId: string, body: object = {}, cookie = manager) =>
  api('POST', '/penalties', {
    cookie,
    body: {
      employeeId,
      date: today,
      ruleId: null,
      otherReason: 'Khác',
      scars: 1,
      amount: 0,
      note: NOTE,
      ...body,
    },
  });

const mine = async ({ session }: Staff, period = '') =>
  (await api('GET', `/app/penalties${period ? `?period=${period}` : ''}`, { cookie: session })).body
    .penalties;

const notificationsOf = async (id: string) =>
  (
    await sql`select title from notifications where employee_id = ${id} and kind = 'penalty' order by created_at`
  ).map(({ title }) => title as string);

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  managerId = (await sql`select id from employees where email = 'minh@phonho.vn'`)[0]!.id;
  today = vietnamToday();
  yesterday = addDays(today, -1);
  toi = (await api('GET', '/shifts', { cookie: admin })).body.shifts.find(({ code }: any) => code === 'TOI');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find(({ name }: any) => name === 'Phục vụ').id;
  expect((await api('PATCH', '/company', { cookie: admin, body: { scarThreshold: 3 } })).status).toBe(200);
});

afterAll(async () => {
  await api('PATCH', '/company', { cookie: admin, body: { scarThreshold: null } });
  await sql.end();
});

const punch = (employeeId: string, type: 'in' | 'out', clock: string) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${yesterday}T${clock}:00+07:00`)}, ${type}, true from employees where id = ${employeeId}`;

/** Ca tối hôm qua của một người mới, với các lần chấm cho trước. */
const shiftYesterday = async (punches: ['in' | 'out', string][]) => {
  const staff = await newStaff({ managerId, positionId });
  for (const [type, clock] of punches) await punch(staff.id, type, clock);
  const cells = [{ employeeId: staff.id, date: yesterday, shiftIds: [toi.id], isOff: false }];
  expect((await publishCells(admin, cells)).status).toBe(200);
  return staff;
};

/** Lỗi chấm công chưa xử lý của một người, ở kỳ chứa hôm qua. */
const issuesOf = async (employeeId: string, field: 'issues' | 'dismissed' = 'issues') => {
  let list = (await api('GET', '/penalties', { cookie: manager })).body.penalties;
  if (yesterday < list.period.from) {
    list = (await api('GET', `/penalties?period=${list.previousKey}`, { cookie: manager })).body.penalties;
  }
  return (list[field] as any[]).filter((row) => row.employeeId === employeeId);
};

const attached = (employeeId: string, issue: string, body: object = {}) =>
  penalize(employeeId, { date: yesterday, shiftId: toi.id, issue, ...body });

describe('quy định phạt', () => {
  it('quy định có cả sẹo và tiền; không có số nào thì 400; quản lý chỉ xem', async () => {
    const rule = await addRule(1, 50_000);
    expect(rule).toMatchObject({ scars: 1, amount: 50_000 });
    const listed = (await api('GET', '/penalty-rules', { cookie: manager })).body.rules;
    expect(listed.some(({ id }: any) => id === rule.id)).toBe(true);

    const empty = await api('POST', '/penalty-rules', {
      cookie: admin,
      body: { name: 'Không phạt gì', scars: 0, amount: 0, note: null },
    });
    expect(empty.status).toBe(400);
    expect(empty.body.fields).toHaveProperty('scars');

    const byManager = await api('POST', '/penalty-rules', {
      cookie: manager,
      body: { name: 'Quản lý thêm', scars: 1, amount: 0, note: null },
    });
    expect(byManager.status).toBe(403);
  });

  it('xoá quy định đã dùng thì lưu trữ, phiếu cũ giữ tên; chưa dùng thì xoá hẳn', async () => {
    const used = await addRule(1, 0);
    const unused = await addRule(0, 20_000);
    const staff = await newStaff({ managerId });
    expect((await penalize(staff.id, { ruleId: used.id, otherReason: null })).status).toBe(201);

    expect((await api('DELETE', `/penalty-rules/${used.id}`, { cookie: admin })).body).toMatchObject({
      archived: true,
    });
    expect((await api('DELETE', `/penalty-rules/${unused.id}`, { cookie: admin })).body).toMatchObject({
      archived: false,
    });
    const listed = (await api('GET', '/penalty-rules', { cookie: admin })).body.rules.map(
      ({ id }: any) => id,
    );
    expect(listed).not.toContain(used.id);
    expect(await sql`select 1 from penalty_rules where id = ${unused.id}`).toHaveLength(0);
    expect((await mine(staff)).penalties[0].ruleName).toBe(used.name);

    expect((await penalize(staff.id, { ruleId: used.id, otherReason: null })).status).toBe(400);
  });
});

describe('phạt nhân viên', () => {
  it('quản lý phạt người mình quản lý: nhân viên thấy sẹo, tiền, ghi chú; có thông báo và nhật ký', async () => {
    const rule = await addRule(2, 30_000);
    const staff = await newStaff({ managerId });
    const before = await auditCount('penalty.create');

    const saved = await penalize(staff.id, { ruleId: rule.id, otherReason: null, scars: 1, amount: 30_000 });
    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({ scars: 1, overThreshold: false });
    expect(await auditCount('penalty.create')).toBe(before + 1);

    const view = await mine(staff);
    expect(view).toMatchObject({
      scars: 1,
      amount: 30_000,
      count: 1,
      scarThreshold: 3,
      overThreshold: false,
    });
    expect(view.penalties[0]).toMatchObject({ ruleName: rule.name, note: NOTE, byName: expect.any(String) });
    expect(view.penalties[0]).not.toHaveProperty('byId');
    expect(await notificationsOf(staff.id)).toEqual([`Bạn bị phạt: ${rule.name}`]);
  });

  it('mục Khác cần lý do; thiếu bằng chứng, không có số, ngày tương lai hoặc quá xa → 400', async () => {
    const staff = await newStaff({ managerId });
    const other = await penalize(staff.id, { otherReason: 'Bỏ ca không báo' });
    expect(other.status).toBe(201);
    expect(other.body.penalty.ruleName).toBe('Khác: Bỏ ca không báo');

    for (const [body, field] of [
      [{ otherReason: null }, 'otherReason'],
      [{ note: 'trễ' }, 'note'],
      [{ scars: 0, amount: 0 }, 'scars'],
      [{ date: addDays(today, 1) }, 'date'],
      [{ date: addDays(today, -61) }, 'date'],
    ] as const) {
      const response = await penalize(staff.id, body);
      expect(response.status, field).toBe(400);
      expect(response.body.fields, field).toHaveProperty(field);
    }
  });

  it('người ngoài nhóm và chính mình → 404, nhân viên không vào được API quản lý', async () => {
    const outsider = await newStaff();
    expect((await penalize(outsider.id)).status).toBe(404);
    expect((await penalize(managerId)).status).toBe(404);
    const staff = await newStaff({ managerId });
    expect((await api('GET', '/penalties', { cookie: staff.session })).status).toBe(401);
  });

  it('đủ ngưỡng chỉ báo một lần; trang quản lý gắn cờ; huỷ thì tổng giảm, phiếu còn, nhân viên được báo', async () => {
    const staff = await newStaff({ managerId });
    const first = await penalize(staff.id, { scars: 2 });
    expect((await penalize(staff.id, { scars: 1 })).body).toMatchObject({ scars: 3, overThreshold: true });
    await penalize(staff.id, { scars: 1 });
    expect((await notificationsOf(staff.id)).filter((title) => title.includes('sẹo trong kỳ'))).toEqual([
      'Bạn đã có 3 sẹo trong kỳ này',
    ]);

    const list = (await api('GET', '/penalties', { cookie: manager })).body.penalties;
    expect(list.people.find(({ employeeId }: any) => employeeId === staff.id)).toMatchObject({
      scars: 4,
      overThreshold: true,
    });
    expect(list.staff.some(({ id }: any) => id === staff.id)).toBe(true);
    expect(list.staff.some(({ id }: any) => id === managerId)).toBe(false);

    const id = first.body.penalty.id;
    expect(
      (await api('POST', `/penalties/${id}/cancel`, { cookie: manager, body: { reason: '' } })).status,
    ).toBe(400);
    const cancelled = await api('POST', `/penalties/${id}/cancel`, {
      cookie: manager,
      body: { reason: 'Nhầm người' },
    });
    expect(cancelled.status).toBe(200);
    expect(
      (await api('POST', `/penalties/${id}/cancel`, { cookie: admin, body: { reason: 'Lần nữa' } })).status,
    ).toBe(409);

    const view = await mine(staff);
    expect(view).toMatchObject({ scars: 2, count: 2, overThreshold: false });
    expect(view.penalties).toHaveLength(3);
    expect(view.penalties.find((row: any) => row.id === id)).toMatchObject({ cancelReason: 'Nhầm người' });
    expect((await notificationsOf(staff.id)).at(-1)).toMatch(/^Đã huỷ phạt/);
  });

  it('chỉ người đã phạt hoặc Quản trị viên huỷ được', async () => {
    const staff = await newStaff({ managerId });
    const byAdmin = (await penalize(staff.id, {}, admin)).body.penalty.id;
    const cancel = (cookie: string) =>
      api('POST', `/penalties/${byAdmin}/cancel`, { cookie, body: { reason: 'Không đúng' } });
    expect((await cancel(manager)).status).toBe(403);
    expect((await cancel(admin)).status).toBe(200);
  });

  it('sẹo theo kỳ lương: kỳ trước không cộng vào kỳ này, nhân viên chọn được kỳ cũ', async () => {
    const staff = await newStaff({ managerId });
    // 40 ngày trước chắc chắn ở kỳ trước dù ngày chốt là bao nhiêu, và còn trong 60 ngày cho phạt
    const earlier = await penalize(staff.id, { date: addDays(today, -40), scars: 2 });
    expect(earlier.status).toBe(201);
    await penalize(staff.id, { scars: 1 });

    const now = await mine(staff);
    expect(now.scars).toBe(1);
    const oldKey = earlier.body.penalty.periodKey;
    expect(now.periods.map(({ key }: any) => key)).toEqual([now.period.key, oldKey]);
    expect((await mine(staff, oldKey)).scars).toBe(2);
  });

  it('nhân viên chỉ thấy phiếu của mình; kỳ sai → 400', async () => {
    const one = await newStaff({ managerId });
    const two = await newStaff({ managerId });
    await penalize(one.id);
    expect((await mine(two)).penalties).toEqual([]);
    expect((await api('GET', '/app/penalties?period=2026-13', { cookie: one.session })).status).toBe(400);
  });
});

describe('phạt gắn chấm công', () => {
  it('đi muộn hiện trong gợi ý; phạt gắn lỗi lưu bằng chứng, lỗi biến khỏi gợi ý; huỷ thì hiện lại', async () => {
    const staff = await shiftYesterday([
      ['in', '17:20'],
      ['out', '22:00'],
    ]);
    const [late] = await issuesOf(staff.id);
    expect(late).toMatchObject({
      shiftId: toi.id,
      issue: 'muon',
      shiftCode: 'TOI',
      shiftHours: '17:00–22:00',
    });
    expect(late.issueLabel).toMatch(/^Muộn \d+ phút$/);

    const day = (
      await api('GET', `/penalties/attendance?employeeId=${staff.id}&date=${yesterday}`, { cookie: manager })
    ).body.shifts;
    expect(day[0].issues).toEqual([{ issue: 'muon', label: late.issueLabel, penalized: false }]);

    const saved = await attached(staff.id, 'muon');
    expect(saved.status).toBe(201);
    expect(saved.body.penalty).toMatchObject({
      shiftId: toi.id,
      issue: 'muon',
      evidence: { shiftCode: 'TOI', shiftHours: '17:00–22:00', issueLabel: late.issueLabel },
    });
    expect(await issuesOf(staff.id)).toEqual([]);
    expect((await attached(staff.id, 'muon')).status).toBe(409);
    expect((await mine(staff, saved.body.penalty.periodKey)).penalties[0].evidence).toMatchObject({
      issueLabel: late.issueLabel,
    });

    const id = saved.body.penalty.id;
    await api('POST', `/penalties/${id}/cancel`, { cookie: manager, body: { reason: 'Nhầm ca' } });
    expect(await issuesOf(staff.id)).toHaveLength(1);
  });

  it('muộn đã được tha thì không còn lỗi, gắn vào phiếu → 400', async () => {
    const staff = await shiftYesterday([
      ['in', '17:20'],
      ['out', '22:00'],
    ]);
    const waived = await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: staff.id, date: yesterday, shiftId: toi.id, waiveLate: true },
    });
    expect(waived.status).toBeLessThan(300);
    expect(await issuesOf(staff.id)).toEqual([]);
    const response = await attached(staff.id, 'muon');
    expect(response.status).toBe(400);
    expect(response.body.fields).toHaveProperty('issue');
  });

  it('quên chấm ra đã duyệt công vẫn phạt được', async () => {
    const staff = await shiftYesterday([['in', '17:00']]);
    expect((await issuesOf(staff.id)).map(({ issue }) => issue)).toEqual(['quen_ra']);
    const approved = await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: staff.id, date: yesterday, shiftId: toi.id, approveMissing: true },
    });
    expect(approved.status).toBeLessThan(300);
    expect((await issuesOf(staff.id)).map(({ issue }) => issue)).toEqual(['quen_ra']);
    const saved = await attached(staff.id, 'quen_ra');
    expect(saved.status).toBe(201);
    expect(saved.body.penalty.evidence).toMatchObject({ outAt: null, issueLabel: 'Quên chấm ra' });
  });

  it('Bỏ qua ẩn lỗi khỏi gợi ý, Khôi phục đưa về; lỗi không có thật → 400; người ngoài nhóm → 404', async () => {
    const staff = await shiftYesterday([['out', '22:00']]);
    const body = { employeeId: staff.id, date: yesterday, shiftId: toi.id, issue: 'quen_vao' };
    const before = await auditCount('penalty.dismiss');
    const dismissed = await api('POST', '/penalty-dismissals', { cookie: manager, body });
    expect(dismissed.status).toBe(201);
    expect(await auditCount('penalty.dismiss')).toBe(before + 1);
    expect((await api('POST', '/penalty-dismissals', { cookie: manager, body })).status).toBe(409);
    expect(await issuesOf(staff.id)).toEqual([]);
    const [hidden] = await issuesOf(staff.id, 'dismissed');
    expect(hidden).toMatchObject({ issue: 'quen_vao', dismissalId: dismissed.body.dismissal.id });

    expect(
      (await api('DELETE', `/penalty-dismissals/${hidden.dismissalId}`, { cookie: manager })).status,
    ).toBe(200);
    expect(await issuesOf(staff.id)).toHaveLength(1);

    expect(
      (await api('POST', '/penalty-dismissals', { cookie: manager, body: { ...body, issue: 'muon' } }))
        .status,
    ).toBe(400);
    const outsider = await newStaff();
    const foreign = { ...body, employeeId: outsider.id };
    expect((await api('POST', '/penalty-dismissals', { cookie: manager, body: foreign })).status).toBe(404);
    expect(
      (
        await api('GET', `/penalties/attendance?employeeId=${outsider.id}&date=${yesterday}`, {
          cookie: manager,
        })
      ).status,
    ).toBe(404);
  });

  it('gửi ca mà thiếu loại lỗi → 400', async () => {
    const staff = await newStaff({ managerId });
    const response = await penalize(staff.id, { shiftId: toi.id });
    expect(response.status).toBe(400);
    expect(response.body.fields).toHaveProperty('issue');
  });

  it('Bảng công: drawer ngày có phiếu phạt và quy định; ô Theo tuần đếm phiếu còn hiệu lực', async () => {
    const staff = await shiftYesterday([
      ['in', '17:20'],
      ['out', '22:00'],
    ]);
    const dayUrl = `/penalties/day?employeeId=${staff.id}&date=${yesterday}`;
    const empty = (await api('GET', dayUrl, { cookie: manager })).body;
    expect(empty).toMatchObject({ canPenalize: true, penalties: [] });
    expect(empty.rules.length).toBeGreaterThan(0);

    const saved = await attached(staff.id, 'muon');
    await penalize(staff.id, { date: yesterday });
    const day = (await api('GET', dayUrl, { cookie: manager })).body;
    expect(day.penalties).toHaveLength(2);
    expect(day.penalties[0]).toMatchObject({ cancellable: true });

    const key = saved.body.penalty.periodKey;
    const cookie = { cookie: manager };
    const { weeks } = (await api('GET', `/timesheet?period=${key}`, cookie)).body.timesheet;
    const week = weeks.find(({ from, to }: any) => from <= yesterday && yesterday <= to);
    const read = async () =>
      (
        await api('GET', `/timesheet?period=${key}&view=week&week=${week.from}`, cookie)
      ).body.timesheet.employees
        .find(({ id }: any) => id === staff.id)
        .weekDays.find(({ date }: any) => date === yesterday).penalties;
    expect(await read()).toBe(2);
    await api('POST', `/penalties/${saved.body.penalty.id}/cancel`, {
      cookie: manager,
      body: { reason: 'Nhầm' },
    });
    expect(await read()).toBe(1);

    const outsider = await newStaff();
    expect(
      (await api('GET', `/penalties/day?employeeId=${outsider.id}&date=${yesterday}`, { cookie: manager }))
        .status,
    ).toBe(404);
  });
});
