import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "./mapStyles.css";
import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: LeafletMap) => void;
  fallbackMessage?: string;
  ariaLabel?: string;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  fallbackMessage = "โหลดแผนที่ไม่ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
  ariaLabel = "แผนที่",
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const onMapReadyRef = useRef<MapViewProps["onMapReady"]>(onMapReady);
  const tileErrorCountRef = useRef(0);
  const tileSuccessRef = useRef(0);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let active = true;

    const initializeMap = async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (!active || !mapContainer.current) return;

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
      tileLayer.on("tileerror", () => {
        tileErrorCountRef.current += 1;
        if (tileErrorCountRef.current >= 4 && tileSuccessRef.current === 0) {
          setTileError(true);
        }
      });
      tileLayer.on("tileload", () => {
        tileSuccessRef.current += 1;
        if (tileSuccessRef.current >= 1) {
          tileErrorCountRef.current = 0;
          setTileError(false);
        }
      });
      tileLayer.addTo(map.current);
      L.control.zoom({ position: "bottomright" }).addTo(map.current);

      onMapReadyRef.current?.(map.current);
    };

    void initializeMap();

    return () => {
      active = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <div className={cn("relative w-full h-[500px]", className)}>
      <div ref={mapContainer} className="h-full w-full" role="region" aria-label={ariaLabel} />
      {tileError && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl border border-amber-100 dark:border-amber-500/40 bg-amber-50/95 dark:bg-amber-950/90 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 shadow-sm backdrop-blur">
          {fallbackMessage}
        </div>
      )}
    </div>
  );
}
