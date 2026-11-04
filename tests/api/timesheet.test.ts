import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, employeeBody, login, sql, publishCells } from './helpers';

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
  publishCells(admin, [{ employeeId, date, shiftIds, isOff: false }]);

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

describe('khoảng xem của Bảng công (TS-02, TS-03)', () => {
  const read = async (query: string) =>
    (await api('GET', `/timesheet?${query}`, { cookie: admin })).body.timesheet;

  it('Kỳ lệch đổi khoảng xem, kỳ lương trong Cài đặt giữ nguyên', async () => {
    const view = await read('start=16&period=2026-10');
    expect(view).toMatchObject({ mode: 'shifted', start: 16, isPayrollRange: false });
    expect(view.period).toMatchObject({ from: '2026-09-16', to: '2026-10-15' });
    expect((await read('')).mode).toBe('payroll');
    expect((await api('GET', '/company', { cookie: admin })).body.company.cutoffDay).toBeNull();
  });

  it('Tự chọn trả đúng các ngày, không có kỳ trước và kỳ sau', async () => {
    const view = await read('from=2026-10-05&to=2026-10-09');
    expect(view.dates).toHaveLength(5);
    expect(view).toMatchObject({ mode: 'custom', previousKey: null, nextKey: null });
  });

  it.each([
    ['thiếu ngày cuối', 'from=2026-10-05'],
    ['ngày cuối trước ngày đầu', 'from=2026-10-09&to=2026-10-05'],
    ['quá 62 ngày', 'from=2026-01-01&to=2026-03-04'],
    ['ngày bắt đầu 32', 'start=32'],
    ['chế độ xem lạ', 'view=thang'],
  ])('%s → 400', async (_name, query) => {
    expect((await api('GET', `/timesheet?${query}`, { cookie: admin })).status).toBe(400);
  });

  it('đúng 62 ngày vẫn hợp lệ', async () => {
    expect((await read('from=2026-01-01&to=2026-03-03')).dates).toHaveLength(62);
  });

  it('Excel và bảng công một người đi theo đúng khoảng đang xem', async () => {
    const { id } = await newEmployee();
    await schedule(id, yesterday, [shifts.TOI.id]);
    const other = addDays(yesterday, -3);
    const url = `/timesheet/${id}?from=${other}&to=${other}`;
    expect((await api('GET', url, { cookie: admin })).body.timesheet.rows).toHaveLength(0);

    const response = await fetch(
      `${process.env.API_BASE_URL}/api/v1/timesheet/export?from=${yesterday}&to=${yesterday}`,
      { headers: { cookie: admin } },
    );
    expect(response.headers.get('content-disposition')).toContain(`bang-cong-${yesterday}_${yesterday}.xlsx`);
  });
});

describe('Bảng công Theo tuần (TS-05)', () => {
  const read = async (query: string) =>
    (await api('GET', `/timesheet?${query}`, { cookie: admin })).body.timesheet;

  it('không xin thì không tải dữ liệu tuần', async () => {
    const view = await read(`period=${period}`);
    expect(view.week).toBeNull();
    expect(view.employees.every(({ weekDays }: any) => weekDays.length === 0)).toBe(true);
  });

  it('có giờ vào–ra, trạng thái, mốc ca; chỉ gồm ngày của tuần đang chọn', async () => {
    const { id } = await newEmployee();
    await punch(id, yesterday, 'in', '17:00');
    await punch(id, yesterday, 'out', '22:00');
    await schedule(id, yesterday, [shifts.TOI.id]);

    const { weeks } = await read(`period=${period}`);
    const wanted = weeks.find(({ from, to }: any) => from <= yesterday && yesterday <= to);
    const view = await read(`period=${period}&view=week&week=${wanted.from}`);
    expect(view.week).toEqual(wanted);

    const person = view.employees.find((row: any) => row.id === id);
    expect(person.weekDays.every(({ date }: any) => date >= wanted.from && date <= wanted.to)).toBe(true);
    const [row] = person.weekDays[0].rows;
    expect(row.text).toMatch(/17:00–22:00|sau ca|muộn|sớm/);
    expect(row.shiftName).toBe(shifts.TOI.name);
    expect(row.shiftStartAt).toBeTruthy();
    expect(row.congValue).toBeGreaterThan(0);

    const elsewhere = weeks.find(({ from }: any) => from !== wanted.from);
    if (elsewhere) {
      const moved = await read(`period=${period}&view=week&week=${elsewhere.from}`);
      expect(moved.employees.find((entry: any) => entry.id === id).weekDays).toHaveLength(0);
    }
  });

  it('tuần lạ thì về tuần mặc định, không lỗi', async () => {
    const view = await read(`period=${period}&view=week&week=2020-01-01`);
    expect(view.weeks).toContainEqual(view.week);
  });
});
