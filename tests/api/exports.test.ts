import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { BASE_URL, api, login, sql } from './helpers';

const period = vietnamToday().slice(0, 7);
let admin: string;
let manager: string;

const download = (path: string, cookie: string) =>
  fetch(`${BASE_URL}/api/v1${path}`, { headers: { cookie } });

const sheetOf = async (response: Response) => {
  expect(response.status).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbook;
};

const rowsOf = (sheet: ExcelJS.Worksheet) => {
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
};

const unpublish = async () => {
  await sql`delete from payslips where period_id in (select id from payroll_periods where period_key = ${period})`;
  await sql`delete from payroll_periods where period_key = ${period}`;
};

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  await unpublish();
});

afterAll(async () => {
  await unpublish();
  await sql.end();
});

describe('xuất Excel bảng công (TS-09)', () => {
  it('khớp API: đủ người, đủ ngày, cột tổng cùng số', async () => {
    const { timesheet } = (await api('GET', `/timesheet?period=${period}`, { cookie: admin })).body;
    const response = await download(`/timesheet/export?period=${period}`, admin);
    expect(response.headers.get('content-disposition')).toContain(`bang-cong-${period}.xlsx`);

    const [, header, ...rows] = rowsOf((await sheetOf(response)).getWorksheet('Bảng công')!);
    expect(header).toHaveLength(2 + timesheet.dates.length + 5);
    expect(rows.map((row) => row[0])).toEqual(timesheet.employees.map(({ name }: any) => name));

    const first = timesheet.employees[0];
    expect(rows[0]!.slice(-5)).toEqual([
      first.totals.cong,
      first.totals.lateMin,
      first.totals.missing,
      first.totals.otApproved,
      first.totals.otPending,
    ]);
  });

  it('có trang chú thích, đủ công không để trống như ngày không có công', async () => {
    const legend = rowsOf(
      (await sheetOf(await download('/timesheet/export', admin))).getWorksheet('Chú thích')!,
    );
    expect(legend).toContainEqual(['X', 'Đủ công']);
    expect(legend).toContainEqual(['+?', 'OT chờ duyệt']);
  });

  it('Quản lý nhóm chỉ xuất người mình quản lý, không có cột tiền', async () => {
    const { timesheet } = (await api('GET', `/timesheet?period=${period}`, { cookie: manager })).body;
    const [, header, ...rows] = rowsOf(
      (await sheetOf(await download(`/timesheet/export?period=${period}`, manager))).getWorksheet(
        'Bảng công',
      )!,
    );
    expect(rows.map((row) => row[0])).toEqual(timesheet.employees.map(({ name }: any) => name));
    expect(JSON.stringify(header)).not.toMatch(/Lương|đ/);
  });

  it('kỳ sai định dạng → 400', async () => {
    expect((await download('/timesheet/export?period=abc', admin)).status).toBe(400);
  });
});

describe('xuất Excel bảng lương (PAY-09)', () => {
  const payrollRows = async () => {
    const [title, , ...rows] = rowsOf(
      (await sheetOf(await download(`/payroll/export?period=${period}`, admin))).getWorksheet('Bảng lương')!,
    );
    return { title: String(title![0]), rows, total: rows.at(-1)!, people: rows.slice(0, -1) };
  };
  const NET = 10;

  it('chưa công bố: ghi tạm tính, tổng bằng quỹ lương, các cột cộng lại bằng thực lĩnh', async () => {
    const { payroll } = (await api('GET', `/payroll?period=${period}`, { cookie: admin })).body;
    const { title, total, people } = await payrollRows();
    expect(title).toContain('Tạm tính');
    expect(total[0]).toBe('Tổng');
    expect(total[NET]).toBe(payroll.fund);
    expect(people).toHaveLength(payroll.headcount);
    for (const row of people) {
      const parts = (row.slice(5, 10) as number[]).reduce((sum, amount) => sum + amount, 0);
      expect(parts).toBe(row[NET]);
    }
  });

  it('đã công bố thì lấy bản chụp: sửa sau đó không đổi file, tiêu đề báo số đã đổi', async () => {
    await api('POST', `/payroll/publish?period=${period}`, { cookie: admin });
    const before = await payrollRows();
    expect(before.title).toContain('Đã công bố');

    const [anh] = await sql`select id from employees where email = 'anh@phonho.vn'`;
    const added = await api('POST', '/adjustments', {
      cookie: admin,
      body: { periodKey: period, employeeId: anh!.id, kind: 'bonus', amount: 123_000, note: 'Sau công bố' },
    });
    expect(added.status).toBe(201);

    const after = await payrollRows();
    expect(after.total[NET]).toBe(before.total[NET]);
    expect(after.title).toContain('đã đổi');
    await api('DELETE', `/adjustments/${added.body.adjustment.id}`, { cookie: admin });
  });
});

describe('in phiếu lương (PAY-08)', () => {
  const page = (query: string, cookie: string) =>
    fetch(`${BASE_URL}/app/in-phieu${query}`, { redirect: 'manual', headers: { cookie } });

  it('in một người chỉ có phiếu người đó', async () => {
    const [ha] = await sql`select id, name from employees where email = 'ha@phonho.vn'`;
    const [other] = await sql`select name from employees where email = 'anh@phonho.vn'`;
    const html = await (await page(`?period=${period}&nv=${ha!.id}`, admin)).text();
    expect(html).toContain(ha!.name);
    expect(html).not.toContain(other!.name);
  });

  it('bỏ `nv` là in cả kỳ; `nv` của công ty khác không ra phiếu nào', async () => {
    const [other] = await sql`select name from employees where email = 'anh@phonho.vn'`;
    expect(await (await page(`?period=${period}`, admin)).text()).toContain(other!.name);
    const empty = await page(`?period=${period}&nv=00000000-0000-0000-0000-000000000000`, admin);
    expect(await empty.text()).toContain('Không có phiếu nào để in');
  });

  it('Quản lý nhóm không vào được', async () => {
    const response = await page(`?period=${period}`, manager);
    expect(await response.text()).not.toContain('Thực lĩnh');
  });
});
