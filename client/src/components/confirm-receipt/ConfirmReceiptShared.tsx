import type { Parcel } from '@/types/parcel';

/** Body padding for confirm steps inside dashboard modal (mobile-first). */
export const embeddedStepBodyClass = 'space-y-3 p-4 sm:space-y-4 sm:p-5';

/** Primary/secondary nav buttons with 48px min touch target. */
export const confirmNavButtonClass =
  'flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-3 font-display text-sm font-black active:scale-[0.98] sm:min-h-[3.25rem] sm:text-base';

/** Rendered outside the main component so it never remounts on state changes. */
export function StepIndicator({
  currentStep,
  compact = false,
  onDark = false,
}: {
  currentStep: number;
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'my-2' : 'mb-8 sm:mb-10'}`}>
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`flex items-center justify-center transition-all duration-500 font-display font-bold ${
            compact 
              ? `w-8 h-8 rounded-lg text-xs ${
                  currentStep === step 
                    ? (onDark ? 'bg-white text-slate-900 shadow-md' : 'bg-slate-900 text-white shadow-md')
                    : currentStep > step 
                      ? 'bg-green-500 text-white' 
                      : (onDark ? 'bg-white/15 text-slate-300' : 'bg-slate-100 text-slate-400')
                }`
              : `w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl text-base sm:text-lg ${
                  currentStep === step
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-110'
                    : currentStep > step
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`
          }`}>
            {currentStep > step
              ? <span className="material-symbols-outlined text-sm sm:text-base" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">check_circle</span>
              : step}
          </div>
          {step < 3 && (
            <div className={`rounded-full overflow-hidden ${compact ? `w-6 h-0.5 mx-1 ${onDark ? 'bg-white/20' : 'bg-slate-100'}` : 'w-8 sm:w-12 h-1 mx-1 sm:mx-2 bg-surface-container'}`}>
              <div className={`h-full bg-green-500 transition-all duration-500 ${currentStep > step ? 'w-full' : 'w-0'}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ParcelJobSummary({ parcel, compact = false }: { parcel: Parcel; compact?: boolean }) {
  return (
    <div className={`border border-gray-200 bg-slate-50 text-left ${compact ? 'rounded-xl p-2.5' : 'rounded-2xl p-3'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400">งานส่งนี้</p>
          <p className="truncate font-display text-base font-black leading-tight text-slate-950">ผู้รับ: {parcel['ผู้รับ'] || '-'}</p>
        </div>
        <code className="shrink-0 rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-black text-slate-800 shadow-sm ring-1 ring-gray-200">
          {parcel.TrackingID}
        </code>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div className="min-w-0 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-black text-slate-400">
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">inventory_2</span>
            ต้นทาง
          </div>
          <p className="truncate text-sm font-black leading-tight text-slate-950">{parcel['สาขาผู้ส่ง'] || '-'}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{parcel['ผู้ส่ง'] || '-'}</p>
        </div>
        <div className="grid w-8 place-items-center text-slate-900">
          <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_forward</span>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-black text-slate-400">
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">flag</span>
            ปลายทาง
          </div>
          <p className="truncate text-sm font-black leading-tight text-slate-950">{parcel['สาขาผู้รับ'] || '-'}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">ผู้รับ: {parcel['ผู้รับ'] || '-'}</p>
        </div>
      </div>
    </div>
  );
}
