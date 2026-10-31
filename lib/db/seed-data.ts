/**
 * Dữ liệu mẫu "Cà phê Phố Nhỏ" (S1-04), lấy từ docs/website-analysis và Sprint 1.
 *
 * [Đề xuất] — tài liệu không ghi, ta tự chọn:
 * - Mã công ty, họ tên và email của những người ngoài Hà, Minh, Quỳnh, Ánh, Khánh Linh; quyền hr của Quỳnh.
 * - Địa chỉ Quán Tây Hồ; toạ độ lấy từ một lần chấm mẫu tại quán này.
 * - Giờ chuẩn ca ghép, ngày lễ thứ 5 (01/09, ngày liền kề Quốc khánh).
 * - Bậc lương chưa có trong MVP: mức của vị trí là Bậc 1 (10 triệu), người bậc trên dùng `payOverride`.
 */
import type { PayOverride } from './schema';

export const SEED_COMPANY = {
  code: 'PHONHO',
  name: 'Cà phê Phố Nhỏ',
  address: '12 Hàng Bài, Hoàn Kiếm, Hà Nội',
  appName: 'Phố Nhỏ Chấm công',
  brandColor: '#7B5236',
};

export const SEED_LOCATIONS = {
  HK: {
    name: 'Quán Hoàn Kiếm',
    address: '12 Hàng Bài, Hoàn Kiếm, Hà Nội',
    lat: 21.02452,
    lng: 105.85308,
    radiusM: 60,
  },
  TH: {
    name: 'Quán Tây Hồ',
    address: 'Quảng An, Tây Hồ, Hà Nội',
    lat: 21.063898,
    lng: 105.828298,
    radiusM: 60,
  },
};

type LocationKey = keyof typeof SEED_LOCATIONS;

const FULL_SHIFT = { stdHours: 7.5, minFull: 420, minHalf: 210, graceMin: 5, minOt: 30 };
const PART_SHIFT = { stdHours: 5, minFull: 270, minHalf: 150, graceMin: 5, minOt: 30, isPart: true };

export const SEED_SHIFTS = [
  {
    code: 'CA1',
    name: 'Ca 1 (6h–14h)',
    startTime: '06:00',
    endTime: '14:00',
    breakStart: '10:00',
    breakEnd: '10:30',
    ...FULL_SHIFT,
  },
  {
    code: 'CA2',
    name: 'Ca 2 (14h–22h)',
    startTime: '14:00',
    endTime: '22:00',
    breakStart: '18:00',
    breakEnd: '18:30',
    ...FULL_SHIFT,
  },
  { code: 'SANG', name: 'Ca sáng', startTime: '07:00', endTime: '12:00', ...PART_SHIFT },
  { code: 'CHIEU', name: 'Ca chiều', startTime: '12:00', endTime: '17:00', ...PART_SHIFT },
  { code: 'TOI', name: 'Ca tối', startTime: '17:00', endTime: '22:00', ...PART_SHIFT },
  {
    code: 'TV2',
    name: 'Tạp vụ (6h–8h)',
    startTime: '06:00',
    endTime: '08:00',
    stdHours: 2,
    minFull: 90,
    minHalf: 45,
    graceMin: 0,
    minOt: 30,
    noLateCheck: true,
  },
];

type ShiftCode = (typeof SEED_SHIFTS)[number]['code'];

type SeedPosition = {
  name: string;
  shiftMode: 'fixed' | 'flexible';
  shifts: ShiftCode[];
  payType: 'month' | 'hour' | 'unit';
  payAmount: number;
};

export const SEED_POSITIONS: SeedPosition[] = [
  {
    name: 'Quản lý ca',
    shiftMode: 'flexible',
    shifts: ['CA1', 'CA2'],
    payType: 'month',
    payAmount: 10_000_000,
  },
  { name: 'Thu ngân', shiftMode: 'flexible', shifts: ['CA1', 'CA2'], payType: 'month', payAmount: 7_000_000 },
  {
    name: 'Pha chế',
    shiftMode: 'flexible',
    shifts: ['SANG', 'CHIEU', 'TOI'],
    payType: 'hour',
    payAmount: 28_000,
  },
  {
    name: 'Phục vụ',
    shiftMode: 'flexible',
    shifts: ['SANG', 'CHIEU', 'TOI'],
    payType: 'hour',
    payAmount: 25_000,
  },
  { name: 'Tạp vụ', shiftMode: 'fixed', shifts: ['TV2'], payType: 'unit', payAmount: 60_000 },
];

/** Vị trí nào cũng chấm được ở cả hai quán. */
export const SEED_POSITION_LOCATIONS: LocationKey[] = ['HK', 'TH'];

type SeedEmployee = {
  email: string;
  name: string;
  role: 'app' | 'manager' | 'hr' | 'admin';
  contract: 'full_time' | 'part_time';
  onboardDate: string;
  position: string;
  manager?: string;
  payOverride?: PayOverride;
  locations?: LocationKey[];
};

export const SEED_EMPLOYEES: SeedEmployee[] = [
  {
    email: 'ha@phonho.vn',
    name: 'Nguyễn Thu Hà',
    role: 'admin',
    contract: 'full_time',
    onboardDate: '2025-06-01',
    position: 'Quản lý ca',
    payOverride: { payAmount: 12_000_000 },
  },
  {
    email: 'minh@phonho.vn',
    name: 'Trần Đức Minh',
    role: 'manager',
    contract: 'full_time',
    onboardDate: '2025-09-01',
    position: 'Quản lý ca',
    manager: 'ha@phonho.vn',
  },
  {
    email: 'quynh@phonho.vn',
    name: 'Phạm Như Quỳnh',
    role: 'hr',
    contract: 'full_time',
    onboardDate: '2025-10-01',
    position: 'Thu ngân',
    manager: 'ha@phonho.vn',
  },
  {
    email: 'khanhlinh@phonho.vn',
    name: 'Vũ Khánh Linh',
    role: 'app',
    contract: 'full_time',
    onboardDate: '2026-01-05',
    position: 'Pha chế',
    manager: 'minh@phonho.vn',
  },
  {
    email: 'tuan@phonho.vn',
    name: 'Đỗ Anh Tuấn',
    role: 'app',
    contract: 'part_time',
    onboardDate: '2026-03-02',
    position: 'Pha chế',
    manager: 'minh@phonho.vn',
  },
  {
    email: 'anh@phonho.vn',
    name: 'Lê Ngọc Ánh',
    role: 'app',
    contract: 'part_time',
    onboardDate: '2026-02-28',
    position: 'Phục vụ',
    manager: 'ha@phonho.vn',
    locations: ['HK'],
  },
  {
    email: 'nam@phonho.vn',
    name: 'Hoàng Văn Nam',
    role: 'app',
    contract: 'part_time',
    onboardDate: '2026-04-01',
    position: 'Phục vụ',
    manager: 'minh@phonho.vn',
  },
  {
    email: 'hoa@phonho.vn',
    name: 'Bùi Thị Hoa',
    role: 'app',
    contract: 'part_time',
    onboardDate: '2025-11-15',
    position: 'Tạp vụ',
    manager: 'minh@phonho.vn',
  },
];

export const SEED_HOLIDAYS = [
  { date: '2026-01-01', name: 'Tết Dương lịch' },
  { date: '2026-04-30', name: 'Ngày Giải phóng miền Nam' },
  { date: '2026-05-01', name: 'Quốc tế Lao động' },
  { date: '2026-09-01', name: 'Nghỉ Quốc khánh' },
  { date: '2026-09-02', name: 'Quốc khánh' },
];
