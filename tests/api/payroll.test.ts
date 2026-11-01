import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, sql } from './helpers';

let admin: string;
let hr: string;
let manager: string;
let positions: Record<string, any>;
let shifts: Record<string, any>;
let yesterday: string;
let period: string;

type Employee = { id: string; session: string; name: string };

const newEmployee = async (position = 'Phục vụ', overrides: object = {}): Promise<Employee> => {
  const name = `Lương ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const body = employeeBody({
    name,
    positionId: positions[position].id,
    onboardDate: '2026-01-01',
    ...overrides,
  });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, name, session: await login(body.email, 'app', COMPANY, pin) };
};

const schedule = (employeeId: string, date: string, shiftIds: string[]) =>
  api('PUT', '/schedule', { cookie: admin, body: { cells: [{ employeeId, date, shiftIds, isOff: false }] } });

const punch = (employeeId: string, date: string, type: 'in' | 'out', clock: string) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(`${date}T${clock}:00+07:00`)}, ${type}, true from employees where id = ${employeeId}`;

/** Một ca tối, ở lại 60 phút sau ca. */
const workedDay = async (id: string) => {
  await punch(id, yesterday, 'in', '17:00');
  await punch(id, yesterday, 'out', '23:00');
  await schedule(id, yesterday, [shifts.TOI.id]);
};

const payroll = async (cookie = admin) =>
  (await api('GET', `/payroll?period=${period}`, { cookie })).body.payroll;
const statement = async (id: string) =>
  (await api('GET', `/payroll/${id}?period=${period}`, { cookie: admin })).body.statement;
const adjust = (employeeId: string, kind: string, amount: number, note = 'Doanh số', cookie = admin) =>
  api('POST', '/adjustments', { cookie, body: { periodKey: period, employeeId, kind, amount, note } });
const publish = () => api('POST', `/payroll/publish?period=${period}`, { cookie: admin });
const unpublish = async () => {
  await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
  await sql`delete from payroll_periods where period_key = ${period}`;
};

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  hr = await login('quynh@phonho.vn');
  manager = await login('minh@phonho.vn');
  const positionRows = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positions = Object.fromEntries(positionRows.map((row: any) => [row.name, row]));
  const rows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(rows.map((row: any) => [row.code, row]));
  yesterday = addDays(vietnamToday(), -1);
  period = yesterday.slice(0, 7);
});

afterAll(async () => {
  await unpublish();
  await sql.end();
});

describe('sao kê (US34)', () => {
  it('lương giờ tính theo phút làm, OT chờ tách riêng, có dự phóng', async () => {
    const { id } = await newEmployee();
    await workedDay(id);
    const body = await statement(id);
    expect(body.lines[0]).toMatchObject({ key: 'base', amount: 125_000, how: '5 giờ × 25.000đ' });
    expect(body.net).toBe(125_000);
    expect(body.pendingOt).toMatchObject({ minutes: 60, amount: 37_500 });
    expect(body.projectedNet).toBe(162_500);
    expect(body.issues).toBe(1);
  });

  it('duyệt OT thì Lương đổi ngay', async () => {
    const { id } = await newEmployee();
    await workedDay(id);
    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: 60 },
    });
    const body = await statement(id);
    expect(body.net).toBe(162_500);
    expect(body.pendingOt.minutes).toBe(0);
    expect(body.lines[1].how).toContain('60p × 25.000đ/giờ × 150%');
  });

  it('ghi đè lương riêng thắng vị trí', async () => {
    const { payType } = positions['Phục vụ'];
    const { id } = await newEmployee('Phục vụ', { payOverride: { payType, payAmount: 30_000 } });
    await workedDay(id);
    expect((await statement(id)).net).toBe(150_000);
  });

  it('danh sách khớp sao kê, sẵn sàng khi không còn việc', async () => {
    const { id } = await newEmployee();
    await workedDay(id);
    const before = (await payroll()).employees.find((row: any) => row.id === id);
    expect(before).toMatchObject({ net: 125_000, ready: false, issues: 1, otPendingMin: 60 });

    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: 0 },
    });
    const view = await payroll();
    expect(view.employees.find((row: any) => row.id === id)).toMatchObject({ ready: true, issues: 0 });
    expect(view.fund).toBe(view.employees.reduce((sum: number, row: any) => sum + row.net, 0));
    expect(view.readyCount).toBe(view.employees.filter((row: any) => row.ready).length);
    expect(view.headcount).toBe(view.employees.length);
  });

  it('Quản lý nhóm không có quyền, kỳ sai trả 400, người ngoài công ty trả 404', async () => {
    expect((await api('GET', '/payroll', { cookie: manager })).status).toBe(403);
    expect((await api('GET', '/payroll?period=abc', { cookie: admin })).status).toBe(400);
    const nil = '00000000-0000-0000-0000-000000000000';
    expect((await api('GET', `/payroll/${nil}`, { cookie: admin })).status).toBe(404);
    expect((await api('GET', '/payroll/abc', { cookie: admin })).status).toBe(404);
  });
});

describe('Lương khớp Bảng công', () => {
  it('công, muộn, OT trên ba nguồn là một', async () => {
    const { id, session } = await newEmployee();
    await punch(id, yesterday, 'in', '17:14');
    await punch(id, yesterday, 'out', '23:00');
    await schedule(id, yesterday, [shifts.TOI.id]);
    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: 45 },
    });

    const pay = (await statement(id)).summary;
    const grid = (await api('GET', `/timesheet?period=${period}`, { cookie: admin })).body.timesheet;
    const totals = grid.employees.find((row: any) => row.id === id).totals;
    const mine = (await api('GET', `/app/timesheet?month=${period}`, { cookie: session })).body.timesheet
      .totals;

    expect(pay).toMatchObject({
      cong: totals.cong,
      lateMin: totals.lateMin,
      otApprovedMin: totals.otApproved,
    });
    expect(mine).toMatchObject({ cong: totals.cong, lateMin: totals.lateMin, otApproved: totals.otApproved });
    expect(pay.lateMin).toBe(14);
  });

  it('tổng quỹ khớp từng sao kê của cả công ty', async () => {
    const view = await payroll();
    const statements = await Promise.all(view.employees.map(({ id }: any) => statement(id)));
    expect(statements.map(({ net }: any) => net)).toEqual(view.employees.map(({ net }: any) => net));
  });
});

describe('thưởng/phạt (US35)', () => {
  it('cộng trừ thẳng vào thực lĩnh, có audit, xoá được', async () => {
    const { id } = await newEmployee();
    const before = await auditCount('adjustment.create');
    expect((await adjust(id, 'bonus', 500_000)).status).toBe(201);
    const penalty = await adjust(id, 'penalty', 200_000, 'Làm vỡ ly');
    expect(await auditCount('adjustment.create')).toBe(before + 2);
    expect((await statement(id)).net).toBe(300_000);
    expect((await payroll()).employees.find((row: any) => row.id === id).hasAdjustment).toBe(true);

    expect(
      (await api('DELETE', `/adjustments/${penalty.body.adjustment.id}`, { cookie: admin })).status,
    ).toBe(200);
    expect((await statement(id)).net).toBe(500_000);
    expect(
      (await api('DELETE', `/adjustments/${penalty.body.adjustment.id}`, { cookie: admin })).status,
    ).toBe(404);
  });

  it('số tiền phải lớn hơn 0, lý do bắt buộc', async () => {
    const { id } = await newEmployee();
    expect((await adjust(id, 'bonus', 0)).status).toBe(400);
    expect((await adjust(id, 'bonus', -5)).status).toBe(400);
    expect((await adjust(id, 'bonus', 1000, '')).status).toBe(400);
    expect((await adjust(id, 'khac', 1000)).status).toBe(400);
  });

  it('không thêm được cho người công ty khác', async () => {
    const [company] =
      await sql`insert into companies (code, name) values (${`L${Date.now()}`}, 'Khác') returning id`;
    const [other] = await sql`insert into employees (company_id, email, name, pin_hash, onboard_date)
      values (${company!.id}, 'y@khac.vn', 'Y', 'h', '2026-01-01') returning id`;
    expect((await adjust(other!.id, 'bonus', 1000)).status).toBe(404);
    expect((await api('GET', `/payroll/${other!.id}`, { cookie: admin })).status).toBe(404);
    expect((await payroll()).employees.some((row: any) => row.id === other!.id)).toBe(false);
  });

  it('Nhân sự không tự thưởng cho mình', async () => {
    const [self] = await sql`select id from employees where email = 'quynh@phonho.vn'`;
    expect((await adjust(self!.id, 'bonus', 1000, 'Tự thưởng', hr)).status).toBe(403);
  });

  it('lương âm giữ nguyên', async () => {
    const { id } = await newEmployee();
    await adjust(id, 'penalty', 100_000, 'Thiếu quỹ');
    expect((await statement(id)).net).toBe(-100_000);
  });
});

describe('công bố (US36)', () => {
  it('tạo bản chụp, nhân viên xem được phiếu của mình, không xem được phiếu kỳ chưa công bố', async () => {
    await unpublish();
    const { id, session } = await newEmployee();
    await workedDay(id);
    expect((await api('GET', `/app/payslips/${period}`, { cookie: session })).status).toBe(404);

    const before = await auditCount('payroll.publish');
    const result = await publish();
    expect(result.status).toBe(201);
    expect(await auditCount('payroll.publish')).toBe(before + 1);
    const view = await payroll();
    expect(view.status).toMatchObject({ published: true, stale: false, count: view.headcount });
    expect(result.body.published.total).toBe(view.fund);
    expect(view.status.publishedNet).toBe(view.fund);

    const list = (await api('GET', '/app/payslips', { cookie: session })).body.payslips;
    expect(list[0]).toMatchObject({ periodKey: period, net: 125_000 });
    const slip = (await api('GET', `/app/payslips/${period}`, { cookie: session })).body.payslip;
    expect(slip.lines[0]).toMatchObject({ key: 'base', amount: 125_000 });
    expect(slip.summary).toMatchObject({ payType: 'hour', payAmount: 25_000, positionName: 'Phục vụ' });
  });

  it('sửa sau công bố: phiếu không đổi, kỳ báo cần công bố lại; công bố lại ra số mới, audit giữ số cũ', async () => {
    await unpublish();
    const { id, session } = await newEmployee();
    await workedDay(id);
    await publish();

    await api('POST', '/approvals', {
      cookie: admin,
      body: { employeeId: id, date: yesterday, shiftId: shifts.TOI.id, otMinutes: 60 },
    });
    const read = async () =>
      (await api('GET', `/app/payslips/${period}`, { cookie: session })).body.payslip.net;
    expect(await read()).toBe(125_000);
    expect((await payroll()).status.stale).toBe(true);
    expect((await statement(id)).net).toBe(162_500);

    const before = await auditCount('payroll.republish');
    expect((await publish()).status).toBe(201);
    expect(await auditCount('payroll.republish')).toBe(before + 1);
    expect(await read()).toBe(162_500);
    expect((await payroll()).status.stale).toBe(false);
    const [log] =
      await sql`select before from audit_logs where action = 'payroll.republish' order by at desc limit 1`;
    expect(log!.before.payslips.find((row: any) => row.employeeId === id).net).toBe(125_000);
    expect(await sql`select 1 from payslips where employee_id = ${id}`).toHaveLength(1);
  });

  it('đổi mức lương sau công bố không làm đổi phiếu', async () => {
    await unpublish();
    const { payType } = positions['Phục vụ'];
    const { id, session } = await newEmployee();
    await workedDay(id);
    await publish();
    await api('PATCH', `/employees/${id}`, {
      cookie: admin,
      body: { payOverride: { payType, payAmount: 99_000 } },
    });
    const slip = (await api('GET', `/app/payslips/${period}`, { cookie: session })).body.payslip;
    expect(slip.net).toBe(125_000);
    expect(slip.summary.payAmount).toBe(25_000);
  });

  it('thêm thưởng sau công bố làm kỳ cần công bố lại', async () => {
    await unpublish();
    const { id } = await newEmployee();
    await publish();
    await adjust(id, 'bonus', 1000);
    expect((await payroll()).status.stale).toBe(true);
  });

  it('cron đầu tiên sau khi công bố không báo sai, kể cả người vắng chưa có dòng ngày công', async () => {
    await unpublish();
    const { id } = await newEmployee('Tạp vụ');
    expect(await sql`select 1 from day_records where employee_id = ${id}`).toHaveLength(0);
    await publish();
    const response = await fetch(`${process.env.API_BASE_URL}/api/internal/recompute`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(response.status).toBe(200);
    expect((await payroll()).status.stale).toBe(false);
  });

  it('nhân viên không xem được phiếu người khác, phiên quản trị không dùng API app', async () => {
    await unpublish();
    const first = await newEmployee();
    const second = await newEmployee();
    await workedDay(first.id);
    await publish();
    const own = (await api('GET', `/app/payslips/${period}`, { cookie: second.session })).body.payslip;
    expect(own.net).toBe(0);
    expect((await api('GET', '/app/payslips', { cookie: admin })).status).toBe(401);
    expect((await api('GET', '/app/payslips/abc', { cookie: first.session })).status).toBe(404);
  });

  it('người đã nghỉ giữa kỳ vẫn có phiếu', async () => {
    await unpublish();
    const { id } = await newEmployee();
    await workedDay(id);
    await api('PATCH', `/employees/${id}`, { cookie: admin, body: { status: 'left' } });
    await publish();
    expect(await sql`select net from payslips where employee_id = ${id}`).toEqual([{ net: '125000' }]);
  });

  it('phiếu không có PIN hay bản băm', async () => {
    await unpublish();
    const { session } = await newEmployee();
    await publish();
    const responses = await Promise.all([
      api('GET', '/app/payslips', { cookie: session }),
      api('GET', `/app/payslips/${period}`, { cookie: session }),
      api('GET', `/payroll?period=${period}`, { cookie: admin }),
    ]);
    for (const { status, text } of responses) {
      expect(status).toBe(200);
      expect(text).not.toMatch(/pinHash|pin_hash|"pin"|tokenHash/);
    }
  });

  it('kỳ chưa bắt đầu không công bố được, Quản lý nhóm không có quyền', async () => {
    expect((await api('POST', '/payroll/publish?period=2099-01', { cookie: admin })).status).toBe(409);
    expect((await api('POST', `/payroll/publish?period=${period}`, { cookie: manager })).status).toBe(403);
  });
});
