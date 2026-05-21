import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import L from 'leaflet';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';
import { formatThaiDateTime } from '@/lib/dateUtils';

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }; // กรุงเทพฯ

/** Escape a string so it is safe to embed in HTML attribute/text context. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TrackingMapProps {
  events: TimelineEvent[];
  className?: string;
  mapClassName?: string;
}

function TrackingMap({ events, className = '', mapClassName = 'h-[250px] sm:h-[300px] md:h-[400px] max-h-[50vh]' }: TrackingMapProps) {
  const mapRef      = useRef<L.Map | null>(null);
  const markersRef  = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Derive the ordered list of coordinate-bearing events from the timeline.
  // ใช้เฉพาะ GPS จริงจาก events — ไม่ fallback ไปหา branch coordinates
  const { pathEntries, hasUnresolved } = useMemo(() => {
    const entries: { lat: number; lng: number; label: string; isGps: boolean; isLast: boolean; event: TimelineEvent }[] = [];

    for (const e of events) {
      // ใช้เฉพาะ GPS จริงเท่านั้น
      if (
        typeof e.latitude === 'number' &&
        typeof e.longitude === 'number' &&
        isFinite(e.latitude) &&
        isFinite(e.longitude)
      ) {
        entries.push({
          lat: e.latitude,
          lng: e.longitude,
          label: e.location || 'GPS',
          isGps: true,
          isLast: false,
          event: e,
        });
      }
    }

    // Deduplicate consecutive identical coordinates
    const deduped = entries.filter((entry, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return entry.lat !== prev.lat || entry.lng !== prev.lng;
    });

    // Mark the last entry
    if (deduped.length > 0) {
      deduped[deduped.length - 1].isLast = true;
    }

    // hasUnresolved = มี event ที่ไม่มี GPS (แสดงเพื่อ inform user)
    const hasUnresolved = events.some(e =>
      e.title !== 'สร้างรายการส่ง' &&
      e.status === 'completed' &&
      (typeof e.latitude !== 'number' || typeof e.longitude !== 'number')
    );

    return { pathEntries: deduped, hasUnresolved };
  }, [events]);

  const hasRouteData = pathEntries.length > 0;
  const hasCreatedPoint = pathEntries.some(entry => entry.event.title === 'สร้างรายการส่ง');

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const map = mapRef.current;

    // Clear previous markers and polyline
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polylineRef.current?.remove();
    polylineRef.current = null;

    if (!hasRouteData) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 7);
      return;
    }

    pathEntries.forEach((entry, index) => {
      const { lat, lng, label, isGps, isLast, event } = entry;
      const eventDate = event.timestamp ? formatThaiDateTime(event.timestamp) : '';
      const safeLabel     = escapeHtml(label || 'GPS');
      const isDeliveredPoint = event.title === 'ส่งสำเร็จ';
      const isStartPoint = !isDeliveredPoint && (
        event.title === 'สร้างรายการส่ง' ||
        (!hasCreatedPoint && index === 0)
      );
      const iconName = isStartPoint ? 'inventory_2' : isDeliveredPoint ? 'task_alt' : 'local_shipping';
      const markerColor = isStartPoint ? '#855300' : isDeliveredPoint ? '#008060' : '#091426';
      const markerRing  = isStartPoint
        ? 'rgba(133,83,0,0.2)'
        : isDeliveredPoint
          ? 'rgba(0,128,96,0.2)'
          : 'rgba(9,20,38,0.22)';

      const html = `<div title="${safeLabel}" style="position:relative;width:44px;height:54px;filter:drop-shadow(0 8px 14px rgba(9,20,38,.28));">
        <svg viewBox="0 0 44 54" width="44" height="54" aria-hidden="true" style="position:absolute;left:0;top:0;overflow:visible;">
          <path d="M22 2C11.5 2 4 9.7 4 19.6C4 32.8 22 52 22 52C22 52 40 32.8 40 19.6C40 9.7 32.5 2 22 2Z" fill="${markerRing}" opacity="0.95"/>
          <path d="M22 6C13.8 6 8 12 8 19.8C8 29.8 22 45.5 22 45.5C22 45.5 36 29.8 36 19.8C36 12 30.2 6 22 6Z" fill="${markerColor}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
        </svg>
        <div style="position:absolute;left:50%;top:12px;width:24px;height:24px;transform:translateX(-50%);display:grid;place-items:center;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;">
          <span class="material-symbols-outlined" style="font-size:17px;line-height:1;">${iconName}</span>
        </div>
        ${isLast ? '<div style="position:absolute;left:50%;top:2px;width:44px;height:44px;transform:translateX(-50%);border-radius:999px;border:2px solid rgba(9,20,38,.35);animation:logitrack-pin-pulse 1.6s infinite;"></div>' : ''}
      </div>`;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: 'branch-marker bg-transparent',
          iconSize: [44, 54],
          iconAnchor: [22, 52],
          popupAnchor: [0, -50],
        }),
      });

      // Safe popup — use textContent via DOM, not innerHTML
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'padding:4px 2px 2px;font-family:Manrope,sans-serif;min-width:230px;max-width:280px';

      const badge = document.createElement('div');
      badge.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:${isStartPoint ? '#fff4df' : isDeliveredPoint ? '#eef8f3' : '#091426'};color:${isStartPoint ? '#855300' : isDeliveredPoint ? '#006b50' : '#ffffff'};font-size:11px;font-weight:900;margin-bottom:8px`;
      badge.textContent = isStartPoint ? 'จุดเริ่มต้น' : isDeliveredPoint ? 'ปลายทาง' : 'กำลังจัดส่ง';

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
      if (isGps) {
        sub.textContent = `พิกัด GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } else {
        sub.textContent = isLast ? 'จุดล่าสุดของพัสดุ' : 'จุดแวะพักระหว่างทาง';
      }

      popupEl.append(badge, title, sub);

      // Show image if available
      if (event.imageUrl) {
        const img = document.createElement('img');
        img.src = event.imageUrl;
        img.style.cssText = 'width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px';
        img.alt = 'หลักฐาน';
        img.onerror = () => {
          img.remove();
        };
        popupEl.appendChild(img);
      }

      // Show timestamp if available
      if (eventDate) {
        const time = document.createElement('div');
        time.style.cssText = 'margin-top:8px;font-size:11px;color:#61646b;font-weight:800';
        time.textContent = eventDate;
        popupEl.appendChild(time);
      }

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #eef1f6;font-size:11px;color:#855300;font-weight:900';
      footer.textContent = 'คลิกหมุดอื่นเพื่อดูรายละเอียดจุดนั้น';

      popupEl.appendChild(footer);
      marker.bindPopup(popupEl, {
        autoPanPadding: [20, 20],
        className: 'logitrack-popup',
        closeButton: true,
        maxWidth: 300,
      });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    const coords = pathEntries.map(e => [e.lat, e.lng] as [number, number]);
    polylineRef.current = L.polyline(
      coords,
      { color: '#ff6b00', opacity: 0.85, weight: 6, lineCap: 'round', lineJoin: 'round', dashArray: '10, 12' },
    ).addTo(map);

    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
      if (map.getZoom() > 14) map.setZoom(14);
    } else {
      map.setView(coords[0], 13);
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      polylineRef.current?.remove();
      polylineRef.current = null;
    };
  }, [hasRouteData, isMapReady, pathEntries]);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(frame);
  }, [isMapReady]);

  const hasGpsMarkers = pathEntries.some(e => e.isGps);

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-md ${className}`}>
      {!hasRouteData && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/10 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          ยังไม่มีข้อมูล GPS — แผนที่จะแสดงเมื่อมีการสร้างรายการหรือยืนยันส่งสำเร็จ
        </div>
      )}
      {hasRouteData && hasUnresolved && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">warning</span>
          บางจุดไม่มีข้อมูล GPS จึงไม่แสดงบนแผนที่
        </div>
      )}
      <MapView
        className={`${mapClassName} w-full flex-1`}
        initialCenter={DEFAULT_CENTER}
        initialZoom={7}
        onMapReady={handleMapReady}
      />
      <div className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/10 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" /> จุดเริ่มต้น
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" /> กำลังส่ง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-600" /> ปลายทาง
          </span>
        </div>
        <span className="text-secondary">LogiTrack Maps</span>
      </div>
    </div>
  );
}

export default memo(TrackingMap);
