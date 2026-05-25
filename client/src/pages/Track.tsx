/**
 * Track Page
 */

import { useState, useEffect, useMemo } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import { toast } from 'sonner';
import type { Parcel } from '@/types/parcel';
import { getParcel, searchParcels } from '@/lib/parcelService';
import { parseParcelTimeline } from '@/lib/timeline';
import TrackingMap from '@/components/TrackingMap';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { UI_COPY } from '@/lib/uiCopy';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  clearCreatedParcelHistory,
  getCreatedParcelProofPhoto,
  getCreatedParcelHistory,
  removeCreatedParcelHistoryItem,
  updateCreatedParcelHistoryFromParcel,
  type CreatedParcelHistoryItem,
} from '@/lib/createdParcelHistory';

const TRACK_RESULTS_BATCH_SIZE = 12;

const hydrateLocalProofPhoto = (parcel: Parcel): Parcel => {
  if (parcel['รูปยืนยัน']) return parcel;
  const proofPhotoUrl = getCreatedParcelProofPhoto(parcel.TrackingID);
  return proofPhotoUrl ? { ...parcel, 'รูปยืนยัน': proofPhotoUrl } : parcel;
};

export default function Track({ embedded = false }: { embedded?: boolean }) {
  const [trackingId, setTrackingId] = useState('');
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [searchResults, setSearchResults] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleSearchResultCount, setVisibleSearchResultCount] = useState(TRACK_RESULTS_BATCH_SIZE);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [createdHistory, setCreatedHistory] = useState<CreatedParcelHistoryItem[]>([]);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only keep plain strings, discard anything else
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((x): x is string => typeof x === 'string').slice(0, 5));
        }
      }
    } catch {
      localStorage.removeItem('recent_searches');
    }
  }, []);

  useEffect(() => {
    const syncHistory = () => setCreatedHistory(getCreatedParcelHistory());
    syncHistory();
    window.addEventListener('doc-track-created-parcels-updated', syncHistory);
    return () => window.removeEventListener('doc-track-created-parcels-updated', syncHistory);
  }, []);

  const addToRecent = (id: string) => {
    const safeId = sanitizeTextInput(id, 100).toUpperCase();
    if (!safeId) return;
    const next = [safeId, ...recentSearches.filter(i => i !== safeId)].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem('recent_searches', JSON.stringify(next));
  };

  const removeFromRecent = (id: string) => {
    const next = recentSearches.filter(i => i !== id);
    setRecentSearches(next);
    localStorage.setItem('recent_searches', JSON.stringify(next));
  };

  const handleSearch = async (e?: React.FormEvent, searchId?: string) => {
    if (e) e.preventDefault();
    const id = sanitizeTextInput(searchId ?? trackingId, 100).toUpperCase();
    if (!id) { toast.error('กรุณากรอกหมายเลขติดตาม ชื่อผู้รับ หรือสถานที่ปลายทาง'); return; }
    // ✅ FIX: sync input display with what we're actually searching
    if (searchId && searchId !== trackingId) setTrackingId(searchId);
    setNotFoundQuery(null);
    setVisibleSearchResultCount(TRACK_RESULTS_BATCH_SIZE);
    setIsLoading(true);
    try {
      const res = await getParcel(id);
      if (res.success && res.parcel) {
        const hydratedParcel = hydrateLocalProofPhoto(res.parcel);
        updateCreatedParcelHistoryFromParcel(hydratedParcel);
        setParcel(hydratedParcel); setSearchResults([]); addToRecent(hydratedParcel.TrackingID);
        setNotFoundQuery(null);
        toast.success('พบรายการส่ง');
      } else {
        const directTrackingLookup = isValidTrackingId(id);
        const lookupMiss = (res.error ?? '').includes('ไม่พบ') || (res.error ?? '').includes('รูปแบบ');
        if (directTrackingLookup && res.error && !lookupMiss) {
          setParcel(null);
          setSearchResults([]);
          setNotFoundQuery(null);
          toast.error(res.error);
          return;
        }
        const results = await searchParcels(id);
        if (results?.length) {
          const hydratedResults = results.map(hydrateLocalProofPhoto);
          if (results.length === 1) {
            updateCreatedParcelHistoryFromParcel(hydratedResults[0]);
            setParcel(hydratedResults[0]); setSearchResults([]); addToRecent(hydratedResults[0].TrackingID);
          }
          else { setSearchResults(hydratedResults); setParcel(null); }
          setNotFoundQuery(null);
          toast.success(`พบข้อมูล ${results.length} รายการ`);
        } else {
          setParcel(null); setSearchResults([]); setNotFoundQuery(id); toast.error(res.error && directTrackingLookup ? res.error : 'ไม่พบรายการส่ง');
        }
      }
    } catch { setNotFoundQuery(null); toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ'); }
    finally { setIsLoading(false); }
  };

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      const safeText = sanitizeTextInput(t, 100).toUpperCase();
      if (safeText) { setTrackingId(safeText); toast.success('วางหมายเลขติดตามเรียบร้อย'); }
    } catch { toast.error('ไม่สามารถวางข้อมูลได้'); }
  };

  const timelineEvents = useMemo(() => parcel ? parseParcelTimeline(parcel) : [], [parcel]);
  const visibleSearchResults = searchResults.slice(0, visibleSearchResultCount);

  /** True when we have GPS location data to display on the map. */
  const hasLocationData = useMemo(() => {
    if (!parcel) return false;
    // เช็คเฉพาะ GPS จริงจาก events
    return timelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    );
  }, [parcel, timelineEvents]);

  return (
    <div className={`${embedded ? 'max-w-none pb-4' : 'app-page'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>

      {/* Header */}
      <section className={`${embedded ? 'hidden' : 'app-page-header'}`}>
        <div>
          <h1 className="app-page-title">{UI_COPY.nav.track}</h1>
          <p className="app-page-subtitle">ค้นหาด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง</p>
        </div>
      </section>

      {/* Search box */}
      <div className="app-card overflow-hidden">
        <div className="app-panel-header">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-base">travel_explore</span>
            </div>
            <div>
              <h2 className="app-section-title">ค้นหารายการส่ง</h2>
              <p className="text-xs text-muted-foreground">ตรวจสถานะ ปลายทาง และประวัติการเคลื่อนไหว</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="group relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground transition-colors group-focus-within:text-primary">search</span>
              <input
                placeholder="กรอกหมายเลขติดตาม ผู้รับ หรือปลายทาง..."
                value={trackingId}
                onChange={e => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
                autoFocus
                className="app-input h-12 w-full pl-11 pr-12 text-base font-semibold"
              />
              <button type="button" onClick={handlePaste}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                title="วางจากคลิปบอร์ด">
                <span className="material-symbols-outlined text-xl">content_paste</span>
              </button>
            </div>
            <button type="submit" disabled={isLoading}
              className="app-primary-button h-12 sm:px-8">
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  กำลังค้นหา...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">search</span>
                  ดูสถานะ
                </>
              )}
            </button>
          </form>

          {recentSearches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <span className="material-symbols-outlined text-sm">history</span>ประวัติค้นหา:
              </span>
              {recentSearches.map(id => (
                <div key={id} className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 ring-1 ring-gray-100">
                  <button onClick={() => { setTrackingId(id); handleSearch(undefined, id); }}
                    className="rounded-md px-3 py-1.5 font-mono text-xs font-semibold text-foreground transition-all hover:bg-white active:scale-95">
                    {id}
                  </button>
                  <button
                    onClick={() => removeFromRecent(id)}
                    className="rounded-md px-1.5 py-1.5 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                    title="ลบออกจากประวัติ"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {createdHistory.length > 0 && !embedded && (
        <section className="app-card overflow-hidden">
          <div className="app-panel-header">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <span className="material-symbols-outlined text-base">history</span>
                </div>
                <div className="min-w-0">
                  <h2 className="app-section-title">ประวัติที่ฉันสร้างในเครื่องนี้</h2>
                  <p className="truncate text-xs text-muted-foreground">เก็บไว้ในเครื่องนี้เท่านั้น กดรายการเพื่อดูสถานะล่าสุด</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-xs ring-1 ring-gray-100">{createdHistory.length}</span>
                <button
                  type="button"
                  onClick={() => {
                    clearCreatedParcelHistory();
                    toast.success('ล้างประวัติในเครื่องนี้แล้ว');
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white hover:text-destructive"
                >
                  ล้าง
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {createdHistory.slice(0, 9).map(item => (
              <div
                key={item.trackingID}
                className="group rounded-xl border border-gray-100 bg-gray-50 p-3 transition-all hover:border-primary/35 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setTrackingId(item.trackingID); handleSearch(undefined, item.trackingID); }}
                    className="min-w-0 text-left"
                  >
                    <code className="block min-w-0 break-all rounded-md bg-white px-2.5 py-1 font-mono text-xs font-semibold text-foreground shadow-xs ring-1 ring-gray-100">{item.trackingID}</code>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.status && <StatusBadge status={item.status} />}
                    <button
                      type="button"
                      onClick={() => {
                        removeCreatedParcelHistoryItem(item.trackingID);
                        toast.success('ลบออกจากประวัติในเครื่องนี้แล้ว');
                      }}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-100 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="ลบประวัติรายการนี้"
                      title="ลบออกจากประวัติ"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setTrackingId(item.trackingID); handleSearch(undefined, item.trackingID); }}
                  className="mt-3 block w-full text-left"
                >
                  <div className="grid gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.14)]" />
                      <span className="min-w-0 truncate text-xs font-semibold text-slate-600">{item.senderBranch || item.senderName}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(248,113,113,0.14)]" />
                      <span className="min-w-0 truncate text-sm font-black text-slate-800">{item.receiverBranch || item.receiverName}</span>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {formatThaiDateTime(item.createdAt)}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search results */}
      {searchResults.length > 0 && !parcel && (
        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-400">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">list_alt</span>
              <h3 className="text-sm font-bold text-primary">รายการที่พบ</h3>
              <span className="px-2 py-0.5 bg-primary/8 text-primary text-[11px] font-bold rounded-full">{searchResults.length}</span>
            </div>
            <button onClick={() => { setSearchResults([]); setVisibleSearchResultCount(TRACK_RESULTS_BATCH_SIZE); }}
              className="text-xs text-on-surface-variant/60 hover:text-error font-semibold flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>ล้างรายการ
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleSearchResults.map(p => (
              <div key={p.TrackingID}
                onClick={() => { updateCreatedParcelHistoryFromParcel(p); setParcel(p); setSearchResults([]); addToRecent(p.TrackingID); }}
                className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <code className="min-w-0 break-all rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground">{p.TrackingID}</code>
                  <StatusBadge status={p['สถานะ']} />
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate font-medium text-foreground">{p['ผู้ส่ง']}</span>
                  <span className="material-symbols-outlined shrink-0 text-sm text-muted-foreground">arrow_forward</span>
                  <span className="truncate font-medium text-foreground">{p['ผู้รับ']}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="material-symbols-outlined text-sm">event</span>
                  {formatThaiDateTime(p['วันที่สร้าง'])}
                </div>
              </div>
            ))}
          </div>
          {searchResults.length > visibleSearchResultCount && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleSearchResultCount(current => current + TRACK_RESULTS_BATCH_SIZE)}
                className="app-secondary-button h-10 px-4 text-xs"
              >
                แสดงเพิ่ม {Math.min(TRACK_RESULTS_BATCH_SIZE, searchResults.length - visibleSearchResultCount)} รายการ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Parcel detail popup */}
      <Dialog open={!!parcel} onOpenChange={(open) => { if (!open) { setParcel(null); setIsMapOpen(false); } }}>
        {parcel && (
          <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-xl max-h-[92vh] overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white p-0 shadow-xl">
            <div className="flex max-h-[92vh] flex-col">
              <div className="relative bg-slate-950 px-6 py-6 text-white">
                <button
                  type="button"
                  onClick={() => setParcel(null)}
                  className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="ปิดผลการติดตามสถานะ"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
                <div className="pr-12">
                  <div className="min-w-0">
                    <DialogTitle className="font-display text-2xl font-black leading-tight text-white">
                      ลำดับการจัดส่ง
                    </DialogTitle>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 break-all font-mono text-sm font-black tracking-wide text-blue-200">{parcel.TrackingID}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(parcel.TrackingID); toast.success(`คัดลอก ${parcel.TrackingID}`); }}
                        className="grid size-7 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="คัดลอกหมายเลขติดตาม"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-scroll flex-1 overflow-y-auto bg-white p-5 sm:p-6">
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <span className="material-symbols-outlined text-2xl">route</span>
                      </div>
                      <div>
                        <p className="font-display text-base font-black text-slate-900">สถานะล่าสุด</p>
                        <p className="text-xs font-semibold text-slate-400">เรียงจากล่าสุด</p>
                      </div>
                    </div>
                    {hasLocationData && (
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-2xl">map</span>
                        แผนที่
                      </button>
                    )}
                  </div>

                  <Timeline events={timelineEvents} compact />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-400">รับจาก</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-900">{parcel['สาขาผู้ส่ง'] || '-'}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{parcel['ผู้ส่ง'] || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-red-50/70 p-3">
                    <p className="text-[10px] font-black text-red-500">ปลายทาง</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-900">{parcel['สาขาผู้รับ'] || '-'}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{parcel['ผู้รับ'] || '-'}</p>
                  </div>
                </div>

                {(parcel['รายละเอียด'] || parcel['หมายเหตุ']?.replace(/\[.*?\]/g, '').trim()) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] font-black text-slate-400">สิ่งที่ส่ง</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-800">{parcel['รายละเอียด'] || '-'}</p>
                      </div>
                      </div>
                    <div className="rounded-2xl bg-orange-50/70 p-3">
                      <p className="text-[10px] font-black text-orange-600">หมายเหตุ</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{parcel['หมายเหตุ']?.replace(/\[.*?\]/g, '').trim() || '-'}</p>
                    </div>
                  </div>
                )}

            </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={isMapOpen && !!parcel} onOpenChange={setIsMapOpen}>
        {parcel && (
          <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-5xl max-h-[92vh] overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white p-0 shadow-xl">
            <div className="flex max-h-[92vh] flex-col">
              <div className="relative bg-slate-950 px-5 py-5 text-white">
                <button
                  type="button"
                  onClick={() => setIsMapOpen(false)}
                  className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="ปิดแผนที่"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
                <DialogTitle className="pr-12 font-display text-xl font-black leading-tight text-white">
                  แผนที่การจัดส่ง
                </DialogTitle>
                <p className="mt-1 break-all font-mono text-sm font-black tracking-wide text-blue-200">{parcel.TrackingID}</p>
              </div>
              <div className="bg-white p-4">
                <TrackingMap events={timelineEvents} mapClassName="h-[68vh] max-h-[640px] min-h-[360px]" />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Empty state */}
      {!parcel && !searchResults.length && notFoundQuery && !isLoading && (
        <div className="app-card border-dashed p-8 text-center animate-in fade-in zoom-in-95 duration-400 sm:p-10">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-muted">
            <span className="material-symbols-outlined text-3xl text-muted-foreground">search_off</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">ไม่พบรายการส่ง</h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">ไม่พบรายการที่ค้นหา กรุณาตรวจสอบหมายเลขติดตามอีกครั้ง</p>
          <button onClick={() => { setTrackingId(''); setNotFoundQuery(null); }} className="mt-4 text-sm font-semibold text-primary hover:underline">
            ล้างและค้นหาใหม่
          </button>
        </div>
      )}
    </div>
  );
}
