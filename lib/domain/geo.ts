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
