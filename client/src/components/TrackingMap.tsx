import { useEffect, useRef, useState, useCallback, useMemo, memo, type MouseEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapStyles.css';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';
import type { ParcelRouteSample } from '@/types/parcel';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { useRouteSamples } from '@/hooks/useRouteSamples';

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
  trackingID?: string;
  routeSamples?: ParcelRouteSample[];
  className?: string;
  mapClassName?: string;
}

function thinRouteSamples<T extends { latitude?: number; longitude?: number; timestamp: string }>(samples: T[], maxSamples = 300): T[] {
  const valid = samples.filter(sample =>
    typeof sample.latitude === 'number' &&
    typeof sample.longitude === 'number' &&
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude),
  );
  if (valid.length <= maxSamples) return valid;
  const step = Math.ceil(valid.length / maxSamples);
  return valid.filter((_, index) => index === 0 || index === valid.length - 1 || index % step === 0);
}

function TrackingMap({ events, trackingID, routeSamples: syncedRouteSamples = [], className = '', mapClassName = 'h-[250px] sm:h-[300px] md:h-[400px] max-h-[50vh]' }: TrackingMapProps) {
  const mapRef      = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);
  const didFitBoundsRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [followLatest, setFollowLatest] = useState(false);
  const routeSamples = useRouteSamples(trackingID);

  // Derive the ordered list of coordinate-bearing events from the timeline.
  // ใช้เฉพาะ GPS จริงจาก events — ไม่ fallback ไปหา branch coordinates
  const { pathEntries, hasUnresolved } = useMemo(() => {
    const entries: { lat: number; lng: number; label: string; isGps: boolean; isLast: boolean; isRouteSample?: boolean; event: TimelineEvent }[] = [];
    const hasSyncedRouteSamples = syncedRouteSamples.some(sample =>
      typeof sample.latitude === 'number' &&
      typeof sample.longitude === 'number' &&
      Number.isFinite(sample.latitude) &&
      Number.isFinite(sample.longitude),
    );

    for (const e of events) {
      if (e.kind === 'routeSample' && hasSyncedRouteSamples) continue;
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
          label: e.kind === 'routeSample' ? 'ตำแหน่งระหว่างส่ง' : e.location || 'GPS',
          isGps: true,
          isLast: false,
          isRouteSample: e.kind === 'routeSample',
          event: e,
        });
      }
    }

    const remoteSamples = thinRouteSamples(syncedRouteSamples);
    const localSamples = routeSamples.filter(sample => !sample.synced);
    const localIds = new Set(localSamples.map(sample => sample.id));
    const mapSamples = [
      ...remoteSamples.filter(sample => !localIds.has(sample.id)),
      ...localSamples,
    ];

    for (const sample of thinRouteSamples(mapSamples)) {
      entries.push({
        lat: sample.latitude as number,
        lng: sample.longitude as number,
        label: 'ตำแหน่งระหว่างส่ง',
        isGps: true,
        isLast: false,
        isRouteSample: true,
        event: {
          id: sample.id,
          status: 'completed',
          title: 'ตำแหน่งระหว่างส่ง',
          description: sample.accuracy ? `ความแม่นยำประมาณ ${Math.round(sample.accuracy)} เมตร` : undefined,
          timestamp: sample.timestamp,
          location: 'GPS',
          latitude: sample.latitude,
          longitude: sample.longitude,
        },
      });
    }

    const orderedEntries = [...entries].sort((a, b) => {
      const aTime = Date.parse(a.event.timestamp || '');
      const bTime = Date.parse(b.event.timestamp || '');
      if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    });

    // Deduplicate consecutive identical coordinates
    const deduped = orderedEntries.filter((entry, i, arr) => {
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
  }, [events, routeSamples, syncedRouteSamples]);

  const hasRouteData = pathEntries.length > 0;
  const latestRouteEntry = [...pathEntries].reverse().find(entry => entry.isRouteSample) ?? pathEntries[pathEntries.length - 1];
  const latestRouteTimestamp = latestRouteEntry?.event.timestamp ? formatThaiDateTime(latestRouteEntry.event.timestamp) : null;
  const hasCreatedPoint = pathEntries.some(entry => entry.event.title === 'สร้างรายการส่ง');

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

    if (!hasRouteData) {
      // Clear layers when no route data
      markersByIdRef.current.forEach(marker => marker.remove());
      markersByIdRef.current.clear();
      polylineRef.current?.remove();
      polylineRef.current = null;
      didFitBoundsRef.current = false;
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 7);
      return;
    }

    const nextIds = new Set<string>();
    const makeMarkerId = (entry: typeof pathEntries[number]) => `${entry.event.id ?? `${entry.lat},${entry.lng},${entry.event.timestamp}`}`;

    pathEntries.forEach((entry, index) => {
      const { lat, lng, label, isGps, isLast, event } = entry;
      const eventDate = event.timestamp ? formatThaiDateTime(event.timestamp) : '';
      const safeLabel     = escapeHtml(label || 'GPS');
      const isDeliveredPoint = event.title === 'ส่งสำเร็จ';
      const isRouteSample = entry.isRouteSample;
      const isLatestRoutePoint = isLast && isRouteSample;
      const isStartPoint = !isDeliveredPoint && (
        event.title === 'สร้างรายการส่ง' ||
        (!hasCreatedPoint && index === 0)
      );
      const iconName = isStartPoint ? 'inventory_2' : isDeliveredPoint ? 'task_alt' : isLatestRoutePoint ? 'my_location' : isRouteSample ? 'near_me' : 'local_shipping';
      const markerColor = isStartPoint ? '#2563eb' : isDeliveredPoint ? '#16a34a' : isLatestRoutePoint ? '#0891b2' : isRouteSample ? '#7c3aed' : '#0f172a';
      const markerRing  = isStartPoint
        ? 'rgba(37,99,235,0.18)'
        : isDeliveredPoint
          ? 'rgba(22,163,74,0.18)'
          : isLatestRoutePoint
            ? 'rgba(8,145,178,0.20)'
            : 'rgba(15,23,42,0.18)';

      const html = `<div title="${safeLabel}" style="position:relative;width:42px;height:42px;filter:drop-shadow(0 10px 18px rgba(15,23,42,.22));">
        <div style="position:absolute;inset:0;border-radius:16px;background:${markerRing};"></div>
        <div style="position:absolute;left:5px;top:5px;width:32px;height:32px;display:grid;place-items:center;border-radius:12px;background:${markerColor};border:3px solid #fff;color:#fff;box-shadow:0 5px 14px rgba(15,23,42,.18);">
          <span class="material-symbols-outlined" aria-hidden="true" style="font-size:17px;line-height:1;">${iconName}</span>
        </div>
        <div style="position:absolute;left:18px;top:37px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid ${markerColor};filter:drop-shadow(0 2px 1px rgba(15,23,42,.12));"></div>
        ${isLast ? `<div style="position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);border-radius:16px;border:2px solid ${isLatestRoutePoint ? 'rgba(8,145,178,.38)' : 'rgba(15,23,42,.22)'};animation:logitrack-pin-pulse 1.6s infinite;"></div>` : ''}
      </div>`;

      const markerId = makeMarkerId(entry);
      nextIds.add(markerId);
      const existingMarker = markersByIdRef.current.get(markerId);
      const nextIcon = L.divIcon({
        html,
        className: 'branch-marker bg-transparent',
        iconSize: [42, 50],
        iconAnchor: [21, 46],
        popupAnchor: [0, -42],
      });

      if (existingMarker) {
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(nextIcon);
        return;
      }

      const marker = L.marker([lat, lng], { icon: nextIcon });

      // Safe popup — use textContent via DOM, not innerHTML
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'padding:4px 2px 2px;font-family:Manrope,sans-serif;min-width:230px;max-width:280px';

      const badge = document.createElement('div');
      badge.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:${isStartPoint ? '#eff6ff' : isDeliveredPoint ? '#f0fdf4' : '#0f172a'};color:${isStartPoint ? '#2563eb' : isDeliveredPoint ? '#15803d' : '#ffffff'};font-size:11px;font-weight:900;margin-bottom:8px`;
      badge.textContent = isStartPoint ? 'จุดเริ่มต้น' : isDeliveredPoint ? 'ปลายทาง' : isRouteSample ? 'เส้นทางจริง' : 'กำลังจัดส่ง';

      if (isLatestRoutePoint) badge.textContent = 'ตำแหน่งล่าสุด';

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
        sub.textContent = `ตำแหน่ง GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } else {
        sub.textContent = isLast ? 'จุดล่าสุดของรายการนี้' : 'จุดแวะพักระหว่างทาง';
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
      footer.textContent = isRouteSample ? 'บันทึกจาก GPS ระหว่างพนักงานส่ง' : 'คลิกหมุดอื่นเพื่อดูรายละเอียดจุดนั้น';

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

    const coords = pathEntries.map(e => [e.lat, e.lng] as [number, number]);
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(
        coords,
        { color: '#2563eb', opacity: 0.9, weight: 5, lineCap: 'round', lineJoin: 'round' },
      ).addTo(map);
    } else {
      polylineRef.current.setLatLngs(coords);
    }

    // Remove stale markers
    markersByIdRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersByIdRef.current.delete(id);
      }
    });

    // Fit bounds only once per dataset (avoid annoying map jumps when new samples stream in)
    if (!didFitBoundsRef.current) {
      if (coords.length > 1) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [40, 40] });
        if (map.getZoom() > 14) map.setZoom(14);
      } else if (coords.length === 1) {
        map.setView(coords[0], 13);
      }
      didFitBoundsRef.current = true;
    } else if (followLatest && coords.length > 0) {
      const latest = coords[coords.length - 1];
      map.panTo(latest, { animate: true });
    }
  }, [followLatest, hasRouteData, isMapReady, pathEntries]);

  useEffect(() => {
    // Reset bounds fitting when tracking changes
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

  const toggleFollowLatest = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setFollowLatest(value => !value);
  };

  return (
    <div className={`tracking-map relative flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#050915] shadow-sm ${className}`}>
      {!hasRouteData && (
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/10 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-[11px] font-semibold text-blue-700 dark:text-blue-200">
          <span className="material-symbols-outlined text-base" aria-hidden="true">info</span>
          ยังไม่มีตำแหน่ง GPS — แผนที่จะแสดงเมื่อมีการสร้างรายการหรือยืนยันการจัดส่ง
        </div>
      )}
      {hasRouteData && hasUnresolved && (
        <div className="flex items-center gap-2 border-b border-amber-100 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
          <span className="material-symbols-outlined text-base" aria-hidden="true">warning</span>
          บางจุดไม่มีตำแหน่ง GPS จึงไม่แสดงบนแผนที่
        </div>
      )}
      {hasRouteData && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl border border-white/80 dark:border-white/15 bg-white/95 dark:bg-[#020617]/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold leading-none text-slate-800 dark:text-slate-100">แผนที่การจัดส่ง</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-400">{pathEntries.length} จุดตำแหน่ง</p>
        </div>
      )}
      {hasRouteData && latestRouteTimestamp && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-xl border border-cyan-100 dark:border-cyan-500/40 bg-white/95 dark:bg-[#020617]/95 px-3 py-2 text-right shadow-sm backdrop-blur">
          <p className="text-[10px] font-black text-cyan-700 dark:text-cyan-300">ตำแหน่งล่าสุด</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-300">{latestRouteTimestamp}</p>
        </div>
      )}
      <MapView
        className={`${mapClassName} w-full shrink-0`}
        initialCenter={DEFAULT_CENTER}
        initialZoom={7}
        onMapReady={handleMapReady}
        fallbackMessage="โหลดแผนที่ไม่ได้ แต่ข้อมูลรายการส่งยังใช้งานได้ตามปกติ"
      />
      {!hasRouteData && (
        <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[500] mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-white/80 dark:border-white/10 bg-white/95 dark:bg-[#020617]/95 p-4 text-center shadow-sm backdrop-blur">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-500" aria-hidden="true">location_off</span>
          <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">ยังไม่มีพิกัดสำหรับแสดงบนแผนที่</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">ระบบจะแสดงเส้นทางเมื่อมีข้อมูล GPS จากการสร้างรายการหรือยืนยันการจัดส่ง</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-[#020617] px-4 py-2.5 text-[10px] font-semibold text-slate-400 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> จุดเริ่มต้น
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-400" /> กำลังส่ง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-600" /> ปลายทาง
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasRouteData && (
            <button
              type="button"
              onClick={toggleFollowLatest}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${
                followLatest
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200'
              }`}
            >
              {followLatest ? 'หยุดติดตาม' : 'ติดตามล่าสุด'}
            </button>
          )}
          <span className="hidden text-slate-300 sm:inline dark:text-slate-200">ShipTrack Maps</span>
        </div>
      </div>
    </div>
  );
}

export default memo(TrackingMap);
