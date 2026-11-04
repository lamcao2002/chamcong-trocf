import { config } from 'dotenv';
import postgres from 'postgres';
import { vietnamToday } from '../../lib/domain/date';
import { addDays, weekDay } from '../../lib/engine/time';

config({ path: ['.env.test', '.env.local', '.env'], quiet: true });

export const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
export const COMPANY = 'PHONHO';
export const PIN = process.env.SEED_PIN || '1234';

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl)) {
  // Bộ test ghi và sửa dữ liệu thẳng vào CSDL: không bao giờ chạy trên Supabase
  throw new Error('Test API chỉ chạy trên PostgreSQL ở máy này. Đặt DATABASE_URL trỏ tới localhost.');
}

export const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

export type Response = { status: number; body: Record<string, any>; cookies: string[] };

export async function api(method: string, path: string, options: { cookie?: string; body?: unknown } = {}) {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    // File xuất ra là nhị phân, chỉ JSON mới có `body`
    body: (response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : {}) as Record<
      string,
      any
    >,
    cookies: response.headers.getSetCookie(),
    text,
  };
}

export async function login(
  email: string,
  kind: 'admin' | 'app' = 'admin',
  companyCode = COMPANY,
  pin = PIN,
) {
  const result = await api('POST', `/auth/${kind}/login`, { body: { companyCode, email, pin } });
  if (result.status !== 200) throw new Error(`Không đăng nhập được ${email}: ${result.status}`);
  return result.cookies[0]!.split(';')[0]!;
}

export const auditCount = async (action: string) =>
  (await sql`select count(*)::int as n from audit_logs where action = ${action}`)[0]!.n as number;

let counter = 0;
/** Chuỗi không trùng giữa các lần chạy, vì CSDL test không bị xoá sau mỗi test. */
export function unique(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now().toString(36).slice(-5)}${counter}`.toUpperCase();
}

export const shiftBody = (code = unique('C')) => ({
  code,
  name: `Ca ${code}`,
  startTime: '08:00',
  endTime: '12:00',
  breakStart: null,
  breakEnd: null,
  calc: 'block',
  stdHours: 4,
  minFull: 200,
  minHalf: 100,
  graceMin: 5,
  minOt: 30,
  isPart: false,
  noLateCheck: false,
});

export const positionBody = (shiftId: string, locationId: string) => ({
  name: `Vị trí ${unique('P')}`,
  shiftMode: 'flexible',
  fixedShiftId: null,
  shiftIds: [shiftId],
  workDays: [1, 2, 3, 4, 5],
  anyLocation: false,
  locationIds: [locationId],
  payType: 'hour',
  payAmount: 25000,
  stdDays: 26,
  leaveDays: 12,
  otWeekday: 150,
  otSaturday: null,
  otOffday: 200,
  otHoliday: 300,
});

export const employeeBody = (overrides: object = {}) => ({
  name: 'Nhân viên test',
  email: `${unique('nv').toLowerCase()}@phonho.vn`,
  contract: 'part_time',
  onboardDate: '2026-10-01',
  role: 'app',
  managerId: null,
  positionId: null,
  payOverride: null,
  shiftIds: null,
  locationIds: null,
  ...overrides,
});

export const locationBody = (positionIds: string[] = []) => ({
  name: `Quán ${unique('L')}`,
  address: null,
  lat: 21.03,
  lng: 105.85,
  radiusM: 60,
  positionIds,
});

const mondayOfDate = (date: string) => addDays(date, -((weekDay(date) + 6) % 7));

/**
 * Lưu lịch như quản lý bấm Lưu rồi Công bố: ô từ ngày mai trở đi vào nháp, nên công bố tuần của chúng
 * để test thấy lịch thật. Lưu lỗi thì trả lỗi đó, không công bố.
 */
export async function publishCells(
  cookie: string,
  cells: { employeeId: string; date: string; [field: string]: unknown }[],
) {
  const saved = await api('PUT', '/schedule', { cookie, body: { cells } });
  if (saved.status !== 200) return saved;
  const tomorrow = addDays(vietnamToday(), 1);
  const weeks = new Set(cells.filter(({ date }) => date >= tomorrow).map(({ date }) => mondayOfDate(date)));
  for (const week of weeks) {
    const published = await api('POST', '/schedule/publish', { cookie, body: { week } });
    if (published.status !== 200) return published;
  }
  return saved;
}
