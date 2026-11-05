import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vietnamToday } from '../../lib/domain/date';
import { addDays } from '../../lib/engine/time';
import { COMPANY, api, auditCount, employeeBody, login, publishCells, sql } from './helpers';

let admin: string;
let positions: Record<string, string>;
let shifts: Record<string, string>;
let tomorrow: string;

type Person = { id: string; session: string; name: string };

const newPerson = async (position: string): Promise<Person> => {
  const name = `Pass ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const body = employeeBody({ name, positionId: positions[position], onboardDate: '2026-01-01' });
  const created = await api('POST', '/employees', { cookie: admin, body });
  expect(created.status).toBe(201);
  const { id, pin } = created.body.employee;
  return { id, name, session: await login(body.email, 'app', COMPANY, pin) };
};

const scheduleSang = (person: Person, date = tomorrow) =>
  publishCells(admin, [{ employeeId: person.id, date, shiftIds: [shifts.SANG!], isOff: false }]);

const passBody = (to: Person, date = tomorrow, shiftId = shifts.SANG) => ({
  type: 'shift_pass',
  date,
  shiftId,
  toEmployeeId: to.id,
  reason: 'Có việc gia đình',
});

const send = (from: Person, body: object) => api('POST', '/app/requests', { cookie: from.session, body });
const respond = (person: Person, id: string, decision: string) =>
  api('POST', `/app/requests/${id}/respond`, { cookie: person.session, body: { decision } });
const cellOf = async (id: string, date = tomorrow) =>
  (
    await sql`select shift_ids, is_off, positions from schedule_cells where employee_id = ${id} and date = ${date}`
  )[0];
const candidates = async (person: Person, date = tomorrow, shiftId = shifts.SANG) =>
  (await api('GET', `/app/shift-pass/candidates?date=${date}&shiftId=${shiftId}`, { cookie: person.session }))
    .body.candidates as { id: string }[];

beforeAll(async () => {
  admin = await login('ha@phonho.vn');
  const positionRows = (await api('GET', '/positions', { cookie: admin })).body.positions;
  positions = Object.fromEntries(positionRows.map((row: any) => [row.name, row.id]));
  const shiftRows = (await api('GET', '/shifts', { cookie: admin })).body.shifts;
  shifts = Object.fromEntries(shiftRows.map((row: any) => [row.code, row.id]));
  tomorrow = addDays(vietnamToday(), 1);
  // Pha chế và Thu ngân làm thay được Phục vụ; Tạp vụ thì không
  await sql`insert into position_covers (position_id, covers_id) values
    (${positions['Pha chế']!}, ${positions['Phục vụ']!}), (${positions['Thu ngân']!}, ${positions['Phục vụ']!})
    on conflict do nothing`;
});

afterAll(async () => {
  await sql`delete from position_covers where covers_id = ${positions['Phục vụ']!}`;
  await sql.end();
});

describe('pass ca', () => {
  it('ca của tôi: ca đã xếp chưa bắt đầu, kèm vị trí', async () => {
    const giver = await newPerson('Phục vụ');
    await scheduleSang(giver);
    const { shifts: mine } = (await api('GET', '/app/shift-pass', { cookie: giver.session })).body;
    expect(mine).toContainEqual(
      expect.objectContaining({ date: tomorrow, shiftId: shifts.SANG, positionName: 'Phục vụ' }),
    );
  });

  it('người nhận được: rảnh giờ đó và làm được vị trí của ca (cả vị trí làm thay)', async () => {
    const giver = await newPerson('Phục vụ');
    const free = await newPerson('Phục vụ');
    const busy = await newPerson('Phục vụ');
    const barista = await newPerson('Pha chế');
    const cleaner = await newPerson('Tạp vụ');
    await scheduleSang(giver);
    await scheduleSang(busy);
    const ids = (await candidates(giver)).map(({ id }) => id);
    expect(ids).toContain(free.id);
    expect(ids).toContain(barista.id);
    expect(ids).not.toContain(busy.id);
    expect(ids).not.toContain(cleaner.id);
    expect(ids).not.toContain(giver.id);
  });

  it('ca Pha chế chỉ pass cho người làm được Pha chế', async () => {
    const giver = await newPerson('Pha chế');
    const waiter = await newPerson('Phục vụ');
    const barista = await newPerson('Pha chế');
    await scheduleSang(giver);
    const ids = (await candidates(giver)).map(({ id }) => id);
    expect(ids).toContain(barista.id);
    expect(ids).not.toContain(waiter.id);
    expect((await send(giver, passBody(waiter))).status).toBe(400);
  });

  it('người nhận đồng ý: lịch đổi ngay, giữ vị trí của ca, không cần quản lý', async () => {
    const giver = await newPerson('Phục vụ');
    const barista = await newPerson('Pha chế');
    await scheduleSang(giver);
    const sent = await send(giver, passBody(barista));
    expect(sent.status).toBe(201);
    const id = sent.body.request.id;

    const notes = await sql`select title, href from notifications where employee_id = ${barista.id}`;
    expect(notes).toContainEqual({ title: 'Có người pass ca cho bạn', href: '#/toi' });
    const { incoming } = (await api('GET', '/app/requests', { cookie: barista.session })).body;
    expect(incoming).toMatchObject([{ id, fromName: giver.name, positionName: 'Phục vụ' }]);
    expect(
      (await api('POST', `/requests/${id}/decide`, { cookie: admin, body: { decision: 'approve' } })).status,
    ).toBe(400);
    expect((await send(giver, passBody(barista))).status).toBe(409);

    const before = await auditCount('request.pass_accept');
    expect((await respond(barista, id, 'accept')).status).toBe(200);
    expect(await auditCount('request.pass_accept')).toBe(before + 1);
    expect(await cellOf(giver.id)).toBeUndefined();
    expect(await cellOf(barista.id)).toMatchObject({
      shift_ids: [shifts.SANG],
      positions: { [shifts.SANG!]: positions['Phục vụ'] },
    });
    const [request] = await sql`select status, decided_by from requests where id = ${id}`;
    expect(request).toEqual({ status: 'approved', decided_by: barista.id });
    const giverNotes = await sql`select title from notifications where employee_id = ${giver.id}`;
    expect(giverNotes).toContainEqual({ title: 'Pass ca thành công' });
    expect((await respond(barista, id, 'accept')).status).toBe(409);
  });

  it('người nhận từ chối: lịch giữ nguyên', async () => {
    const giver = await newPerson('Phục vụ');
    const other = await newPerson('Phục vụ');
    await scheduleSang(giver);
    const id = (await send(giver, passBody(other))).body.request.id;
    expect((await respond(other, id, 'decline')).status).toBe(200);
    expect(await cellOf(giver.id)).toMatchObject({ shift_ids: [shifts.SANG] });
    expect(await cellOf(other.id)).toBeUndefined();
    expect((await sql`select status from requests where id = ${id}`)[0]!.status).toBe('rejected');
  });

  it('chỉ người được pass mới trả lời được', async () => {
    const giver = await newPerson('Phục vụ');
    const to = await newPerson('Phục vụ');
    const stranger = await newPerson('Phục vụ');
    await scheduleSang(giver);
    const id = (await send(giver, passBody(to))).body.request.id;
    expect((await respond(stranger, id, 'accept')).status).toBe(404);
    expect((await respond(giver, id, 'accept')).status).toBe(404);
  });

  it('không pass được ca đã qua hay ca không có trong lịch', async () => {
    const giver = await newPerson('Phục vụ');
    const to = await newPerson('Phục vụ');
    const yesterday = addDays(vietnamToday(), -1);
    await scheduleSang(giver, yesterday);
    expect((await send(giver, passBody(to, yesterday))).status).toBe(400);
    expect((await send(giver, passBody(to, addDays(tomorrow, 1)))).status).toBe(400);
  });

  it('tới giờ vào ca mà chưa trả lời thì hết hạn', async () => {
    const giver = await newPerson('Phục vụ');
    const to = await newPerson('Phục vụ');
    await scheduleSang(giver);
    const id = (await send(giver, passBody(to))).body.request.id;
    await sql`update requests set payload = jsonb_set(payload, '{startsAt}', to_jsonb(${new Date(Date.now() - 60_000).toISOString()}::text))
      where id = ${id}`;
    expect((await respond(to, id, 'accept')).status).toBe(409);
    expect((await api('GET', '/app/requests', { cookie: to.session })).body.incoming).toHaveLength(0);
    const mine = (await api('GET', '/app/requests', { cookie: giver.session })).body.requests;
    expect(mine[0]).toMatchObject({ id, expired: true, editableUntil: null });
    const history = (await api('GET', `/requests?period=${tomorrow.slice(0, 7)}`, { cookie: admin })).body
      .history;
    expect(history.requests.find((row: any) => row.id === id)).toMatchObject({
      expired: true,
      decidable: false,
      targetName: to.name,
    });
  });

  it('sau khi nhận ca làm thay, quản lý sửa ô hôm đó vẫn giữ được ca ấy', async () => {
    const giver = await newPerson('Phục vụ');
    const cashier = await newPerson('Thu ngân');
    await scheduleSang(giver);
    const id = (await send(giver, passBody(cashier))).body.request.id;
    await respond(cashier, id, 'accept');
    const cell = await cellOf(cashier.id);
    const saved = await api('PUT', '/schedule', {
      cookie: admin,
      body: {
        cells: [
          {
            employeeId: cashier.id,
            date: tomorrow,
            shiftIds: [...cell!.shift_ids, shifts.CA2],
            isOff: false,
            positions: cell!.positions,
          },
        ],
      },
    });
    expect(saved.status).toBe(200);
  });
});
