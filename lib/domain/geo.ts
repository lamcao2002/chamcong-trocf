export type GeoSample = { lat: number; lng: number; accuracy: number };

/** Trung bình các lần đo vị trí, kèm độ chính xác trung bình để hiện cho người dùng (US07). */
export function averagePosition(samples: readonly GeoSample[]): GeoSample {
  const mean = (pick: (sample: GeoSample) => number) =>
    samples.reduce((sum, sample) => sum + pick(sample), 0) / samples.length;
  return { lat: mean((s) => s.lat), lng: mean((s) => s.lng), accuracy: mean((s) => s.accuracy) };
}

type GeolocationLike = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;

const PERMISSION_DENIED = 1;

/**
 * Gom tối đa `count` lần đo. Hết giờ mà đã có mẫu thì dùng các mẫu đó: GPS trong nhà hay chậm,
 * bỏ cả lượt đo vì một lần trễ sẽ khiến người dùng không lấy được vị trí.
 */
export function collectSamples(
  geolocation: GeolocationLike,
  count: number,
  timeoutMs: number,
  onSample: (collected: number) => void,
): Promise<GeoSample[]> {
  return new Promise((resolve, reject) => {
    const samples: GeoSample[] = [];

    const finish = () => {
      clearTimeout(timer);
      geolocation.clearWatch(watchId);
    };
    const settle = (failure: unknown) => {
      finish();
      if (samples.length > 0) resolve(samples);
      else reject(failure instanceof Error || failure ? failure : new Error('Không có lần đo nào'));
    };

    const watchId = geolocation.watchPosition(
      ({ coords }) => {
        samples.push({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
        onSample(samples.length);
        if (samples.length >= count) {
          finish();
          resolve(samples);
        }
      },
      (error) => {
        if (error.code === PERMISSION_DENIED) settle(error);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
    const timer = setTimeout(() => settle({ code: 3 }), timeoutMs);
  });
}

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Khoảng cách theo đường tròn lớn (haversine), đủ chính xác ở quy mô vài km. */
export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

type Zone = { id: string; name: string; lat: number; lng: number; radiusM: number };

export type ZoneCheck<T extends Zone> = { location: T; distanceM: number; inZone: boolean };

/** Địa điểm gần nhất; trong vùng khi khoảng cách không vượt bán kính, không cộng sai số GPS. */
export function nearestZone<T extends Zone>(
  point: { lat: number; lng: number },
  zones: readonly T[],
): ZoneCheck<T> | null {
  const checks = zones.map((location) => {
    const distanceM = distanceMeters(point, location);
    return { location, distanceM, inZone: distanceM <= location.radiusM };
  });
  return checks.sort((a, b) => a.distanceM - b.distanceM)[0] ?? null;
}
