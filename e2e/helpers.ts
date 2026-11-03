import { request, type APIRequestContext, type Browser, type Page } from '@playwright/test';

export const NEAR = { latitude: 21.02452, longitude: 105.85308, accuracy: 15 };
const PIN = process.env.SEED_PIN || '1234';
const COMPANY = 'PHONHO';

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format();

export async function adminApi(): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000' });
  const login = await api.post('/api/v1/auth/admin/login', {
    data: { companyCode: COMPANY, email: 'ha@phonho.vn', pin: PIN },
  });
  if (!login.ok()) throw new Error(`Không đăng nhập được quản trị: ${login.status()}`);
  return api;
}

type Staff = { id: string; name: string; email: string; pin: string; shiftId: string; tag: string };

/** Tạo nhân viên riêng cho mỗi test, ca kéo dài cả ngày để chạy được bất kể giờ nào. */
export async function newStaff(api: APIRequestContext): Promise<Staff> {
  const tag = `${Date.now().toString(36)}`.toUpperCase();
  const shift = await api.post('/api/v1/shifts', {
    data: {
      code: `E${tag}`.slice(0, 12),
      name: `Ca ${tag}`,
      startTime: '00:00',
      endTime: '23:59',
      breakStart: null,
      breakEnd: null,
      calc: 'block',
      stdHours: 8,
      minFull: 60,
      minHalf: 30,
      graceMin: 5,
      minOt: 30,
      isPart: false,
      noLateCheck: true,
    },
  });
  const shiftId = (await shift.json()).shift.id as string;
  const positions = (await (await api.get('/api/v1/positions')).json()).positions;
  const positionId = positions.find((row: { name: string }) => row.name === 'Phục vụ').id;
  const name = `Thử ${tag}`;
  const email = `e${tag.toLowerCase()}@phonho.vn`;
  const created = await api.post('/api/v1/employees', {
    data: {
      name,
      email,
      contract: 'part_time',
      onboardDate: '2026-01-01',
      role: 'app',
      managerId: null,
      positionId,
      payOverride: null,
      shiftIds: [shiftId],
      locationIds: null,
    },
  });
  const { id, pin } = (await created.json()).employee;
  return { id, name, email, pin, shiftId, tag };
}

export const scheduleToday = (api: APIRequestContext, { id, shiftId }: Staff) =>
  api.put('/api/v1/schedule', {
    data: { cells: [{ employeeId: id, date: today(), shiftIds: [shiftId], isOff: false }] },
  });

export async function adminPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.request.post('/api/v1/auth/admin/login', {
    data: { companyCode: COMPANY, email: 'ha@phonho.vn', pin: PIN },
  });
  return context.newPage();
}

export async function staffPage(browser: Browser, staff: Staff): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    geolocation: NEAR,
    permissions: ['geolocation'],
  });
  await context.request.post('/api/v1/auth/app/login', {
    data: { companyCode: COMPANY, email: staff.email, pin: staff.pin },
  });
  return context.newPage();
}
