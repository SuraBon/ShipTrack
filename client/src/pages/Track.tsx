/**
 * Track Page
 */

import { useState, useEffect, useMemo } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import ImagePopup from '@/components/ImagePopup';
import { toast } from 'sonner';
import type { Parcel } from '@/types/parcel';
import { getParcel, searchParcels } from '@/lib/parcelService';
import { parseParcelTimeline } from '@/lib/timeline';
import TrackingMap from '@/components/TrackingMap';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { UI_COPY } from '@/lib/uiCopy';
import {
  getCreatedParcelHistory,
  updateCreatedParcelHistoryFromParcel,
  type CreatedParcelHistoryItem,
} from '@/lib/createdParcelHistory';

export default function Track({ embedded = false }: { embedded?: boolean }) {
  const [trackingId, setTrackingId] = useState('');
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [searchResults, setSearchResults] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [createdHistory, setCreatedHistory] = useState<CreatedParcelHistoryItem[]>([]);

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
    setIsLoading(true);
    try {
      const res = await getParcel(id);
      if (res.success && res.parcel) {
        updateCreatedParcelHistoryFromParcel(res.parcel);
        setParcel(res.parcel); setSearchResults([]); addToRecent(res.parcel.TrackingID);
        toast.success('พบข้อมูลพัสดุ');
      } else {
        const directTrackingLookup = isValidTrackingId(id);
        const lookupMiss = (res.error ?? '').includes('ไม่พบ') || (res.error ?? '').includes('รูปแบบ');
        if (directTrackingLookup && res.error && !lookupMiss) {
          setParcel(null);
          setSearchResults([]);
          toast.error(res.error);
          return;
        }
        const results = await searchParcels(id);
        if (results?.length) {
          if (results.length === 1) {
            updateCreatedParcelHistoryFromParcel(results[0]);
            setParcel(results[0]); setSearchResults([]); addToRecent(results[0].TrackingID);
          }
          else { setSearchResults(results); setParcel(null); }
          toast.success(`พบข้อมูล ${results.length} รายการ`);
        } else {
          setParcel(null); setSearchResults([]); toast.error(res.error && directTrackingLookup ? res.error : 'ไม่พบข้อมูลพัสดุ');
        }
      }
    } catch { toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ'); }
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

  /** True when we have GPS location data to display on the map. */
  const hasLocationData = useMemo(() => {
    if (!parcel) return false;
    // เช็คเฉพาะ GPS จริงจาก events
    return timelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    );
  }, [parcel, timelineEvents]);

  return (
    <div className={`${embedded ? 'max-w-none pb-4' : 'max-w-6xl mx-auto pb-20'} space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500`}>

      {/* Header */}
      <section className={`${embedded ? 'hidden' : 'app-card px-4 py-4 sm:px-5'}`}>
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_searching</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{UI_COPY.nav.track}</h1>
            <p className="app-muted mt-1">ค้นหาด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง</p>
          </div>
        </div>
      </section>

      {/* Search box */}
      <div className="app-card p-3 sm:p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground transition-colors group-focus-within:text-primary">search</span>
            <input
              placeholder="กรอกหมายเลขติดตาม ผู้รับ หรือปลายทาง..."
              value={trackingId}
              onChange={e => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
              autoFocus
              className="app-input h-12 w-full pl-11 pr-12 text-base font-semibold sm:h-12"
            />
            <button type="button" onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              title="วางจากคลิปบอร์ด">
              <span className="material-symbols-outlined text-xl">content_paste</span>
            </button>
          </div>
          <button type="submit" disabled={isLoading}
            className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:px-8">
            {isLoading
              ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              : 'ดูสถานะ'}
          </button>
        </form>

        {recentSearches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="material-symbols-outlined text-sm">history</span>ประวัติค้นหา:
            </span>
            {recentSearches.map(id => (
              <div key={id} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 ring-1 ring-border">
                <button onClick={() => { setTrackingId(id); handleSearch(undefined, id); }}
                  className="rounded-md px-3 py-1.5 font-mono text-xs font-semibold text-foreground transition-all active:scale-95 hover:bg-background">
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

      {createdHistory.length > 0 && !embedded && (
        <section className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">พัสดุที่สร้างจากเครื่องนี้</h2>
              <p className="text-xs text-muted-foreground">บันทึกในเครื่องนี้ กดเพื่อดึงสถานะล่าสุดจากระบบ</p>
            </div>
            <span className="rounded-md bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">{createdHistory.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {createdHistory.slice(0, 6).map(item => (
              <button
                key={item.trackingID}
                type="button"
                onClick={() => { setTrackingId(item.trackingID); handleSearch(undefined, item.trackingID); }}
                className="rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-primary/35 hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="min-w-0 break-all rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground">{item.trackingID}</code>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <span className="truncate font-medium text-foreground">{item.senderName}</span>
                  <span className="material-symbols-outlined shrink-0 text-sm text-muted-foreground">arrow_forward</span>
                  <span className="truncate font-medium text-foreground">{item.receiverName}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatThaiDateTime(item.createdAt)}</p>
              </button>
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
            <button onClick={() => setSearchResults([])}
              className="text-xs text-on-surface-variant/60 hover:text-error font-semibold flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>ล้างรายการ
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {searchResults.map(p => (
              <div key={p.TrackingID}
                onClick={() => { updateCreatedParcelHistoryFromParcel(p); setParcel(p); setSearchResults([]); addToRecent(p.TrackingID); }}
                className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:bg-muted/40">
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
        </div>
      )}

      {/* Parcel detail */}
      {parcel && (
        <div className="space-y-5 animate-in zoom-in-95 duration-400">
          <button onClick={() => setParcel(null)}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary font-semibold transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>ค้นหาใหม่
          </button>

          <div className="app-card overflow-hidden">
            {/* Card header */}
            <div className="border-b border-border bg-muted/45 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="min-w-0 break-all font-mono text-xl font-semibold leading-tight text-foreground sm:text-2xl">{parcel.TrackingID}</h2>
                    <button
                      onClick={() => { navigator.clipboard.writeText(parcel.TrackingID); toast.success(`คัดลอก ${parcel.TrackingID}`); }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground">
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="material-symbols-outlined text-sm">category</span>
                    {parcel['ประเภทเอกสาร']}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <StatusBadge status={parcel['สถานะ']} />
                </div>
              </div>
            </div>

            {/* Card body */}
            <div className="p-4 sm:p-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {/* Info column */}
                <div className="space-y-5">
                  {/* Sender / Receiver */}
                  <div className="space-y-4 rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted-foreground">จากไหน ไปให้ใคร</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'ผู้ส่ง', name: parcel['ผู้ส่ง'], branch: parcel['สาขาผู้ส่ง'], icon: 'person', color: 'text-primary' },
                        { label: 'ปลายทาง', name: parcel['ผู้รับ'], branch: parcel['สาขาผู้รับ'], icon: 'flag', color: 'text-secondary' },
                      ].map(({ label, name, branch, icon, color }) => (
                        <div key={label} className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0 mt-0.5">
                            <span className={`material-symbols-outlined text-base ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">{label}</p>
                            <p className="font-bold text-primary text-sm leading-tight mt-0.5">{name}</p>
                            <p className="text-[11px] text-on-surface-variant/50 mt-0.5">{branch}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">ประเภท</p>
                        <p className="font-bold text-primary text-sm mt-0.5">{parcel['ประเภทเอกสาร']}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">สถานะ</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                          <p className="font-bold text-primary text-sm">{parcel['สถานะ']}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {(parcel['รายละเอียด'] || (parcel['หมายเหตุ'] && parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim())) && (
                    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                      {parcel['รายละเอียด'] && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">description</span>รายละเอียด
                          </p>
                          <p className="text-sm text-primary font-medium leading-relaxed">{parcel['รายละเอียด']}</p>
                        </div>
                      )}
                      {parcel['หมายเหตุ'] && parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim() && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">notes</span>หมายเหตุปลายทาง
                          </p>
                          <p className="text-sm text-on-surface-variant italic">"{parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim()}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proof image */}
                  {parcel['รูปยืนยัน'] && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">photo_library</span>{UI_COPY.parcel.proofPhoto}
                      </p>
                      <ImagePopup url={parcel['รูปยืนยัน']} className="w-full rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all" />
                    </div>
                  )}
                </div>

                {/* Timeline + Map column */}
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
                    <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <span className="material-symbols-outlined text-sm">route</span>{UI_COPY.parcel.routeHistory}
                    </p>
                    <Timeline events={timelineEvents} />
                  </div>
                  {hasLocationData ? (
                    <div className="overflow-hidden rounded-lg border border-border shadow-sm">
                      <TrackingMap events={timelineEvents} />
                    </div>
                  ) : (
                    <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center shadow-sm">
                      <span className="material-symbols-outlined mb-3 text-4xl text-muted-foreground">map_off</span>
                      <p className="text-sm font-semibold text-foreground">ยังไม่มีพิกัด GPS</p>
                      <p className="mt-1 text-xs text-muted-foreground">แผนที่จะแสดงเมื่อมีพิกัดจากการสร้างรายการหรือการส่งสำเร็จ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!parcel && !searchResults.length && trackingId && !isLoading && (
        <div className="app-card border-dashed p-8 text-center animate-in fade-in zoom-in-95 duration-400 sm:p-10">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-muted">
            <span className="material-symbols-outlined text-3xl text-muted-foreground">search_off</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">ไม่พบข้อมูลพัสดุ</h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">ไม่พบรายการที่ค้นหา กรุณาตรวจสอบหมายเลขติดตามอีกครั้ง</p>
          <button onClick={() => setTrackingId('')} className="mt-4 text-sm font-semibold text-primary hover:underline">
            ล้างและค้นหาใหม่
          </button>
        </div>
      )}
    </div>
  );
}
