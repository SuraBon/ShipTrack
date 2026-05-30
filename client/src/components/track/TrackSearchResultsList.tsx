import StatusBadge from '@/components/StatusBadge';
import { formatThaiDateTime } from '@/lib/dateUtils';
import type { Parcel } from '@/types/parcel';

interface TrackSearchResultsListProps {
  searchResults: Parcel[];
  visibleSearchResults: Parcel[];
  visibleSearchResultCount: number;
  setVisibleSearchResultCount: (val: number | ((prev: number) => number)) => void;
  setParcel: (parcel: Parcel | null) => void;
  setSearchResults: (results: Parcel[]) => void;
  addToRecent: (id: string) => void;
  updateCreatedParcelHistoryFromParcel: (parcel: Parcel) => void;
  batchSize: number;
}

export function TrackSearchResultsList({
  searchResults,
  visibleSearchResults,
  visibleSearchResultCount,
  setVisibleSearchResultCount,
  setParcel,
  setSearchResults,
  addToRecent,
  updateCreatedParcelHistoryFromParcel,
  batchSize,
}: TrackSearchResultsListProps) {
  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">list_alt</span>
          <h3 className="text-sm font-bold text-primary">รายการที่พบ</h3>
          <span className="px-2 py-0.5 bg-primary/8 text-primary text-[11px] font-bold rounded-full">
            {searchResults.length}
          </span>
        </div>
        <button
          onClick={() => {
            setSearchResults([]);
            setVisibleSearchResultCount(batchSize);
          }}
          className="text-xs text-on-surface-variant/60 hover:text-error font-semibold flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>ล้างรายการ
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleSearchResults.map(p => (
          <button
            key={p.TrackingID}
            type="button"
            onClick={() => {
              updateCreatedParcelHistoryFromParcel(p);
              setParcel(p);
              setSearchResults([]);
              addToRecent(p.TrackingID);
            }}
            className="text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:bg-gray-50"
            aria-label={`ดูสถานะพัสดุ ${p.TrackingID} จาก ${p['ผู้ส่ง']} ถึง ${p['ผู้รับ']}`}
          >
            <div className="flex justify-between items-start mb-3">
              <code className="min-w-0 break-all rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                {p.TrackingID}
              </code>
              <StatusBadge status={p['สถานะ']} />
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="truncate font-medium text-foreground">{p['ผู้ส่ง']}</span>
              <span className="material-symbols-outlined shrink-0 text-sm text-muted-foreground" aria-hidden="true">
                arrow_forward
              </span>
              <span className="truncate font-medium text-foreground">{p['ผู้รับ']}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">event</span>
              {formatThaiDateTime(p['วันที่สร้าง'])}
            </div>
          </button>
        ))}
      </div>
      {searchResults.length > visibleSearchResultCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleSearchResultCount(current => current + batchSize)}
            className="app-secondary-button h-10 px-4 text-xs"
          >
            แสดงเพิ่ม {Math.min(batchSize, searchResults.length - visibleSearchResultCount)} รายการ
          </button>
        </div>
      )}
    </div>
  );
}
