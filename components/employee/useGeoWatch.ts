'use client';

import { useEffect, useState } from 'react';
import type { GeoSample } from '@/lib/domain/geo';

const PERMISSION_DENIED = 1;
const MAX_FIX_AGE_MS = 10_000;
const FIX_TIMEOUT_MS = 20_000;

const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: MAX_FIX_AGE_MS,
  timeout: FIX_TIMEOUT_MS,
};

export type GeoState =
  /** Chưa có quyền và chưa hỏi: hỏi khi nhân viên bấm VÀO/RA CA. */
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ready'; position: GeoSample }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

const sampleOf = ({ coords }: GeolocationPosition): GeoSample => ({
  lat: coords.latitude,
  lng: coords.longitude,
  accuracy: coords.accuracy,
});

/** Quyền đã cấp thì theo dõi ngay; chưa hỏi thì chờ bấm. Trình duyệt không có Permissions API thì theo dõi luôn như cũ. */
async function permissionState(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return null;
  }
}

/**
 * Theo dõi vị trí liên tục để biết trong/ngoài vùng trước khi bấm. `attempt` > 0 là nhân viên đã bấm
 * hoặc bấm Thử lại: theo dõi luôn, trình duyệt sẽ hỏi quyền nếu chưa có.
 */
export function useGeoWatch(attempt: number): GeoState {
  const [state, setState] = useState<GeoState>({ kind: 'locating' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ kind: 'unavailable' });
      return;
    }
    let cancelled = false;
    let watchId: number | null = null;
    const start = () => {
      setState({ kind: 'locating' });
      watchId = navigator.geolocation.watchPosition(
        (position) => setState({ kind: 'ready', position: sampleOf(position) }),
        (error) => {
          if (error.code === PERMISSION_DENIED) setState({ kind: 'denied' });
          // Mất tín hiệu giữa chừng thì giữ vị trí vừa có, chỉ báo lỗi khi chưa đo được lần nào
          else setState((current) => (current.kind === 'ready' ? current : { kind: 'unavailable' }));
        },
        OPTIONS,
      );
    };

    if (attempt > 0) start();
    else {
      void permissionState().then((permission) => {
        if (cancelled) return;
        if (permission === 'prompt') setState({ kind: 'idle' });
        else if (permission === 'denied') setState({ kind: 'denied' });
        else start();
      });
    }
    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [attempt]);

  return state;
}

export type LocateResult =
  { kind: 'ready'; position: GeoSample } | { kind: 'denied' } | { kind: 'unavailable' };

/** Lấy vị trí một lần lúc bấm chấm: chưa có quyền thì trình duyệt hiện hộp xin quyền. */
export function locateOnce(): Promise<LocateResult> {
  if (!('geolocation' in navigator)) return Promise.resolve({ kind: 'unavailable' });
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ kind: 'ready', position: sampleOf(position) }),
      (error) => resolve({ kind: error.code === PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      OPTIONS,
    ),
  );
}
