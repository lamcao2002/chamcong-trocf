'use client';

import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapPoint = { id: string; name: string; lat: number; lng: number; radiusM: number };

type LocationMapProps = {
  points: MapPoint[];
  center: { lat: number; lng: number };
  brand: string;
  /** Có thì bản đồ ở chế độ đặt ghim: bấm hoặc kéo ghim để đổi toạ độ. */
  onPick?: (position: { lat: number; lng: number }) => void;
  height?: number;
};

const ZOOM = 15;

/** Ghim vẽ bằng CSS: icon mặc định của Leaflet hỏng đường dẫn ảnh khi qua bundler. */
function pinIcon(brand: string) {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${brand}"></span>`,
  });
}

function Behaviour({ center, onPick }: Pick<LocationMapProps, 'center' | 'onPick'>) {
  const map = useMap();

  useMapEvents({
    click: (event) => onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });

  useEffect(() => {
    map.panTo([center.lat, center.lng]);
  }, [map, center.lat, center.lng]);

  // Trong drawer, khung bản đồ chỉ có kích thước thật sau khi trượt xong
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function LocationMap({ points, center, brand, onPick, height = 320 }: LocationMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={ZOOM}
      style={{ height, width: '100%', borderRadius: 10 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Behaviour center={center} onPick={onPick} />
      {points.map((point) => (
        <span key={point.id}>
          <Marker
            position={[point.lat, point.lng]}
            icon={pinIcon(brand)}
            draggable={Boolean(onPick)}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as L.Marker).getLatLng();
                onPick?.({ lat, lng });
              },
            }}
          >
            {onPick ? null : (
              <Tooltip permanent direction="top" offset={[0, -12]}>
                {point.name}
              </Tooltip>
            )}
          </Marker>
          <Circle
            center={[point.lat, point.lng]}
            radius={point.radiusM}
            pathOptions={{ color: brand, weight: 2, dashArray: '6 6', fillOpacity: 0.12 }}
            interactive={false}
          />
        </span>
      ))}
    </MapContainer>
  );
}
