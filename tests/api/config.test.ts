import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, auditCount, locationBody, login, positionBody, shiftBody, sql, unique } from './helpers';

let cookie: string;
let shiftId: string;
let locationId: string;

beforeAll(async () => {
  cookie = await login('ha@phonho.vn');
  const shift = await api('POST', '/shifts', { cookie, body: shiftBody() });
  const location = await api('POST', '/locations', { cookie, body: locationBody() });
  shiftId = shift.body.shift.id;
  locationId = location.body.location.id;
});

afterAll(() => sql.end());

describe('ca (US05)', () => {
  it('tạo ca ghi nhật ký; mã tự viết hoa', async () => {
    const before = await auditCount('shift.create');
    const code = unique('c').toLowerCase();
    const result = await api('POST', '/shifts', { cookie, body: shiftBody(code) });
    expect(result.status).toBe(201);
    expect(result.body.shift.code).toBe(code.toUpperCase());
    expect(await auditCount('shift.create')).toBe(before + 1);
  });

  it('tự nhận ca qua đêm', async () => {
    const result = await api('POST', '/shifts', {
      cookie,
      body: { ...shiftBody(), startTime: '22:00', endTime: '06:00', stdHours: 8, minFull: 420, minHalf: 210 },
    });
    expect(result.body.shift.overnight).toBe(true);
  });

  it('trùng mã → 409 báo ở trường code', async () => {
    const body = shiftBody();
    await api('POST', '/shifts', { cookie, body });
    const result = await api('POST', '/shifts', { cookie, body });
    expect(result.status).toBe(409);
    expect(result.body.fields.code).toBeTruthy();
  });

  it.each([
    ['giờ ra trùng giờ vào', { endTime: '08:00' }, 'endTime'],
    ['giờ sai định dạng', { startTime: '25:00' }, 'startTime'],
    ['nghỉ thiếu giờ kết thúc', { breakStart: '09:00' }, 'breakEnd'],
    ['nghỉ ngoài ca', { breakStart: '13:00', breakEnd: '13:30' }, 'breakStart'],
    ['nửa công lớn hơn đủ công', { minFull: 100, minHalf: 200 }, 'minHalf'],
    ['đủ công vượt thời lượng ca', { minFull: 600 }, 'minFull'],
    ['mã có dấu', { code: 'SÁNG' }, 'code'],
    ['cách tính lạ', { calc: 'abc' }, 'calc'],
  ])('%s → 400 đúng trường', async (_name, change, field) => {
    const result = await api('POST', '/shifts', { cookie, body: { ...shiftBody(), ...change } });
    expect(result.status).toBe(400);
    expect(result.body.fields[field]).toBeTruthy();
  });

  it('mã không đổi được khi đã có lịch; đổi được khi chưa có', async () => {
    const body = shiftBody();
    const created = await api('POST', '/shifts', { cookie, body });
    const id = created.body.shift.id as string;

    const renamed = { ...body, code: unique('R') };
    expect((await api('PATCH', `/shifts/${id}`, { cookie, body: renamed })).status).toBe(200);

    const [employee] = await sql`select id, company_id from employees where email = 'nam@phonho.vn'`;
    await sql`insert into schedule_cells (company_id, employee_id, date, shift_ids)
      values (${employee!.company_id}, ${employee!.id}, ${`20${String(Date.now() % 90).padStart(2, '0')}-01-15`}, ${[id]}::uuid[])`;

    const locked = await api('PATCH', `/shifts/${id}`, { cookie, body: { ...renamed, code: unique('X') } });
    expect(locked.status).toBe(409);
    expect(locked.body.fields.code).toBeTruthy();

    // Vẫn sửa được các trường khác
    const rename = await api('PATCH', `/shifts/${id}`, { cookie, body: { ...renamed, name: 'Tên mới' } });
    expect(rename.status).toBe(200);
    expect((await api('DELETE', `/shifts/${id}`, { cookie })).status).toBe(409);
  });

  it('không xoá ca đang gắn với vị trí', async () => {
    const shift = await api('POST', '/shifts', { cookie, body: shiftBody() });
    await api('POST', '/positions', { cookie, body: positionBody(shift.body.shift.id, locationId) });
    expect((await api('DELETE', `/shifts/${shift.body.shift.id}`, { cookie })).status).toBe(409);
  });

  it('xoá ca chưa dùng, ghi nhật ký', async () => {
    const shift = await api('POST', '/shifts', { cookie, body: shiftBody() });
    const before = await auditCount('shift.delete');
    expect((await api('DELETE', `/shifts/${shift.body.shift.id}`, { cookie })).status).toBe(200);
    expect(await auditCount('shift.delete')).toBe(before + 1);
  });

  it('ID sai định dạng → 404, không phải 500', async () => {
    expect((await api('DELETE', '/shifts/khong-phai-uuid', { cookie })).status).toBe(404);
  });
});

describe('ngày lễ (US08)', () => {
  it('thêm, trùng ngày → 409, xoá', async () => {
    const date = '2031-03-08';
    const created = await api('POST', '/holidays', { cookie, body: { date, name: 'Ngày thử' } });
    expect(created.status).toBe(201);
    const again = await api('POST', '/holidays', { cookie, body: { date, name: 'Ngày thử' } });
    expect(again.status).toBe(409);
    expect((await api('DELETE', `/holidays/${created.body.holiday.id}`, { cookie })).status).toBe(200);
  });

  it('ngày sai → 400', async () => {
    const result = await api('POST', '/holidays', { cookie, body: { date: '2031-13-45', name: 'Sai' } });
    expect(result.status).toBe(400);
  });

  it('thêm ngày lễ Việt Nam: 4 ngày cố định, chạy lại không trùng', async () => {
    await sql`delete from holidays where date >= '2033-01-01' and date <= '2033-12-31'`;
    const first = await api('POST', '/holidays/seed-vn?year=2033', { cookie });
    expect(first.body.added.map((holiday: any) => holiday.date).sort()).toEqual([
      '2033-01-01',
      '2033-04-30',
      '2033-05-01',
      '2033-09-02',
    ]);
    const second = await api('POST', '/holidays/seed-vn?year=2033', { cookie });
    expect(second.body.added).toHaveLength(0);
  });

  it('năm sai → 400', async () => {
    expect((await api('POST', '/holidays/seed-vn?year=abc', { cookie })).status).toBe(400);
    expect((await api('POST', '/holidays/seed-vn', { cookie })).status).toBe(400);
  });
});

describe('vị trí (US06)', () => {
  it('tạo linh hoạt, đọc lại đủ ca và địa điểm', async () => {
    const created = await api('POST', '/positions', { cookie, body: positionBody(shiftId, locationId) });
    expect(created.status).toBe(201);
    const list = await api('GET', '/positions', { cookie });
    const found = list.body.positions.find((position: any) => position.id === created.body.position.id);
    expect(found).toMatchObject({ shiftIds: [shiftId], locationIds: [locationId], otWeekday: 150 });
  });

  it('cố định: danh sách ca chỉ còn đúng ca cố định', async () => {
    const created = await api('POST', '/positions', {
      cookie,
      body: { ...positionBody(shiftId, locationId), shiftMode: 'fixed', fixedShiftId: shiftId, shiftIds: [] },
    });
    expect(created.status).toBe(201);
    const list = await api('GET', '/positions', { cookie });
    const found = list.body.positions.find((position: any) => position.id === created.body.position.id);
    expect(found.shiftIds).toEqual([shiftId]);
  });

  it('"Ở đâu cũng được" bỏ danh sách địa điểm', async () => {
    const created = await api('POST', '/positions', {
      cookie,
      body: { ...positionBody(shiftId, locationId), anyLocation: true },
    });
    const list = await api('GET', '/positions', { cookie });
    const found = list.body.positions.find((position: any) => position.id === created.body.position.id);
    expect(found.locationIds).toEqual([]);
  });

  it.each([
    ['cố định thiếu ca', { shiftMode: 'fixed', fixedShiftId: null }, 'fixedShiftId'],
    ['linh hoạt không có ca', { shiftIds: [] }, 'shiftIds'],
    ['không có địa điểm', { locationIds: [] }, 'locationIds'],
    ['không có ngày làm', { workDays: [] }, 'workDays'],
    ['mức lương 0', { payAmount: 0 }, 'payAmount'],
    ['hệ số OT dưới 100', { otWeekday: 50 }, 'otWeekday'],
  ])('%s → 400 đúng trường', async (_name, change, field) => {
    const result = await api('POST', '/positions', {
      cookie,
      body: { ...positionBody(shiftId, locationId), ...change },
    });
    expect(result.status).toBe(400);
    expect(result.body.fields[field]).toBeTruthy();
  });

  it('không xoá vị trí đang có người', async () => {
    const created = await api('POST', '/positions', { cookie, body: positionBody(shiftId, locationId) });
    const id = created.body.position.id as string;
    await sql`update employees set position_id = ${id} where email = 'nam@phonho.vn'`;
    expect((await api('DELETE', `/positions/${id}`, { cookie })).status).toBe(409);
    const [seedPosition] = await sql`select id from positions where name = 'Phục vụ' and company_id =
      (select company_id from employees where email = 'nam@phonho.vn')`;
    await sql`update employees set position_id = ${seedPosition!.id} where email = 'nam@phonho.vn'`;
    expect((await api('DELETE', `/positions/${id}`, { cookie })).status).toBe(200);
  });
});

describe('địa điểm (US07)', () => {
  it.each([29, 501])('bán kính %i → 400', async (radiusM) => {
    const result = await api('POST', '/locations', { cookie, body: { ...locationBody(), radiusM } });
    expect(result.status).toBe(400);
    expect(result.body.fields.radiusM).toBeTruthy();
  });

  it.each([30, 500])('bán kính %i được nhận', async (radiusM) => {
    const result = await api('POST', '/locations', { cookie, body: { ...locationBody(), radiusM } });
    expect(result.status).toBe(201);
  });

  it('chọn vị trí được chấm, sửa rồi bỏ chọn', async () => {
    const position = await api('POST', '/positions', { cookie, body: positionBody(shiftId, locationId) });
    const id = position.body.position.id as string;
    const created = await api('POST', '/locations', { cookie, body: locationBody([id]) });
    const locationKey = created.body.location.id as string;

    const find = async () =>
      (await api('GET', '/locations', { cookie })).body.locations.find(
        (item: any) => item.id === locationKey,
      );
    expect((await find()).positionIds).toEqual([id]);

    await api('PATCH', `/locations/${locationKey}`, { cookie, body: { ...locationBody([]), radiusM: 100 } });
    expect(await find()).toMatchObject({ positionIds: [], radiusM: 100 });
  });

  it('không xoá địa điểm đã có lần chấm', async () => {
    const created = await api('POST', '/locations', { cookie, body: locationBody() });
    const id = created.body.location.id as string;
    const [employee] = await sql`select id, company_id from employees where email = 'nam@phonho.vn'`;
    await sql`insert into attendance_logs (company_id, employee_id, at, type, location_id)
      values (${employee!.company_id}, ${employee!.id}, now(), 'in', ${id})`;
    expect((await api('DELETE', `/locations/${id}`, { cookie })).status).toBe(409);
  });
});

describe('công ty (US09, US10)', () => {
  it('chỉ đổi trường gửi lên, ghi nhật ký trước và sau', async () => {
    const before = (await api('GET', '/company', { cookie })).body.company;
    const result = await api('PATCH', '/company', { cookie, body: { otMin: 45 } });
    expect(result.body.company).toMatchObject({ otMin: 45, name: before.name, code: before.code });

    const [log] =
      await sql`select before, after from audit_logs where action = 'company.update' order by at desc limit 1`;
    expect((log!.before as any).otMin).toBe(before.otMin);
    expect((log!.after as any).otMin).toBe(45);
    await api('PATCH', '/company', { cookie, body: { otMin: before.otMin } });
  });

  it('body rỗng không đổi gì, không lỗi', async () => {
    expect((await api('PATCH', '/company', { cookie, body: {} })).status).toBe(200);
  });

  it('không đổi được mã công ty', async () => {
    const before = (await api('GET', '/company', { cookie })).body.company;
    await api('PATCH', '/company', { cookie, body: { code: 'MOI' } });
    expect((await api('GET', '/company', { cookie })).body.company.code).toBe(before.code);
  });

  it.each([
    ['ngày làm rỗng', { workDays: [] }, 'workDays'],
    ['chế độ muộn lạ', { graceMode: 'abc' }, 'graceMode'],
    ['ngày chốt 32', { cutoffDay: 32 }, 'cutoffDay'],
    ['OT âm', { otMin: -1 }, 'otMin'],
    ['tên trống', { name: '   ' }, 'name'],
  ])('%s → 400', async (_name, body, field) => {
    const result = await api('PATCH', '/company', { cookie, body });
    expect(result.status).toBe(400);
    expect(result.body.fields[field]).toBeTruthy();
  });
});
