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
      <section className={`${embedded ? 'hidden' : 'rounded-2xl border border-outline-variant/25 bg-white/90 px-5 py-5 shadow-sm backdrop-blur-xl sm:px-6'}`}>
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_searching</span>
          </div>
          <div>
            <h1 className="font-display text-3xl font-black leading-tight text-primary sm:text-[34px]">{UI_COPY.nav.track}</h1>
            <p className="mt-1 text-sm text-on-surface-variant/75">ค้นหาด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง</p>
          </div>
        </div>
      </section>

      {/* Search box */}
      <div className="rounded-2xl border border-outline-variant/25 bg-white/95 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant/45 transition-colors group-focus-within:text-primary">search</span>
            <input
              placeholder="กรอกหมายเลขติดตาม ผู้รับ หรือปลายทาง..."
              value={trackingId}
              onChange={e => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
              autoFocus
              className="h-13 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest pl-11 pr-12 text-base font-semibold text-primary outline-none transition-all placeholder:font-medium placeholder:text-outline-variant/55 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/8 sm:h-14"
            />
            <button type="button" onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-on-surface-variant/45 transition-all hover:bg-surface-container hover:text-primary"
              title="วางจากคลิปบอร์ด">
              <span className="material-symbols-outlined text-xl">content_paste</span>
            </button>
          </div>
          <button type="submit" disabled={isLoading}
            className="h-13 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50 sm:h-14 sm:px-8">
            {isLoading
              ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              : 'ดูสถานะ'}
          </button>
        </form>

        {recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-outline-variant/10">
            <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">history</span>ประวัติค้นหา:
            </span>
            {recentSearches.map(id => (
              <div key={id} className="flex items-center gap-0.5 rounded-xl bg-primary/5 p-0.5 ring-1 ring-primary/10">
                <button onClick={() => { setTrackingId(id); handleSearch(undefined, id); }}
                  className="px-3 py-1.5 text-xs font-mono font-bold text-primary rounded-lg transition-all active:scale-95 hover:bg-white">
                  {id}
                </button>
                <button
                  onClick={() => removeFromRecent(id)}
                  className="px-1.5 py-1.5 hover:bg-error/10 hover:text-error text-on-surface-variant/40 rounded-lg transition-all"
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
        <section className="rounded-2xl border border-outline-variant/25 bg-white/95 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-black text-primary">พัสดุที่สร้างจากเครื่องนี้</h2>
              <p className="text-xs font-semibold text-on-surface-variant/60">บันทึกไว้เฉพาะ browser นี้ กดเพื่อดึงสถานะล่าสุดจากชีท</p>
            </div>
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-black text-primary">{createdHistory.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {createdHistory.slice(0, 6).map(item => (
              <button
                key={item.trackingID}
                type="button"
                onClick={() => { setTrackingId(item.trackingID); handleSearch(undefined, item.trackingID); }}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left transition-all hover:border-primary/35 hover:bg-primary/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="min-w-0 break-all rounded-lg bg-primary/6 px-2.5 py-1 font-mono text-xs font-black text-primary">{item.trackingID}</code>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <span className="truncate font-bold text-primary">{item.senderName}</span>
                  <span className="material-symbols-outlined shrink-0 text-sm text-outline-variant">arrow_forward</span>
                  <span className="truncate font-bold text-primary">{item.receiverName}</span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant/55">{formatThaiDateTime(item.createdAt)}</p>
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
                className="bg-white/95 border border-outline-variant/40 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <code className="min-w-0 break-all text-xs font-mono font-black text-primary bg-primary/6 px-2.5 py-1 rounded-lg">{p.TrackingID}</code>
                  <StatusBadge status={p['สถานะ']} />
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-primary truncate">{p['ผู้ส่ง']}</span>
                  <span className="material-symbols-outlined text-outline-variant text-sm shrink-0">arrow_forward</span>
                  <span className="font-bold text-primary truncate">{p['ผู้รับ']}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-on-surface-variant/50">
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

          <div className="bg-white/95 backdrop-blur-sm border border-outline-variant/40 rounded-2xl overflow-hidden shadow-xl shadow-primary/10">
            {/* Card header */}
            <div className="p-5 sm:p-7 text-white"
              style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #091426 100%)' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="min-w-0 break-all text-xl sm:text-2xl font-black tracking-wider font-mono leading-tight">{parcel.TrackingID}</h2>
                    <button
                      onClick={() => { navigator.clipboard.writeText(parcel.TrackingID); toast.success(`คัดลอก ${parcel.TrackingID}`); }}
                      className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60 text-sm">
                    <span className="material-symbols-outlined text-sm">category</span>
                    {parcel['ประเภทเอกสาร']}
                  </div>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
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
                  <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 space-y-4">
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">จากไหน ไปให้ใคร</p>
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
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-outline-variant/10">
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
                    <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 space-y-3">
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
                  <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant/30">
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">route</span>{UI_COPY.parcel.routeHistory}
                    </p>
                    <Timeline events={timelineEvents} />
                  </div>
                  {hasLocationData ? (
                    <div className="rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm">
                      <TrackingMap events={timelineEvents} />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-outline-variant/30 shadow-sm h-[260px] bg-surface-container-lowest flex flex-col items-center justify-center p-6 text-center">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">map_off</span>
                      <p className="text-sm font-bold text-on-surface-variant">ยังไม่มีพิกัด GPS</p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">แผนที่จะแสดงเมื่อมีพิกัดจากการสร้างรายการหรือการส่งสำเร็จ</p>
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
        <div className="bg-white/80 border border-outline-variant/30 border-dashed rounded-3xl p-12 text-center animate-in fade-in zoom-in-95 duration-400">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">search_off</span>
          </div>
          <h3 className="font-display text-lg font-bold text-primary">ไม่พบข้อมูลพัสดุ</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto">ไม่พบรายการที่ค้นหา กรุณาตรวจสอบหมายเลขติดตามอีกครั้ง</p>
          <button onClick={() => setTrackingId('')} className="mt-4 text-sm text-primary font-bold hover:underline">
            ล้างและค้นหาใหม่
          </button>
        </div>
      )}
    </div>
  );
}
