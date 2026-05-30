import { Spinner } from '@/components/ui/spinner';
import { sanitizeTextInput } from '@/lib/validation';

interface TrackSearchFormProps {
  trackingId: string;
  setTrackingId: (val: string) => void;
  handleSearch: (e?: React.FormEvent, searchId?: string) => Promise<void>;
  handlePaste: () => void;
  isLoading: boolean;
  recentSearches: string[];
  removeFromRecent: (id: string) => void;
}

export function TrackSearchForm({
  trackingId,
  setTrackingId,
  handleSearch,
  handlePaste,
  isLoading,
  recentSearches,
  removeFromRecent,
}: TrackSearchFormProps) {
  return (
    <div className="app-card overflow-hidden">
      <div className="app-panel-header">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <span className="material-symbols-outlined text-base" aria-hidden="true">travel_explore</span>
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
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden="true">search</span>
            <input
              type="search"
              aria-label="ค้นหารายการส่งด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง"
              aria-describedby="track-search-help"
              placeholder="กรอกหมายเลขติดตาม ผู้รับ หรือปลายทาง..."
              value={trackingId}
              onChange={e => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
              autoFocus
              autoComplete="off"
              className="app-input h-12 w-full pl-11 pr-12 text-base font-semibold"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              title="วางจากคลิปบอร์ด"
              aria-label="วางจากคลิปบอร์ด"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">content_paste</span>
            </button>
          </div>
          <button type="submit" disabled={isLoading} className="app-primary-button h-12 sm:px-8">
            {isLoading ? (
              <>
                <Spinner className="h-5 w-5" />
                กำลังค้นหา...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl" aria-hidden="true">search</span>
                ดูสถานะ
              </>
            )}
          </button>
        </form>

        <p id="track-search-help" className="mt-2 text-xs font-semibold text-slate-500/80 leading-normal flex items-center gap-1.5 px-0.5 animate-in fade-in duration-300">
          <span className="material-symbols-outlined text-sm text-slate-400" aria-hidden="true">info</span>
          <span>คำแนะนำ: สามารถพิมพ์ค้นหาด้วยหมายเลขพัสดุ (เช่น TRK...), ชื่อผู้รับ หรือชื่อสาขาปลายทางได้</span>
        </p>

        {recentSearches.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">history</span>ประวัติค้นหา:
            </span>
            {recentSearches.map(id => (
              <div key={id} className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 ring-1 ring-gray-100">
                <button
                  type="button"
                  onClick={() => { setTrackingId(id); void handleSearch(undefined, id); }}
                  className="rounded-md px-3 py-1.5 font-mono text-xs font-semibold text-foreground transition-all hover:bg-white active:scale-95"
                >
                  {id}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromRecent(id)}
                  className="rounded-md px-1.5 py-1.5 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                  title="ลบออกจากประวัติ"
                  aria-label={`ลบ ${id} ออกจากประวัติ`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
