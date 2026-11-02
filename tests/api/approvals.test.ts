import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { api, auditCount, employeeBody, login, sql } from './helpers';

let admin: string;
let hr: string;
let manager: string;
let positionId: string;
let shifts: Record<string, any>;
let yesterday: string;

const newEmployee = async (overrides: object = {}) => {
  const body = employeeBody({ positionId, onboardDate: '2026-01-01', ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  return created.body.employee.id as string;
};

const schedule = (employeeId: string, date: string, shiftIds: string[]) =>
  api('PUT', '/schedule', { cookie: admin, body: { cells: [{ employeeId, date, shiftIds, isOff: false }] } });

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string, inZone = true) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, ${inZone} from employees where id = ${employeeId}`;

/** Ca tối vào ngoài vùng, ra muộn: một dòng ngày công mang hai việc. */
const dayWithTwoIssues = async () => {
  const id = await newEmployee();
  await punch(id, yesterday, 'in', '17:00', false);
  await punch(id, yesterday, 'out', '23:00');
  await schedule(id, yesterday, [shifts.TOI.id]);
  return id;
};

const approve = (employeeId: string, decision: object, cookie = admin) =>
  api('POST', '/approvals', {
    cookie,
    body: { employeeId, date: yesterday, shiftId: shifts.TOI.id, ...decision },
  });

const inboxItems = async (employeeId: string) => {
  const { inbox } = (await api('GET', `/inbox?period=${yesterday.slice(0, 7)}`, { cookie: admin })).body;
  return inbox.items.filter((item: any) => item.employeeId === employeeId);
};

const record = async (employeeId: string, date = yesterday) =>
  (
    await sql`select status, cong::float as cong, flags, needs_review, ot_approved, ot_state
    from day_records where employee_id = ${employeeId} and date = ${date}`
  )[0]!;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  hr = await login('quynh@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positions = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positionId = positions.find((position: any) => position.name === 'Phục vụ').id;
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
  yesterday = addDays(vietnamToday(), -1);
});

afterAll(async () => {
  await sql.end();
});

describe('Hộp việc (US24)', () => {
  it('một ngày hai cờ thành hai việc, có mô tả, đề xuất, bằng chứng', async () => {
    const id = await dayWithTwoIssues();
    const items = await inboxItems(id);
    expect(items.map(({ kind }: any) => kind).sort()).toEqual(['ngoai_vung', 'ot_cho']);
    const ot = items.find(({ kind }: any) => kind === 'ot_cho');
    expect(ot.suggestion.label).toBe('Duyệt 60 phút');
    expect(ot.suggestion.why).toContain('vượt mức tối thiểu');
    expect(ot.evidence).toEqual(['Vào 17:00', 'Ra 23:00']);
    expect(ot.shiftName).toBe(shifts.TOI.name);
  });

  it('đếm khớp danh sách, chip về 0 thì không có khoá', async () => {
    const { inbox } = (await api('GET', '/inbox', { cookie: admin })).body;
    const sum = Object.values(inbox.counts as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(sum).toBe(inbox.items.length);
    expect(inbox.total).toBe(inbox.items.length);
    expect(Object.values(inbox.counts)).not.toContain(0);
  });

  it('chuyển được về kỳ trước, không đi tới kỳ chưa bắt đầu', async () => {
    const { inbox } = (await api('GET', '/inbox', { cookie: admin })).body;
    expect(inbox.nextKey).toBeNull();
    expect(inbox.previousKey < inbox.period.key).toBe(true);
    const older = (await api('GET', `/inbox?period=${inbox.previousKey}`, { cookie: admin })).body.inbox;
    expect(older.period.key).toBe(inbox.previousKey);
    expect(older.nextKey).toBe(inbox.period.key);
  });

  it('kỳ sai trả 400, Quản lý nhóm chỉ thấy người của mình', async () => {
    expect((await api('GET', '/inbox?period=2026-13', { cookie: admin })).status).toBe(400);
    const id = await dayWithTwoIssues();
    const { inbox } = (await api('GET', `/inbox?period=${yesterday.slice(0, 7)}`, { cookie: manager })).body;
    expect(inbox.items.some((item: any) => item.employeeId === id)).toBe(false);
  });

  it('khoá việc giữ nguyên sau khi tính lại, dù id dòng ngày công đổi', async () => {
    const id = await dayWithTwoIssues();
    const [before] = await sql`select id from day_records where employee_id = ${id} and date = ${yesterday}`;
    const keys = (await inboxItems(id)).map(({ key }: any) => key).sort();
    await approve(id, { approveGps: true });
    const [after] = await sql`select id from day_records where employee_id = ${id} and date = ${yesterday}`;
    expect(after!.id).not.toBe(before!.id);
    expect((await inboxItems(id)).map(({ key }: any) => key)).toEqual(
      keys.filter((key: string) => key.endsWith('ot_cho')),
    );
  });
});

describe('POST /approvals (US25, US26)', () => {
  it('quyết định sau gộp vào bản ghi đang có, không tạo dòng mới', async () => {
    const id = await dayWithTwoIssues();
    expect((await approve(id, { approveGps: true })).status).toBe(201);
    expect(await inboxItems(id)).toHaveLength(1);
    expect((await approve(id, { otMinutes: 45 })).status).toBe(201);
    expect(await inboxItems(id)).toHaveLength(0);

    const rows = await sql`select approve_gps, ot_minutes from approvals where employee_id = ${id}`;
    expect(rows).toEqual([{ approve_gps: true, ot_minutes: 45 }]);
    expect(await record(id)).toMatchObject({
      status: 'du',
      ot_approved: 45,
      ot_state: 'da_duyet',
      needs_review: false,
    });
  });

  it('ghi audit trong cùng lần duyệt', async () => {
    const id = await dayWithTwoIssues();
    const created = await auditCount('approval.create');
    const updated = await auditCount('approval.update');
    await approve(id, { approveGps: true });
    await approve(id, { otMinutes: 0 });
    expect(await auditCount('approval.create')).toBe(created + 1);
    expect(await auditCount('approval.update')).toBe(updated + 1);
  });

  it('Điều chỉnh khác: số công, null quay về theo hệ thống', async () => {
    const id = await newEmployee();
    await schedule(id, yesterday, [shifts.TOI.id]);
    expect(await record(id)).toMatchObject({ status: 'vang', cong: 0 });

    await approve(id, { congOverride: 0.5 });
    expect(await record(id)).toMatchObject({ status: 'nua_cong', cong: 0.5, needs_review: false });
    await approve(id, { congOverride: null });
    expect(await record(id)).toMatchObject({ status: 'vang', cong: 0, needs_review: true });
  });

  it('từ chối dữ liệu sai', async () => {
    const id = await newEmployee();
    const bad = async (decision: object) => expect((await approve(id, decision)).status).toBe(400);
    await bad({});
    await bad({ congOverride: 0.3 });
    await bad({ otMinutes: -1 });
    await bad({ confirmShiftId: 'abc' });
    const future = await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: addDays(vietnamToday(), 2), shiftId: null, approveGps: true },
    });
    expect(future.status).toBe(400);
  });

  it('Nhân sự không tự duyệt được, Hộp việc cũng không hiện việc của mình', async () => {
    const [self] = await sql`select id from employees where email = 'quynh@phonho.vn'`;
    await punch(self!.id, yesterday, 'in', '08:00');
    await schedule(self!.id, yesterday, [shifts.CA1.id]);
    expect((await approve(self!.id, { congOverride: 1 }, hr)).status).toBe(403);
    const { inbox } = (await api('GET', `/inbox?period=${yesterday.slice(0, 7)}`, { cookie: hr })).body;
    expect(inbox.items.some((item: any) => item.employeeId === self!.id)).toBe(false);
    expect((await approve(self!.id, { congOverride: 1 })).status).toBe(201);
  });

  it('Quản lý nhóm không duyệt được người ngoài phạm vi', async () => {
    const id = await dayWithTwoIssues();
    expect((await approve(id, { approveGps: true }, manager)).status).toBe(404);
  });

  it('nhiều người duyệt cùng lúc chỉ có một bản ghi hiệu lực', async () => {
    const id = await dayWithTwoIssues();
    const results = await Promise.all(Array.from({ length: 5 }, () => approve(id, { approveGps: true })));
    expect(results.every(({ status }) => status === 201 || status === 409)).toBe(true);
    expect(await sql`select 1 from approvals where employee_id = ${id} and revoked_at is null`).toHaveLength(
      1,
    );
  });
});

describe('DELETE /approvals/:id (US28)', () => {
  it('ngày trở về kết quả hệ thống, giữ dòng để truy vết, không hoàn duyệt hai lần', async () => {
    const id = await dayWithTwoIssues();
    const { approval } = (await approve(id, { approveGps: true, otMinutes: 60 })).body;
    expect(await inboxItems(id)).toHaveLength(0);

    expect((await api('DELETE', `/approvals/${approval.id}`, { cookie: admin })).status).toBe(200);
    expect(await inboxItems(id)).toHaveLength(2);
    expect(await sql`select revoked_at from approvals where id = ${approval.id}`).toMatchObject([
      { revoked_at: expect.any(Date) },
    ]);
    expect((await api('DELETE', `/approvals/${approval.id}`, { cookie: admin })).status).toBe(404);
  });

  it('duyệt lại sau khi hoàn duyệt tạo bản ghi mới', async () => {
    const id = await dayWithTwoIssues();
    const { approval } = (await approve(id, { approveGps: true })).body;
    await api('DELETE', `/approvals/${approval.id}`, { cookie: admin });
    expect((await approve(id, { approveGps: true })).status).toBe(201);
    expect(await sql`select 1 from approvals where employee_id = ${id}`).toHaveLength(2);
  });
});

describe('kỳ đã công bố (D10)', () => {
  it('sửa được, kỳ chuyển sang cần công bố lại', async () => {
    const id = await dayWithTwoIssues();
    const { approval } = (await approve(id, { approveGps: true })).body;
    const [period] =
      await sql`insert into payroll_periods (company_id, period_key, from_date, to_date, published)
      select company_id, ${`LOCK${Date.now()}`}, ${yesterday}, ${yesterday}, true
      from employees where id = ${id} returning id`;
    const stale = async () =>
      (await sql`select stale from payroll_periods where id = ${period!.id}`)[0]!.stale;
    const reset = () => sql`update payroll_periods set stale = false where id = ${period!.id}`;
    try {
      expect((await approve(id, { otMinutes: 60 })).status).toBe(201);
      expect(await stale()).toBe(true);

      await reset();
      expect((await api('DELETE', `/approvals/${approval.id}`, { cookie: admin })).status).toBe(200);
      expect(await stale()).toBe(true);

      await reset();
      expect((await schedule(id, yesterday, [shifts.SANG.id])).status).toBe(200);
      expect(await stale()).toBe(true);

      await reset();
      const holiday = await api('POST', '/holidays', {
        cookie: admin,
        body: { date: yesterday, name: 'Lễ' },
      });
      expect(holiday.status).toBe(201);
      expect(await stale()).toBe(true);
      await api('DELETE', `/holidays/${holiday.body.holiday.id}`, { cookie: admin });
    } finally {
      await sql`delete from payroll_periods where id = ${period!.id}`;
    }
  });

  it('tính lại ra cùng số thì không báo cần công bố lại', async () => {
    const id = await dayWithTwoIssues();
    const [period] =
      await sql`insert into payroll_periods (company_id, period_key, from_date, to_date, published)
      select company_id, ${`SAME${Date.now()}`}, ${yesterday}, ${yesterday}, true
      from employees where id = ${id} returning id`;
    try {
      expect((await schedule(id, yesterday, [shifts.TOI.id])).status).toBe(200);
      const [row] = await sql`select stale from payroll_periods where id = ${period!.id}`;
      expect(row!.stale).toBe(false);
    } finally {
      await sql`delete from payroll_periods where id = ${period!.id}`;
    }
  });
});

describe('GET /overview/today (US23)', () => {
  it('Chờ xử lý khớp Hộp việc của kỳ hiện tại', async () => {
    const [{ body: overview }, { body: inbox }] = await Promise.all([
      api('GET', '/overview/today', { cookie: admin }),
      api('GET', '/inbox', { cookie: admin }),
    ]);
    expect(overview.overview.pending).toBe(inbox.inbox.total);
    for (const field of ['onShift', 'scheduled', 'late', 'missing']) {
      expect(typeof overview.overview[field]).toBe('number');
    }
  });

  it('người vừa vào ca được tính là đang trong ca', async () => {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        hour12: false,
      }).format(),
    );
    if (hour < 1 || hour >= 22) return; // Ca thử cần nằm trọn trong ngày
    const clock = (value: number) => `${String(value).padStart(2, '0')}:00`;
    const created = await api('POST', '/shifts', {
      cookie: admin,
      body: {
        code: `OV${Date.now().toString(36).slice(-6).toUpperCase()}`,
        name: 'Ca thử',
        startTime: clock(hour - 1),
        endTime: clock(hour + 2),
        breakStart: null,
        breakEnd: null,
        calc: 'block',
        stdHours: 3,
        minFull: 150,
        minHalf: 60,
        graceMin: 5,
        minOt: 30,
        isPart: false,
        noLateCheck: false,
      },
    });
    const shiftId = created.body.shift.id;
    const body = employeeBody({ positionId, onboardDate: '2026-01-01', shiftIds: [shiftId] });
    const employee = (await api('POST', '/employees', { cookie: admin, body })).body.employee;
    const session = await login(body.email, 'app', 'PHONHO', employee.pin);
    await schedule(employee.id, vietnamToday(), [shiftId]);

    const read = async () => (await api('GET', '/overview/today', { cookie: admin })).body.overview;
    const before = await read();
    await api('POST', '/app/punch', {
      cookie: session,
      body: { type: 'in', lat: 21.02452, lng: 105.85308, accuracy: 5, chosenShiftId: shiftId },
    });
    const after = await read();
    expect(after.onShift).toBe(before.onShift + 1);
    expect(after.scheduled).toBe(before.scheduled);
    expect(after.missing).toBeLessThanOrEqual(before.missing);
  });
});

describe('duyệt hàng loạt theo đề xuất (INB-08, TS-08)', () => {
  const period = () => yesterday.slice(0, 7);
  const asBulk = (items: any[]) =>
    items.map(({ key, suggestion }) => ({ key, label: suggestion?.label ?? 'x' }));
  const bulk = (items: object[], cookie = admin) =>
    api('POST', '/approvals/bulk', { cookie, body: { period: period(), items } });
  const activeApprovals = (employeeId: string) =>
    sql`select * from approvals where employee_id = ${employeeId} and revoked_at is null`;

  it('hai việc cùng ca gộp một bản ghi, nhiều người trong một lần, Hộp việc hết việc', async () => {
    const first = await dayWithTwoIssues();
    const second = await dayWithTwoIssues();
    const items = [...(await inboxItems(first)), ...(await inboxItems(second))];
    expect(items.length).toBeGreaterThanOrEqual(4);
    const before = await auditCount('approval.create');

    const result = await bulk(asBulk(items));
    expect(result.status).toBe(201);
    expect(result.body.result).toEqual({ approved: items.length, skipped: 0 });

    expect(await inboxItems(first)).toHaveLength(0);
    expect(await inboxItems(second)).toHaveLength(0);
    expect(await activeApprovals(first)).toHaveLength(1);
    expect(await auditCount('approval.create')).toBe(before + 2);
    expect((await record(first)).needs_review).toBe(false);
  });

  it('số liệu đổi sau khi xem thì bỏ qua và báo lại, không duyệt số chưa ai thấy', async () => {
    const id = await dayWithTwoIssues();
    const items = await inboxItems(id);
    const ot = items.find((item: any) => item.kind === 'ot_cho');
    const result = await bulk([{ key: ot.key, label: 'Duyệt 1 phút' }]);
    expect(result.body.result).toEqual({ approved: 0, skipped: 1 });
    expect(await activeApprovals(id)).toHaveLength(0);
    expect(await inboxItems(id)).toHaveLength(items.length);
  });

  it('khoá lạ, việc không có đề xuất và đơn đều bị bỏ qua, phần còn lại vẫn duyệt', async () => {
    const id = await dayWithTwoIssues();
    const absent = await newEmployee();
    await schedule(absent, yesterday, [shifts.TOI.id]);
    const [vang] = await inboxItems(absent);
    expect(vang.suggestion).toBeNull();

    const [good] = await inboxItems(id);
    const result = await bulk([
      ...asBulk([good]),
      { key: vang.key, label: 'Duyệt' },
      { key: 'request|khong-co', label: 'Duyệt' },
    ]);
    expect(result.body.result).toEqual({ approved: 1, skipped: 2 });
    expect(await activeApprovals(absent)).toHaveLength(0);
  });

  it('Quản lý nhóm không duyệt được người ngoài nhóm, kể cả tự gõ khoá', async () => {
    const id = await dayWithTwoIssues();
    const items = await inboxItems(id);
    const result = await bulk(asBulk(items), manager);
    expect(result.body.result).toEqual({ approved: 0, skipped: items.length });
    expect(await activeApprovals(id)).toHaveLength(0);
  });

  it('hai người bấm cùng lúc vẫn chỉ có một bản ghi hiệu lực', async () => {
    const id = await dayWithTwoIssues();
    const items = asBulk(await inboxItems(id));
    const results = await Promise.all([bulk(items), bulk(items, hr)]);
    expect(results.every(({ status }) => status < 500)).toBe(true);
    expect(await activeApprovals(id)).toHaveLength(1);
  });

  it('Bảng công chọn ô bằng đúng khoá của Hộp việc, ô đã duyệt không còn chọn được', async () => {
    const id = await dayWithTwoIssues();
    const read = async () => {
      const { timesheet } = (await api('GET', `/timesheet?period=${period()}`, { cookie: admin })).body;
      return timesheet.employees
        .find((row: any) => row.id === id)
        .cells.find((c: any) => c.date === yesterday);
    };
    const cell = await read();
    const expected = (await inboxItems(id)).map(({ key }: any) => key).sort();
    expect(cell.approvable.map(({ key }: any) => key).sort()).toEqual(expected);

    await bulk(cell.approvable);
    expect((await read()).approvable).toEqual([]);
  });

  it('danh sách rỗng hoặc kỳ sai → 400', async () => {
    expect((await bulk([])).status).toBe(400);
    const wrong = await api('POST', '/approvals/bulk', {
      cookie: admin,
      body: { period: 'abc', items: [{ key: 'a', label: 'b' }] },
    });
    expect(wrong.status).toBe(400);
  });
});
