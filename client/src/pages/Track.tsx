/**
 * Track Page
 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import { toast } from 'sonner';
import type { Parcel } from '@/types/parcel';
import { getParcel, searchParcels } from '@/lib/parcelService';
import { parseParcelTimeline } from '@/lib/timeline';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { UI_COPY } from '@/lib/uiCopy';
import { translateSystemNote } from '@/lib/translationUtils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRealtimeParcel } from '@/hooks/useRealtimeParcel';
import {
  getCreatedParcelProofPhoto,
  getCreatedParcelHistoryFromDb,
  updateCreatedParcelHistoryFromParcel,
  type CreatedParcelHistoryItem,
} from '@/lib/createdParcelHistory';

// Split components
import { TrackSearchForm } from '@/components/track/TrackSearchForm';
import { TrackSearchResultsList } from '@/components/track/TrackSearchResultsList';
import { TrackCreatedHistory } from '@/components/track/TrackCreatedHistory';

const TRACK_RESULTS_BATCH_SIZE = 12;
const TrackingMap = lazy(() => import('@/components/TrackingMap'));

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
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const lastSearchedIdRef = useRef('');

  const syncHistoryFromDb = () => {
    void getCreatedParcelHistoryFromDb().then(setCreatedHistory);
  };

  const handleRefreshHistory = async () => {
    if (isRefreshingHistory) return;
    setIsRefreshingHistory(true);
    const history = await getCreatedParcelHistoryFromDb();
    if (history.length === 0) {
      setIsRefreshingHistory(false);
      return;
    }
    const refreshPromise = (async () => {
      let updatedCount = 0;
      for (const item of history) {
        try {
          const res = await getParcel(item.trackingID);
          if (res.success && res.parcel) {
            updateCreatedParcelHistoryFromParcel(res.parcel);
            updatedCount++;
          }
        } catch {
          // ignore
        }
      }
      syncHistoryFromDb();
      return updatedCount;
    })();

    toast.promise(
      refreshPromise,
      {
        loading: 'กำลังอัปเดตสถานะการจัดส่งล่าสุด...',
        success: (count) => `อัปเดตสถานะการจัดส่งสำเร็จจำนวน ${count} รายการ`,
        error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะการจัดส่ง',
      }
    );

    refreshPromise.then(
      () => setIsRefreshingHistory(false),
      () => setIsRefreshingHistory(false),
    );
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((x): x is string => typeof x === 'string').slice(0, 5));
        }
      }
    } catch {
      localStorage.removeItem('recent_searches');
    }
  }, []);

  useEffect(() => {
    syncHistoryFromDb();
    window.addEventListener('doc-track-created-parcels-updated', syncHistoryFromDb);
    return () => window.removeEventListener('doc-track-created-parcels-updated', syncHistoryFromDb);
  }, []);

  // Silent update on mount to keep local history statuses fresh
  useEffect(() => {
    const silentRefreshHistory = async () => {
      const history = await getCreatedParcelHistoryFromDb();
      if (history.length === 0) return;
      for (const item of history) {
        try {
          const res = await getParcel(item.trackingID);
          if (res.success && res.parcel) {
            updateCreatedParcelHistoryFromParcel(res.parcel);
          }
        } catch {
          // ignore
        }
      }
      syncHistoryFromDb();
    };
    void silentRefreshHistory();
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
    if (!id) {
      toast.error('กรุณาระบุหมายเลขติดตาม ชื่อผู้รับ หรือแผนก/สาขาปลายทาง');
      return;
    }
    lastSearchedIdRef.current = id;
    if (searchId && searchId !== trackingId) setTrackingId(searchId);
    setNotFoundQuery(null);
    setVisibleSearchResultCount(TRACK_RESULTS_BATCH_SIZE);
    setIsLoading(true);
    try {
      const res = await getParcel(id);
      if (res.success && res.parcel) {
        const hydratedParcel = hydrateLocalProofPhoto(res.parcel);
        updateCreatedParcelHistoryFromParcel(hydratedParcel);
        setParcel(hydratedParcel);
        setSearchResults([]);
        addToRecent(hydratedParcel.TrackingID);
        setNotFoundQuery(null);
        toast.success('พบข้อมูลการจัดส่งพัสดุ');
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
            setParcel(hydratedResults[0]);
            setSearchResults([]);
            addToRecent(hydratedResults[0].TrackingID);
          } else {
            setSearchResults(hydratedResults);
            setParcel(null);
          }
          setNotFoundQuery(null);
          toast.success(`พบข้อมูลการจัดส่งทั้งหมด ${results.length} รายการ`);
        } else {
          setParcel(null);
          setSearchResults([]);
          setNotFoundQuery(id);
          toast.error(res.error && directTrackingLookup ? res.error : 'ไม่พบข้อมูลการจัดส่ง');
        }
      }
    } catch {
      setNotFoundQuery(null);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast.error('ไม่สามารถวางอัตโนมัติได้ในขณะนี้ กรุณากดค้างที่ช่องกรอกแล้วเลือก "วาง" หรือพิมพ์รหัสพัสดุเอง');
      return;
    }
    try {
      const t = await navigator.clipboard.readText();
      const safeText = sanitizeTextInput(t, 100).toUpperCase();
      if (safeText) {
        setTrackingId(safeText);
        toast.success('วางหมายเลขติดตามเรียบร้อยแล้ว');
      }
    } catch {
      toast.error('ไม่สามารถเข้าถึงคลิปบอร์ดได้ กรุณากดแตะค้างที่ช่องกรอกแล้วเลือก "วาง" (Paste) หรือพิมพ์ด้วยตนเอง');
    }
  };

  const handleCopyTrackingId = async (id: string) => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      toast.error('ไม่สามารถคัดลอกหมายเลขติดตามอัตโนมัติได้ โปรดลองคัดลอกด้วยตนเอง');
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
      toast.success(`คัดลอกหมายเลขติดตาม ${id} เรียบร้อยแล้ว`);
    } catch {
      toast.error('ไม่สามารถคัดลอกหมายเลขติดตาม โปรดลองคัดลอกด้วยตนเอง');
    }
  };

  useEffect(() => {
    const handleCustomSearch = (e: Event) => {
      const trackingIdParam = (e as CustomEvent<{ trackingId: string }>).detail?.trackingId;
      if (trackingIdParam) {
        const cleanId = sanitizeTextInput(trackingIdParam, 100).toUpperCase();
        setTrackingId(cleanId);
        void handleSearch(undefined, cleanId);
      }
    };

    window.addEventListener('shiptrack:search-parcel', handleCustomSearch);

    // Check query params on mount
    const params = new URLSearchParams(window.location.search);
    const trackingIdParam = params.get('id');
    if (trackingIdParam) {
      const cleanId = sanitizeTextInput(trackingIdParam, 100).toUpperCase();
      setTrackingId(cleanId);
      void handleSearch(undefined, cleanId);
    }

    return () => {
      window.removeEventListener('shiptrack:search-parcel', handleCustomSearch);
    };
  }, []);

  useEffect(() => {
    const trimmed = trackingId.trim().toUpperCase();
    if (!trimmed) {
      lastSearchedIdRef.current = '';
    }
    if (isValidTrackingId(trimmed) && lastSearchedIdRef.current !== trimmed) {
      const delayDebounceFn = setTimeout(() => {
        void handleSearch(undefined, trimmed);
      }, 400);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [trackingId]);

  const { parcel: realtimeParcel } = useRealtimeParcel(
    parcel?.TrackingID,
    Boolean(parcel && parcel['สถานะ'] === 'กำลังจัดส่ง'),
    parcel,
  );
  useEffect(() => {
    if (!realtimeParcel) return;
    setParcel(current => current?.TrackingID === realtimeParcel.TrackingID ? realtimeParcel : current);
  }, [realtimeParcel]);

  const timelineEvents = useMemo(() => parcel ? parseParcelTimeline(parcel) : [], [parcel]);
  const visibleSearchResults = searchResults.slice(0, visibleSearchResultCount);

  /** True when we have GPS location data to display on the map. */
  const hasLocationData = useMemo(() => {
    if (!parcel) return false;
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

      {/* Search box component */}
      <TrackSearchForm
        trackingId={trackingId}
        setTrackingId={setTrackingId}
        handleSearch={handleSearch}
        handlePaste={handlePaste}
        isLoading={isLoading}
        recentSearches={recentSearches}
        removeFromRecent={removeFromRecent}
      />
      <div aria-live="polite" className="sr-only">
        {isLoading && 'กำลังค้นหา...'}
        {!isLoading && searchResults.length > 0 && `พบผลการค้นหา ${searchResults.length} รายการ`}
        {!isLoading && !searchResults.length && notFoundQuery && `ไม่พบรายการ ${notFoundQuery}`}
      </div>

      {/* Search results component */}
      {searchResults.length > 0 && !parcel && (
        <TrackSearchResultsList
          searchResults={searchResults}
          visibleSearchResults={visibleSearchResults}
          visibleSearchResultCount={visibleSearchResultCount}
          setVisibleSearchResultCount={setVisibleSearchResultCount}
          setParcel={setParcel}
          setSearchResults={setSearchResults}
          addToRecent={addToRecent}
          updateCreatedParcelHistoryFromParcel={updateCreatedParcelHistoryFromParcel}
          batchSize={TRACK_RESULTS_BATCH_SIZE}
        />
      )}

      {/* Local History component */}
      {createdHistory.length > 0 && !embedded && (
        <TrackCreatedHistory
          createdHistory={createdHistory}
          isRefreshingHistory={isRefreshingHistory}
          handleRefreshHistory={handleRefreshHistory}
          setTrackingId={setTrackingId}
          handleSearch={handleSearch}
          onHistoryItemDeleted={syncHistoryFromDb}
        />
      )}

      {/* Parcel detail popup */}
      <Dialog open={!!parcel} onOpenChange={(open) => { if (!open) { setParcel(null); setIsMapOpen(false); } }}>
        {parcel && (
          <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-xl max-h-[92vh] overflow-hidden rounded-[1.75rem] border border-border bg-card p-0 shadow-xl">
            <div className="flex max-h-[92vh] flex-col">
              <div className="relative rounded-t-[1.75rem] border-b border-outline-variant bg-surface-container px-6 py-6 text-foreground">
                <button
                  type="button"
                  onClick={() => setParcel(null)}
                  className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-surface/90 text-foreground transition-colors hover:bg-surface-container"
                  aria-label="ปิดผลการติดตามสถานะ"
                >
                  <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
                </button>
                <div className="pr-12">
                  <div className="min-w-0">
                    <DialogTitle className="font-display text-2xl font-black leading-tight text-white">
                       ประวัติสถานะการจัดส่ง
                    </DialogTitle>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 break-all font-mono text-sm font-black tracking-wide text-primary">{parcel.TrackingID}</p>
                      <button
                        onClick={() => void handleCopyTrackingId(parcel.TrackingID)}
                        className="grid size-7 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                        aria-label="คัดลอกหมายเลขติดตาม"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">content_copy</span>
                      </button>
                      <div className="ml-1 scale-90 origin-left">
                        <StatusBadge status={parcel['สถานะ']} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-scroll flex-1 overflow-y-auto bg-card p-5 sm:p-6">
                <div className="app-card p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300">
                        <span className="material-symbols-outlined text-2xl" aria-hidden="true">route</span>
                      </div>
                      <div>
                        <p className="font-display text-base font-black text-foreground">ประวัติสถานะการจัดส่ง</p>
                        <p className="text-xs font-semibold text-muted-foreground">สถานะล่าสุดอยู่ด้านบน พร้อมเวลาและจุดที่บันทึก</p>
                      </div>
                    </div>
                    {hasLocationData && (
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className="app-secondary-button inline-flex shrink-0 rounded-2xl px-3 py-2 text-sm font-bold"
                      >
                        <span className="material-symbols-outlined text-2xl" aria-hidden="true">map</span>
                        แผนที่
                      </button>
                    )}
                  </div>

                  <Timeline events={timelineEvents} compact />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-outline-variant bg-surface-container p-3">
                    <p className="text-[10px] font-black text-muted-foreground">รับจาก</p>
                    <p className="mt-1 truncate text-sm font-black text-foreground">{parcel['สาขาผู้ส่ง'] || '-'}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{parcel['ผู้ส่ง'] || '-'}</p>
                  </div>
                  <div className="rounded-3xl border border-outline-variant bg-surface-container p-3">
                    <p className="text-[10px] font-black text-destructive">ปลายทาง</p>
                    <p className="mt-1 truncate text-sm font-black text-foreground">{parcel['สาขาผู้รับ'] || '-'}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{parcel['ผู้รับ'] || '-'}</p>
                  </div>
                </div>

                {(parcel['รายละเอียด'] || parcel['หมายเหตุ']) && (
                  <div className={`mt-3 grid gap-3 ${parcel['รายละเอียด'] && parcel['หมายเหตุ'] ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {parcel['รายละเอียด'] && (
                      <div className="rounded-3xl border border-outline-variant bg-surface-container p-3">
                        <p className="text-[10px] font-black text-muted-foreground">สิ่งที่ส่ง</p>
                        <p className="mt-1 text-sm font-semibold text-foreground break-words whitespace-pre-wrap">{parcel['รายละเอียด']}</p>
                      </div>
                    )}
                    {parcel['หมายเหตุ'] && (
                      <div className="rounded-3xl border border-outline-variant bg-surface-container p-3">
                        <p className="text-[10px] font-black text-accent">หมายเหตุ</p>
                        <p className="mt-1 text-sm font-semibold text-foreground break-words whitespace-pre-wrap">{translateSystemNote(parcel['หมายเหตุ'])}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={isMapOpen && !!parcel} onOpenChange={setIsMapOpen}>
        {parcel && (
          <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-5xl max-h-[92vh] overflow-hidden rounded-[1.5rem] border border-border bg-card p-0 shadow-xl">
            <div className="flex max-h-[92vh] flex-col">
              <div className="relative bg-slate-950 px-5 py-5 text-white">
                <button
                  type="button"
                  onClick={() => setIsMapOpen(false)}
                  className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  aria-label="ปิดแผนที่"
                >
                  <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
                </button>
                <DialogTitle className="pr-12 font-display text-xl font-black leading-tight text-white">
                  แผนที่การจัดส่ง
                </DialogTitle>
                <p className="mt-1 break-all font-mono text-sm font-black tracking-wide text-blue-200">{parcel.TrackingID}</p>
              </div>
              <div className="bg-card p-4">
                <Suspense
                  fallback={
                    <div className="grid h-[68vh] max-h-[640px] min-h-[360px] place-items-center rounded-2xl bg-slate-50 dark:bg-surface-container text-sm font-semibold text-slate-500 dark:text-muted-foreground">
                      กำลังโหลดแผนที่...
                    </div>
                  }
                >
                  <TrackingMap events={timelineEvents} trackingID={parcel.TrackingID} mapClassName="h-[68vh] max-h-[640px] min-h-[360px]" />
                </Suspense>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Empty state */}
      {!parcel && !searchResults.length && notFoundQuery && !isLoading && (
        <div className="app-card border-dashed p-8 text-center animate-in fade-in zoom-in-95 duration-400 sm:p-10">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-muted">
            <span className="material-symbols-outlined text-3xl text-muted-foreground" aria-hidden="true">search_off</span>
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
