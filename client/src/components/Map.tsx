import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
  fallbackMessage?: string;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  fallbackMessage = "โหลดแผนที่ไม่ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: false,
      preferCanvas: true,
    });

    const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd",
    });
    tileLayer.on("tileerror", () => setTileError(true));
    tileLayer.on("tileload", () => setTileError(false));
    tileLayer.addTo(map.current);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);

    if (onMapReady) onMapReady(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter.lat, initialCenter.lng, initialZoom, onMapReady]);

  return (
    <div className={cn("relative w-full h-[500px]", className)}>
      <div ref={mapContainer} className="h-full w-full" />
      {tileError && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl border border-amber-100 bg-amber-50/95 px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm backdrop-blur">
          {fallbackMessage}
        </div>
      )}
    </div>
  );
}
