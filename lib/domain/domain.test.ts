import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vietnamToday } from './date';
import { averagePosition, collectSamples, distanceMeters, nearestZone } from './geo';
import { vietnamHolidays } from './holiday';
import { generatePin } from './pin';

describe('vietnamHolidays', () => {
  it('chỉ gồm các ngày dương lịch cố định của năm', () => {
    expect(vietnamHolidays(2027).map((holiday) => holiday.date)).toEqual([
      '2027-01-01',
      '2027-04-30',
      '2027-05-01',
      '2027-09-02',
    ]);
  });
});

describe('averagePosition', () => {
  it('lấy trung bình cả toạ độ và độ chính xác', () => {
    expect(
      averagePosition([
        { lat: 21, lng: 105, accuracy: 10 },
        { lat: 21.2, lng: 105.2, accuracy: 30 },
      ]),
    ).toEqual({ lat: 21.1, lng: 105.1, accuracy: 20 });
  });
});

describe('generatePin', () => {
  it('luôn đủ 4 chữ số, kể cả số 0 đầu', () => {
    for (let i = 0; i < 500; i += 1) expect(generatePin()).toMatch(/^\d{4}$/);
  });
});

describe('collectSamples', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  type Success = (position: GeolocationPosition) => void;
  type Failure = (error: GeolocationPositionError) => void;

  const fakeGps = () => {
    let success: Success = () => undefined;
    let failure: Failure = () => undefined;
    const clearWatch = vi.fn();
    return {
      clearWatch,
      watchPosition: (onSuccess: Success, onError?: Failure | null) => {
        success = onSuccess;
        failure = onError ?? failure;
        return 1;
      },
      emit: (lat: number) =>
        success({ coords: { latitude: lat, longitude: 105, accuracy: 10 } } as GeolocationPosition),
      fail: (code: number) => failure({ code } as GeolocationPositionError),
    };
  };

  it('dừng ngay khi đủ số lần đo', async () => {
    const gps = fakeGps();
    const progress: number[] = [];
    const result = collectSamples(gps, 3, 1000, (n) => progress.push(n));
    gps.emit(21);
    gps.emit(21.1);
    gps.emit(21.2);
    await expect(result).resolves.toHaveLength(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(gps.clearWatch).toHaveBeenCalledOnce();
  });

  it('hết giờ thì dùng các mẫu đã có', async () => {
    const gps = fakeGps();
    const result = collectSamples(gps, 5, 1000, () => undefined);
    gps.emit(21);
    gps.emit(21.1);
    vi.advanceTimersByTime(1000);
    await expect(result).resolves.toHaveLength(2);
    expect(gps.clearWatch).toHaveBeenCalledOnce();
  });

  it('hết giờ mà chưa có mẫu nào thì báo quá lâu', async () => {
    const gps = fakeGps();
    const result = collectSamples(gps, 5, 1000, () => undefined);
    vi.advanceTimersByTime(1000);
    await expect(result).rejects.toEqual({ code: 3 });
  });

  it('bị từ chối quyền thì báo ngay', async () => {
    const gps = fakeGps();
    const result = collectSamples(gps, 5, 1000, () => undefined);
    gps.fail(1);
    await expect(result).rejects.toEqual({ code: 1 });
  });

  it('lỗi tạm thời không dừng việc đo', async () => {
    const gps = fakeGps();
    const result = collectSamples(gps, 2, 1000, () => undefined);
    gps.fail(2);
    gps.emit(21);
    gps.emit(21.1);
    await expect(result).resolves.toHaveLength(2);
  });
});

describe('vietnamToday', () => {
  it('sang ngày mới theo giờ Việt Nam, không theo UTC', () => {
    expect(vietnamToday(new Date('2026-10-31T16:59:00Z'))).toBe('2026-10-31');
    expect(vietnamToday(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
  });
});

describe('nearestZone', () => {
  const hoanKiem = { id: 'hk', name: 'Hoàn Kiếm', lat: 21.02452, lng: 105.85308, radiusM: 60 };
  const tayHo = { id: 'th', name: 'Tây Hồ', lat: 21.063898, lng: 105.828298, radiusM: 60 };

  it('một độ vĩ khoảng 111 km', () => {
    expect(distanceMeters({ lat: 21, lng: 105 }, { lat: 22, lng: 105 })).toBeCloseTo(111_195, -1);
  });

  it('chọn địa điểm gần nhất, biên bán kính vẫn trong vùng', () => {
    const near = { lat: hoanKiem.lat + 0.0003, lng: hoanKiem.lng };
    expect(nearestZone(near, [tayHo, hoanKiem])).toMatchObject({ location: hoanKiem, inZone: true });

    const edge = distanceMeters(near, hoanKiem);
    expect(nearestZone(near, [{ ...hoanKiem, radiusM: edge }])?.inZone).toBe(true);
    expect(nearestZone(near, [{ ...hoanKiem, radiusM: edge - 1 }])?.inZone).toBe(false);
  });

  it('không có địa điểm thì trả null', () => {
    expect(nearestZone({ lat: 21, lng: 105 }, [])).toBeNull();
  });
});
