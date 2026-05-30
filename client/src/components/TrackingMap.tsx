import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapStyles.css';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';
import { formatThaiDateTime } from '@/lib/dateUtils';

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };
const MAIN_MARKER_TYPES = new Set([
  'CREATED',
  'PICKUP',
  'START_DELIVERY',
  'FORWARD',
  'DELIVERED',
  'PROXY',
]);

type MarkerEntry = {
  lat: number;
  lng: number;
  label: string;
  isLast: boolean;
  event: TimelineEvent;
};

interface TrackingMapProps {
  events: TimelineEvent[];
  trackingID?: string;
  className?: string;
  mapClassName?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isMainCoordinateEvent(event: TimelineEvent): boolean {
  return (
    !!event.eventType &&
    MAIN_MARKER_TYPES.has(event.eventType) &&
    typeof event.latitude === 'number' &&
    typeof event.longitude === 'number' &&
    Number.isFinite(event.latitude) &&
    Number.isFinite(event.longitude)
  );
}

function TrackingMap({
  events,
  trackingID,
  className = '',
  mapClassName = 'h-[250px] sm:h-[300px] md:h-[400px] max-h-[50vh]',
}: TrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const didFitBoundsRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const { markerEntries, hasUnresolved } = useMemo(() => {
    const orderedEntries = events
      .filter(isMainCoordinateEvent)
      .map<MarkerEntry>(event => ({
        lat: event.latitude!,
        lng: event.longitude!,
        label: event.location || 'GPS',
        isLast: false,
        event,
      }))
      .sort((a, b) => {
        const aTime = Date.parse(a.event.timestamp || '');
        const bTime = Date.parse(b.event.timestamp || '');
        if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
        if (!Number.isFinite(aTime)) return 1;
        if (!Number.isFinite(bTime)) return -1;
        return aTime - bTime;
      });

    const seen = new Set<string>();
    const deduped = orderedEntries.filter(entry => {
      const key = `${entry.lat},${entry.lng},${entry.event.eventType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (deduped.length > 0) {
      deduped[deduped.length - 1].isLast = true;
    }

    const unresolved = events.some(event =>
      event.status === 'completed' &&
      !!event.eventType &&
      MAIN_MARKER_TYPES.has(event.eventType) &&
      (typeof event.latitude !== 'number' || typeof event.longitude !== 'number')
    );

    return { markerEntries: deduped, hasUnresolved: unresolved };
  }, [events]);

  const coords = useMemo(
    () => markerEntries.map(entry => L.latLng(entry.lat, entry.lng)),
    [markerEntries],
  );
  const hasLocationData = markerEntries.length > 0;
  const latestTimestamp = markerEntries.at(-1)?.event.timestamp
    ? formatThaiDateTime(markerEntries.at(-1)!.event.timestamp)
    : null;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const map = mapRef.current;

    if (!markerGroupRef.current) {
      markerGroupRef.current = L.layerGroup().addTo(map);
    }

    if (!hasLocationData) {
      markersByIdRef.current.forEach(marker => marker.remove());
      markersByIdRef.current.clear();
      didFitBoundsRef.current = false;
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 7);
      return;
    }

    const nextIds = new Set<string>();
    const makeMarkerId = (entry: MarkerEntry) =>
      `${entry.event.eventType ?? 'point'}:${entry.event.id ?? `${entry.lat},${entry.lng},${entry.event.timestamp}`}`;

    markerEntries.forEach(entry => {
      const { lat, lng, label, isLast, event } = entry;
      const eventDate = event.timestamp ? formatThaiDateTime(event.timestamp) : '';
      const safeLabel = escapeHtml(label || 'GPS');
      const isStartPoint = event.eventType === 'CREATED';
      const isDeliveredPoint = event.eventType === 'DELIVERED' || event.eventType === 'PROXY';
      const isForwardPoint = event.eventType === 'FORWARD';
      const iconName = isStartPoint ? 'inventory_2' : isDeliveredPoint ? 'task_alt' : isForwardPoint ? 'storefront' : 'local_shipping';
      const markerColor = isStartPoint ? '#2563eb' : isDeliveredPoint ? '#16a34a' : isForwardPoint ? '#7c3aed' : '#0f172a';
      const markerRing = isStartPoint
        ? 'rgba(37,99,235,0.18)'
        : isDeliveredPoint
          ? 'rgba(22,163,74,0.18)'
          : isForwardPoint
            ? 'rgba(124,58,237,0.18)'
            : 'rgba(15,23,42,0.18)';

      const html = `<div title="${safeLabel}" style="position:relative;width:42px;height:42px;filter:drop-shadow(0 10px 18px rgba(15,23,42,.22));">
        <div style="position:absolute;inset:0;border-radius:16px;background:${markerRing};"></div>
        <div style="position:absolute;left:5px;top:5px;width:32px;height:32px;display:grid;place-items:center;border-radius:12px;background:${markerColor};border:3px solid #fff;color:#fff;box-shadow:0 5px 14px rgba(15,23,42,.18);">
          <span class="material-symbols-outlined" aria-hidden="true" style="font-size:17px;line-height:1;">${iconName}</span>
        </div>
        <div style="position:absolute;left:18px;top:37px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid ${markerColor};filter:drop-shadow(0 2px 1px rgba(15,23,42,.12));"></div>
        ${isLast ? `<div style="position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);border-radius:16px;border:2px solid rgba(15,23,42,.22);animation:logitrack-pin-pulse 1.6s infinite;"></div>` : ''}
      </div>`;

      const markerId = makeMarkerId(entry);
      nextIds.add(markerId);
      const nextIcon = L.divIcon({
        html,
        className: 'branch-marker bg-transparent',
        iconSize: [42, 50],
        iconAnchor: [21, 46],
        popupAnchor: [0, -42],
      });
      const existingMarker = markersByIdRef.current.get(markerId);

      if (existingMarker) {
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(nextIcon);
        return;
      }

      const marker = L.marker([lat, lng], { icon: nextIcon });
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'padding:4px 2px 2px;font-family:Manrope,sans-serif;min-width:230px;max-width:280px';

      const badge = document.createElement('div');
      badge.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:${isStartPoint ? '#eff6ff' : isDeliveredPoint ? '#f0fdf4' : '#0f172a'};color:${isStartPoint ? '#2563eb' : isDeliveredPoint ? '#15803d' : '#ffffff'};font-size:11px;font-weight:900;margin-bottom:8px`;
      badge.textContent = isStartPoint ? 'จุดเริ่มต้น' : isDeliveredPoint ? 'ปลายทาง' : isForwardPoint ? 'ส่งต่อสาขา' : 'จุดรับพัสดุ';

      const title = document.createElement('div');
      title.style.cssText = 'font-weight:900;color:#091426;font-size:15px;line-height:1.25';
      title.textContent = event.title || label || 'ตำแหน่งบนแผนที่';

      if (event.description) {
        const desc = document.createElement('div');
        desc.style.cssText = 'color:#45474c;margin-top:4px;font-size:12px;font-weight:700;line-height:1.4';
        desc.textContent = event.description;
        title.appendChild(desc);
      }

      const sub = document.createElement('div');
      sub.style.cssText = 'color:#61646b;margin-top:8px;font-size:12px;font-weight:700;line-height:1.45';
      sub.textContent = `ตำแหน่ง GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      popupEl.append(badge, title, sub);

      if (event.imageUrl) {
        const img = document.createElement('img');
        img.src = event.imageUrl;
        img.style.cssText = 'width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px';
        img.alt = 'หลักฐาน';
        img.onerror = () => img.remove();
        popupEl.appendChild(img);
      }

      if (eventDate) {
        const time = document.createElement('div');
        time.style.cssText = 'margin-top:8px;font-size:11px;color:#61646b;font-weight:800';
        time.textContent = eventDate;
        popupEl.appendChild(time);
      }

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #eef1f6;font-size:11px;color:#855300;font-weight:900';
      footer.textContent = 'หมุดเหตุการณ์หลัก';
      popupEl.appendChild(footer);

      marker.on('click', () => {
        if (!marker.getPopup()) {
          marker.bindPopup(popupEl, {
            autoPanPadding: [20, 20],
            className: 'logitrack-popup',
            closeButton: true,
            maxWidth: 300,
          });
        }
        marker.openPopup();
      });
      marker.addTo(markerGroupRef.current!);
      markersByIdRef.current.set(markerId, marker);
    });

    markersByIdRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersByIdRef.current.delete(id);
      }
    });

    if (!didFitBoundsRef.current) {
      if (coords.length > 1) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [40, 40] });
        if (map.getZoom() > 14) map.setZoom(14);
      } else if (coords.length === 1) {
        map.setView(coords[0], 13);
      }
      didFitBoundsRef.current = true;
    }
  }, [coords, hasLocationData, isMapReady, markerEntries]);

  useEffect(() => {
    didFitBoundsRef.current = false;
  }, [trackingID]);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isMapReady]);

  return (
    <div className={`tracking-map relative flex w-full flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card ${className}`}>
      {!hasLocationData && (
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/10 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-[11px] font-semibold text-blue-700 dark:text-blue-200">
          <span className="material-symbols-outlined text-base" aria-hidden="true">info</span>
          ยังไม่มีตำแหน่ง GPS จากเหตุการณ์หลัก
        </div>
      )}
      {hasLocationData && hasUnresolved && (
        <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container px-4 py-2.5 text-[11px] font-semibold text-accent">
          <span className="material-symbols-outlined text-base" aria-hidden="true">warning</span>
          บางเหตุการณ์หลักไม่มีตำแหน่ง GPS จึงไม่แสดงบนแผนที่
        </div>
      )}
      {hasLocationData && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl border border-outline-variant bg-surface/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold leading-none text-slate-800 dark:text-slate-100">แผนที่จุดหลัก</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-400">{markerEntries.length} หมุดหลัก</p>
        </div>
      )}
      {hasLocationData && latestTimestamp && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-xl border border-outline-variant bg-surface/95 px-3 py-2 text-right shadow-sm backdrop-blur">
          <p className="text-[10px] font-black text-cyan-700 dark:text-cyan-300">เหตุการณ์ล่าสุด</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-300">{latestTimestamp}</p>
        </div>
      )}
      <MapView
        className={`${mapClassName} w-full shrink-0`}
        initialCenter={DEFAULT_CENTER}
        initialZoom={7}
        onMapReady={handleMapReady}
        fallbackMessage="โหลดแผนที่ไม่ได้ แต่ข้อมูลรายการส่งยังใช้งานได้ตามปกติ"
      />
      {!hasLocationData && (
        <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-white/80 dark:border-white/10 bg-white/95 dark:bg-[#020617]/95 p-4 text-center shadow-sm backdrop-blur">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-500" aria-hidden="true">location_off</span>
          <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">ยังไม่มีพิกัดสำหรับแสดงบนแผนที่</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">ระบบจะแสดงหมุดเมื่อมีตำแหน่ง GPS จากเหตุการณ์หลัก</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-[#020617] px-4 py-2.5 text-[10px] font-semibold text-slate-400 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> จุดเริ่มต้น
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-400" /> รับงาน/รับของ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-600" /> ส่งต่อ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-600" /> ปลายทาง
          </span>
        </div>
        <span className="hidden text-slate-300 sm:inline dark:text-slate-200">ShipTrack Maps</span>
      </div>
    </div>
  );
}

export default memo(TrackingMap);
