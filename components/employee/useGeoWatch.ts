'use client';

import { useEffect, useState } from 'react';
import type { GeoSample } from '@/lib/domain/geo';

const PERMISSION_DENIED = 1;
const MAX_FIX_AGE_MS = 10_000;
const FIX_TIMEOUT_MS = 20_000;

export type GeoState =
  | { kind: 'locating' }
  | { kind: 'ready'; position: GeoSample }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/** Theo dõi vị trí liên tục để biết trong/ngoài vùng trước khi bấm; `attempt` đổi thì thử lại. */
export function useGeoWatch(attempt: number): GeoState {
  const [state, setState] = useState<GeoState>({ kind: 'locating' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ kind: 'unavailable' });
      return;
    }
    setState({ kind: 'locating' });
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setState({
          kind: 'ready',
          position: { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        }),
      (error) => {
        if (error.code === PERMISSION_DENIED) setState({ kind: 'denied' });
        // Mất tín hiệu giữa chừng thì giữ vị trí vừa có, chỉ báo lỗi khi chưa đo được lần nào
        else setState((current) => (current.kind === 'ready' ? current : { kind: 'unavailable' }));
      },
      { enableHighAccuracy: true, maximumAge: MAX_FIX_AGE_MS, timeout: FIX_TIMEOUT_MS },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [attempt]);

  return state;
}
