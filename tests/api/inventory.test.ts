import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMPANY, api, auditCount, employeeBody, login, positionBody, sql, unique } from './helpers';

let admin: string;
let manager: string;
let managerId: string;
let positionId: string;
let otherPositionId: string;
let sheetId: string;
let toolSheetId: string;
let items: { id: string; name: string; quantity: number }[];

type Staff = { id: string; session: string };
type Line = { itemId: string; counted: number; note: string | null };

const newStaff = async (position = positionId, overrides: object = {}): Promise<Staff> => {
  const body = employeeBody({ positionId: position, ...overrides });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, session: await login(body.email, 'app', COMPANY, pin) };
};

/** VÀO CA cách đây một giờ, không qua GPS: kiểm kê chỉ cần biết đang trong ca. */
const punch = async ({ id }: Staff, type: 'in' | 'out', minutesAgo = 60) =>
  sql`insert into attendance_logs (company_id, employee_id, at, type, in_zone)
    select company_id, id, ${new Date(Date.now() - minutesAgo * 60_000)}, ${type}, true
    from employees where id = ${id}`;

const addItem = async (name: string, quantity: number, kind = 'nguyen_lieu', unit = 'cái') => {
  const saved = await api('POST', '/inventory/items', {
    cookie: manager,
    body: { kind, name: `${name} ${unique('')}`, unit, quantity, note: null },
  });
  expect(saved.status).toBe(201);
  return saved.body.item as { id: string; name: string; quantity: number };
};

const mine = async ({ session }: Staff) =>
  (await api('GET', '/app/inventory', { cookie: session })).body.inventory;
const submit = ({ session }: Staff, lines: Line[], sheet = sheetId) =>
  api('POST', '/app/inventory', { cookie: session, body: { sheetId: sheet, lines } });
const allMatch = (): Line[] =>
  items.map(({ id, quantity }) => ({ itemId: id, counted: quantity, note: null }));
const quantityOf = async (id: string) =>
  (await sql`select quantity::float as q from inventory_items where id = ${id}`)[0]!.q as number;

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  manager = await login('minh@phonho.vn');
  managerId = (await sql`select id from employees where email = 'minh@phonho.vn'`)[0]!.id;
  const [shift] = await sql`select s.id from shifts s join companies c on c.id = s.company_id
    where c.code = ${COMPANY} and s.code = 'CA1'`;
  const [place] = await sql`select l.id from locations l join companies c on c.id = l.company_id
    where c.code = ${COMPANY} limit 1`;
  const created = await api('POST', '/positions', {
    cookie: admin,
    body: positionBody(shift!.id, place!.id),
  });
  const other = await api('POST', '/positions', { cookie: admin, body: positionBody(shift!.id, place!.id) });
  positionId = created.body.position.id;
  otherPositionId = other.body.position.id;

  const glass = await addItem('Ly thuỷ tinh', 24, 'vat_dung');
  items = [glass, await addItem('Sữa đặc', 6), await addItem('Cà phê hạt', 2.5, 'nguyen_lieu', 'kg')];
  const sheet = await api('POST', '/inventory/sheets', {
    cookie: manager,
    body: {
      name: 'Quầy bar',
      positionIds: [positionId, otherPositionId],
      itemIds: items.map(({ id }) => id),
    },
  });
  expect(sheet.status).toBe(201);
  sheetId = sheet.body.sheet.id;
  // Phiếu thứ hai chỉ cho vị trí kia, dùng chung món Ly để thấy số hiện có là số chung
  const tools = await api('POST', '/inventory/sheets', {
    cookie: admin,
    body: { name: 'Dụng cụ', positionIds: [otherPositionId], itemIds: [glass.id] },
  });
  toolSheetId = tools.body.sheet.id;
});

afterAll(() => sql.end());

describe('danh mục và phiếu của quản lý', () => {
  it('phiếu giữ vị trí và thứ tự món; có ghi audit', async () => {
    const list = (await api('GET', '/inventory/items', { cookie: manager })).body;
    const sheet = list.sheets.find(({ id }: any) => id === sheetId);
    expect(sheet.positionIds.sort()).toEqual([positionId, otherPositionId].sort());
    expect(sheet.items.map(({ id }: any) => id)).toEqual(items.map(({ id }) => id));
    expect(sheet.items[0].kind).toBe('vat_dung');
    expect(await auditCount('inventory_sheet.create')).toBeGreaterThanOrEqual(2);
  });

  it('từ chối món sai và phiếu thiếu vị trí, thiếu món, món của công ty khác', async () => {
    for (const body of [
      { kind: 'khac', name: 'Sai', unit: 'cái', quantity: 1, note: null },
      { kind: 'vat_dung', name: 'Sai', unit: 'cái', quantity: -1, note: null },
      { kind: 'vat_dung', name: 'Sai', unit: 'cái', quantity: 1.255, note: null },
    ]) {
      expect((await api('POST', '/inventory/items', { cookie: admin, body })).status).toBe(400);
    }
    const noPosition = await api('POST', '/inventory/sheets', {
      cookie: admin,
      body: { name: 'Sai', positionIds: [], itemIds: [items[0]!.id] },
    });
    expect(noPosition.body.fields).toMatchObject({ positionIds: 'Chọn ít nhất một vị trí' });
    const noItem = await api('POST', '/inventory/sheets', {
      cookie: admin,
      body: { name: 'Sai', positionIds: [positionId], itemIds: [] },
    });
    expect(noItem.body.fields).toMatchObject({ itemIds: 'Thêm ít nhất một món' });
    const foreign = await api('POST', '/inventory/sheets', {
      cookie: admin,
      body: { name: 'Sai', positionIds: [positionId], itemIds: ['00000000-0000-0000-0000-000000000000'] },
    });
    expect(foreign.status).toBe(400);
  });

  it('thêm bớt món của phiếu; xoá món khỏi danh mục thì món rời mọi phiếu', async () => {
    const extra = await addItem('Đường', 3);
    const sheet = await api('POST', '/inventory/sheets', {
      cookie: admin,
      body: { name: 'Tạm', positionIds: [positionId], itemIds: [items[0]!.id, extra.id] },
    });
    const id = sheet.body.sheet.id;
    const edited = await api('PATCH', `/inventory/sheets/${id}`, {
      cookie: admin,
      body: { name: 'Tạm 2', positionIds: [otherPositionId], itemIds: [extra.id] },
    });
    expect(edited.status).toBe(200);
    expect((await api('DELETE', `/inventory/items/${extra.id}`, { cookie: admin })).status).toBe(200);
    const list = (await api('GET', '/inventory/items', { cookie: admin })).body;
    const after = list.sheets.find((row: any) => row.id === id);
    expect(after).toMatchObject({ name: 'Tạm 2', positionIds: [otherPositionId], items: [] });
    expect((await api('DELETE', `/inventory/sheets/${id}`, { cookie: admin })).status).toBe(200);
    expect((await api('DELETE', `/inventory/sheets/${id}`, { cookie: admin })).status).toBe(404);
  });
});

describe('nhân viên kiểm kê trong ca', () => {
  it('chưa VÀO CA hoặc đã RA CA thì không có phiếu và không gửi được', async () => {
    const staff = await newStaff();
    expect((await mine(staff)).shift).toBeNull();
    expect((await submit(staff, allMatch())).status).toBe(409);

    await punch(staff, 'in', 120);
    expect((await mine(staff)).sheets.map(({ id }: any) => id)).toEqual([sheetId]);
    await punch(staff, 'out', 1);
    expect((await mine(staff)).shift).toBeNull();
  });

  it('vị trí có nhiều phiếu thì thấy đủ, mỗi phiếu gửi riêng; phiếu của vị trí khác thì không gửi được', async () => {
    const staff = await newStaff(otherPositionId);
    await punch(staff, 'in');
    expect((await mine(staff)).sheets.map(({ name }: any) => name)).toEqual(['Quầy bar', 'Dụng cụ']);
    expect((await submit(staff, allMatch())).status).toBe(201);
    const glass = [{ itemId: items[0]!.id, counted: items[0]!.quantity, note: null }];
    expect((await submit(staff, glass, toolSheetId)).status).toBe(201);
    const view = await mine(staff);
    expect(view.sheets.every(({ report }: any) => report?.status === 'pending')).toBe(true);

    const outsider = await newStaff();
    await punch(outsider, 'in');
    expect((await submit(outsider, glass, toolSheetId)).status).toBe(404);
  });

  it('số lệch phải có lý do; gửi rồi thì ca đó không gửi lại phiếu đó', async () => {
    const staff = await newStaff();
    await punch(staff, 'in');
    const lines = allMatch();
    lines[1] = { itemId: items[1]!.id, counted: 5, note: null };

    const missing = await submit(staff, lines);
    expect(missing.status).toBe(400);
    expect(missing.body.fields).toEqual({ 'lines.1.note': 'Ghi lý do lệch' });

    lines[1] = { itemId: items[1]!.id, counted: 5, note: 'Dùng pha đồ uống' };
    // Dòng khớp gửi kèm lý do thì bỏ lý do đi
    lines[0] = { itemId: items[0]!.id, counted: items[0]!.quantity, note: 'thừa' };
    expect((await submit(staff, lines)).status).toBe(201);
    expect((await submit(staff, lines)).status).toBe(409);

    const { report } = (await mine(staff)).sheets[0];
    expect(report).toMatchObject({
      sheetName: 'Quầy bar',
      status: 'pending',
      mismatchCount: 1,
      lineCount: 3,
    });
    expect(report.lines.map(({ note }: any) => note)).toEqual([null, 'Dùng pha đồ uống', null]);
    expect(report.lines.map(({ kind }: any) => kind)).toEqual(['vat_dung', 'nguyen_lieu', 'nguyen_lieu']);
  });

  it('phiếu vừa bị sửa thì báo mở lại', async () => {
    const staff = await newStaff();
    await punch(staff, 'in');
    expect((await submit(staff, allMatch().slice(0, 2))).status).toBe(409);
  });

  it('sửa, xoá trong 10 phút; quá 10 phút thì khoá', async () => {
    const staff = await newStaff();
    await punch(staff, 'in');
    const id = (await submit(staff, allMatch())).body.report.id;
    const report = (await api('GET', `/app/inventory/reports/${id}`, { cookie: staff.session })).body.report;
    const edit = report.lines.map(({ id: lineId, expected }: any, index: number) => ({
      id: lineId,
      counted: index === 0 ? expected - 2 : expected,
      note: index === 0 ? 'Vỡ 2 ly' : null,
    }));
    const patched = await api('PATCH', `/app/inventory/reports/${id}`, {
      cookie: staff.session,
      body: { lines: edit },
    });
    expect(patched.status).toBe(200);

    expect((await api('DELETE', `/app/inventory/reports/${id}`, { cookie: staff.session })).status).toBe(200);
    const again = (await submit(staff, allMatch())).body.report.id;

    await sql`update inventory_reports set created_at = now() - interval '11 minutes' where id = ${again}`;
    const late = (await api('GET', `/app/inventory/reports/${again}`, { cookie: staff.session })).body.report;
    expect(late.editableUntil).toBeNull();
    const lines = late.lines.map(({ id: lineId, expected }: any) => ({
      id: lineId,
      counted: expected,
      note: null,
    }));
    const patchLate = await api('PATCH', `/app/inventory/reports/${again}`, {
      cookie: staff.session,
      body: { lines },
    });
    expect(patchLate.status).toBe(409);
    expect((await api('DELETE', `/app/inventory/reports/${again}`, { cookie: staff.session })).status).toBe(
      409,
    );
  });

  it('không đọc được báo cáo của người khác', async () => {
    const owner = await newStaff();
    const other = await newStaff();
    await punch(owner, 'in');
    const id = (await submit(owner, allMatch())).body.report.id;
    expect((await api('GET', `/app/inventory/reports/${id}`, { cookie: other.session })).status).toBe(404);
    expect((await api('DELETE', `/app/inventory/reports/${id}`, { cookie: other.session })).status).toBe(404);
  });
});

describe('quản lý duyệt kiểm kê', () => {
  it('duyệt thì số đếm thành số chung của món, phiếu khác thấy số mới; báo cho nhân viên', async () => {
    const staff = await newStaff(positionId, { managerId });
    await punch(staff, 'in');
    const lines = allMatch();
    lines[0] = { itemId: items[0]!.id, counted: 22, note: 'Vỡ 2 ly' };
    const id = (await submit(staff, lines)).body.report.id;

    const listed = (await api('GET', '/inventory/reports', { cookie: manager })).body.reports;
    expect(listed.find((row: any) => row.id === id)).toMatchObject({
      sheetName: 'Quầy bar',
      status: 'pending',
      mismatchCount: 1,
    });
    const detail = (await api('GET', `/inventory/reports/${id}`, { cookie: manager })).body.report;
    expect(detail.lines[0]).toMatchObject({ expected: 24, counted: 22, note: 'Vỡ 2 ly', current: 24 });

    const approved = await api('POST', `/inventory/reports/${id}/decide`, {
      cookie: manager,
      body: { decision: 'approve' },
    });
    expect(approved.status).toBe(200);
    expect(await quantityOf(items[0]!.id)).toBe(22);
    const list = (await api('GET', '/inventory/items', { cookie: admin })).body;
    const tools = list.sheets.find((row: any) => row.id === toolSheetId);
    expect(tools.items[0].quantity).toBe(22);
    const [note] =
      await sql`select title from notifications where employee_id = ${staff.id} and kind = 'inventory'`;
    expect(note!.title).toBe('Quầy bar đã được duyệt');
    const again = await api('POST', `/inventory/reports/${id}/decide`, {
      cookie: manager,
      body: { decision: 'reject' },
    });
    expect(again.status).toBe(409);
    expect((await api('DELETE', `/app/inventory/reports/${id}`, { cookie: staff.session })).status).toBe(409);
    items[0]!.quantity = 22;
  });

  it('từ chối thì giữ số cũ', async () => {
    const staff = await newStaff();
    await punch(staff, 'in');
    const lines = allMatch();
    lines[2] = { itemId: items[2]!.id, counted: 1.5, note: 'Hết 1 kg' };
    const id = (await submit(staff, lines)).body.report.id;
    const rejected = await api('POST', `/inventory/reports/${id}/decide`, {
      cookie: admin,
      body: { decision: 'reject', note: 'Đếm lại kho' },
    });
    expect(rejected.status).toBe(200);
    expect(await quantityOf(items[2]!.id)).toBe(2.5);
    const detail = (await api('GET', `/inventory/reports/${id}`, { cookie: admin })).body.report;
    expect(detail).toMatchObject({ status: 'rejected', decisionNote: 'Đếm lại kho' });
  });

  it('xoá phiếu thì báo cáo cũ giữ tên phiếu', async () => {
    const tray = await addItem('Khay', 5, 'vat_dung');
    const temp = await api('POST', '/inventory/sheets', {
      cookie: admin,
      body: { name: 'Phiếu tạm', positionIds: [positionId], itemIds: [tray.id] },
    });
    const staff = await newStaff();
    await punch(staff, 'in');
    const sent = await submit(staff, [{ itemId: tray.id, counted: 5, note: null }], temp.body.sheet.id);
    await api('DELETE', `/inventory/sheets/${temp.body.sheet.id}`, { cookie: admin });
    const detail = (await api('GET', `/inventory/reports/${sent.body.report.id}`, { cookie: admin })).body
      .report;
    expect(detail).toMatchObject({ sheetId: null, sheetName: 'Phiếu tạm' });
  });

  it('quản lý nhóm chỉ thấy báo cáo của người mình quản lý', async () => {
    const staff = await newStaff();
    await punch(staff, 'in');
    const id = (await submit(staff, allMatch())).body.report.id;
    const listed = (await api('GET', '/inventory/reports', { cookie: manager })).body.reports;
    expect(listed.some((row: any) => row.id === id)).toBe(false);
    expect((await api('GET', `/inventory/reports/${id}`, { cookie: manager })).status).toBe(404);
    const decided = await api('POST', `/inventory/reports/${id}/decide`, {
      cookie: manager,
      body: { decision: 'approve' },
    });
    expect(decided.status).toBe(404);
  });
});
