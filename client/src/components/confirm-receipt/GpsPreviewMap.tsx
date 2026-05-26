import { useCallback } from 'react';
import L from 'leaflet';
import { MapView } from '@/components/Map';
import type { GeoPosition } from '@/hooks/useGeolocation';

type GpsPreviewMapProps = {
  position: GeoPosition;
};

export default function GpsPreviewMap({ position }: GpsPreviewMapProps) {
  const handleMapReady = useCallback((map: L.Map) => {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    const tappableMap = map as L.Map & { tap?: { disable: () => void } };
    tappableMap.tap?.disable();

    const icon = L.divIcon({
      className: 'custom-gps-marker',
      html: '<div style="width:16px;height:16px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([position.latitude, position.longitude], { icon }).addTo(map);
  }, [position.latitude, position.longitude]);

  return (
    <MapView
      className="h-full w-full"
      initialCenter={{ lat: position.latitude, lng: position.longitude }}
      initialZoom={16}
      onMapReady={handleMapReady}
    />
  );
}
