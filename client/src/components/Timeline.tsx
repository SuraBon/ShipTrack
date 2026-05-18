/**
 * Timeline Component
 * แสดงเส้นเวลาการจัดส่งพัสดุแบบทีละขั้นตอน
 * Design: Premium Minimalist Logistics
 */

import type { TimelineEvent } from '@/types/timeline';
import ImagePopup from '@/components/ImagePopup';
import { formatThaiDateTime, parseDateInput } from '@/lib/dateUtils';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  compact?: boolean;
}

export default function Timeline({ events, className = '', compact = false }: TimelineProps) {
  const isDelivered = events.some((event) => event.title.includes('ส่งสำเร็จ'));
  const currentEvent = events.find(e => e.status === 'current') || events[0];
  const isTransit = currentEvent?.title.includes('จัดส่ง') || currentEvent?.title.includes('เดินทาง') || currentEvent?.title.includes('ส่งต่อ');
  
  const headerStyle = isDelivered 
    ? { icon: 'task_alt', color: 'bg-emerald-600', shadow: 'shadow-emerald-200', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'ส่งสำเร็จ', sub: 'พัสดุถูกจัดส่งถึงสถานที่รับเรียบร้อยแล้ว', badgeText: 'ส่งสำเร็จ' }
    : isTransit
      ? { icon: 'local_shipping', color: 'bg-blue-600', shadow: 'shadow-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200', text: 'กำลังจัดส่ง', sub: 'พัสดุอยู่ระหว่างการจัดส่งไปยังสถานที่รับ', badgeText: 'กำลังจัดส่ง' }
      : { icon: 'inventory_2', color: 'bg-amber-500', shadow: 'shadow-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'รอจัดส่ง', sub: 'พัสดุถูกบันทึกเข้าระบบและรอดำเนินการจัดส่ง', badgeText: 'รอจัดส่ง' };

  const getStatusIcon = (status: TimelineEvent['status'], title: string) => {
    const iconSize = compact ? 'w-7 h-7' : 'w-8 h-8';
    const iconText = compact ? 'text-base' : 'text-lg';
    switch (status) {
      case 'completed':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 ${iconSize}`}>
            <span className={`material-symbols-outlined font-bold ${iconText}`}>check</span>
          </div>
        );
      case 'current':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-secondary text-primary shadow-lg shadow-secondary/30 ${iconSize}`}>
            <div className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-25"></div>
            <span className={`material-symbols-outlined font-bold ${iconText}`}>
              {title.includes('ส่งต่อ') ? 'local_shipping' : 'radio_button_checked'}
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-surface-container border-2 border-outline-variant ${iconSize}`}>
            <span className={`material-symbols-outlined text-outline-variant ${iconText}`}>pending</span>
          </div>
        );
      default:
        return (
          <div className={`${iconSize} rounded-full bg-surface-container border border-outline-variant`}></div>
        );
    }
  };

  const getCardStyle = (status: TimelineEvent['status'], title: string) => {
    switch (status) {
      case 'completed':
        return 'bg-white border-outline-variant/30 hover:border-primary/20 hover:bg-surface-container-low/20';
      case 'current': {
        const isCurrentTransit = title.includes('จัดส่ง') || title.includes('เดินทาง');
        const colorClass = isCurrentTransit ? 'border-blue-500 shadow-blue-500/5 ring-blue-500/10' : 'border-secondary shadow-secondary/5 ring-secondary/10';
        return `bg-white ${colorClass} shadow-xl ring-1`;
      }
      case 'pending':
        return 'bg-surface-container-lowest border-outline-variant/20 opacity-70';
      default:
        return 'bg-white border-outline-variant/30';
    }
  };

  const formatTimelineDateParts = (timestamp: string) => {
    const parsed = parseDateInput(timestamp);
    if (!timestamp || !parsed) return { day: '-', time: '-' };

    const now = new Date();
    const isToday =
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getDate() === now.getDate();
    const day = isToday ? 'วันนี้' : `${parsed.getDate()} ${parsed.toLocaleDateString('th-TH', { month: 'short' })}`;
    const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    return { day, time };
  };

  if (compact) {
    const displayEvents = [...events].reverse();

    return (
      <div className={`relative ${className}`}>
        <div className="space-y-1">
          {displayEvents.map((event, index) => {
            const { day, time } = formatTimelineDateParts(event.timestamp);
            const isLatest = index === 0;
            const hasNext = index < displayEvents.length - 1;
            return (
              <div key={event.id} className="grid grid-cols-[58px_30px_1fr] gap-2 sm:grid-cols-[70px_34px_1fr] sm:gap-3">
                <div className={`pt-2 text-right leading-tight ${isLatest ? 'text-primary' : 'text-on-surface-variant/45'}`}>
                  <p className="text-[11px] font-black sm:text-xs">{day}</p>
                  <p className="mt-1 text-[10px] font-bold sm:text-[11px]">{time}</p>
                </div>
                <div className="relative flex justify-center">
                  {hasNext && (
                    <span className={`absolute top-7 bottom-[-4px] w-px ${isLatest ? 'bg-primary/30' : 'bg-outline-variant/35'}`} />
                  )}
                  <span className={`relative z-10 mt-2 grid h-6 w-6 place-items-center rounded-full ring-4 sm:h-7 sm:w-7 ${
                    isLatest
                      ? 'bg-primary text-white ring-primary/10 shadow-lg shadow-primary/20'
                      : 'border border-outline-variant/25 bg-white text-on-surface-variant/45 ring-surface-container-low'
                  }`}>
                    <span className="material-symbols-outlined text-[14px] sm:text-[15px]">{isLatest ? 'radio_button_checked' : 'check'}</span>
                  </span>
                </div>
                <div className="min-w-0 pb-3">
                  <div className={`rounded-2xl border p-3 transition-all ${
                    isLatest
                      ? 'border-primary/20 bg-primary/[0.035] shadow-sm'
                      : 'border-outline-variant/15 bg-white'
                  }`}>
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-black leading-snug sm:text-base ${isLatest ? 'text-primary' : 'text-on-surface-variant/70'}`}>
                            {event.title}
                          </p>
                          {isLatest && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-white">ล่าสุด</span>
                          )}
                        </div>
                        {event.description && (
                          <p className={`mt-1 break-words text-xs font-semibold leading-snug sm:text-sm ${isLatest ? 'text-primary/75' : 'text-on-surface-variant/55'}`}>
                            {event.description}
                          </p>
                        )}
                      </div>
                      {event.imageUrl && (
                        <ImagePopup url={event.imageUrl} title="รูปหลักฐาน" triggerVariant="icon" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-outline-variant/10 pt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant/55">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {event.timestamp ? formatThaiDateTime(event.timestamp) : '-'}
                      </span>
                      {event.location && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-bold text-on-surface-variant/55">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="truncate">{event.location}</span>
                        </span>
                      )}
                    </div>

                    {event.deliveryMatchStatus && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-black ${
                          event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                            ? 'border-amber-100 bg-amber-50 text-amber-800'
                            : 'border-green-100 bg-green-50 text-green-700'
                        }`}>
                          <span className="material-symbols-outlined text-sm">
                            {event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'move_location' : 'task_alt'}
                          </span>
                          {event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'ส่งคนละจุด' : 'ส่งตรงปลายทาง'}
                        </span>
                        {event.deliveryMismatchReason && (
                          <p className="mt-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-xs font-semibold leading-snug text-on-surface-variant/70">
                            เหตุผล: {event.deliveryMismatchReason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative px-1 ${className}`}>
      {/* Header Summary */}
      {!compact && (
        <div className="mb-10 rounded-3xl border border-outline-variant/20 bg-white p-6 shadow-md flex flex-col items-center gap-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${headerStyle.color} text-white ${headerStyle.shadow} shadow-lg`}>
            <span className="material-symbols-outlined text-xl">
              {headerStyle.icon}
            </span>
          </div>
          <div className="text-center">
            <h3 className="font-display font-black text-primary text-xl leading-tight uppercase tracking-tight">
              {headerStyle.text}
            </h3>
            <p className="text-sm text-on-surface-variant/70 mt-1 font-medium">
              {headerStyle.sub}
            </p>
          </div>
          <div className={`text-[11px] uppercase tracking-widest px-4 py-2 rounded-full font-black shadow-sm border ${headerStyle.badge}`}>
            {headerStyle.badgeText}
          </div>
        </div>
      )}

      <div className="relative space-y-0">
        {events.map((event, index) => {
          const nextEvent = events[index + 1];
          return (
            <div
              key={event.id}
              className={`${compact ? 'pb-3' : 'pb-10'} relative group`}
            >
              {/* Event Card */}
              <div className={`${compact ? 'rounded-2xl p-4' : 'rounded-3xl p-6'} border transition-all duration-300 ${getCardStyle(event.status, event.title)}`}>
                <div className={`flex items-start ${compact ? 'gap-3' : 'gap-4'}`}>
                  <div className="flex-1">
                    <div className={`flex items-center gap-2.5 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                      <h4 className={`font-display font-black leading-tight ${compact ? 'text-base' : 'text-lg'} ${event.status === 'pending' ? 'text-on-surface-variant/40' : 'text-primary'}`}>
                        {event.title}
                      </h4>
                      {event.status === 'current' && (
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-ping" />
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <p className={`${compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed'} font-medium ${event.status === 'pending' ? 'text-on-surface-variant/40' : 'text-on-surface-variant/70'}`}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusIcon(event.status, event.title)}
                  </div>
                </div>
                
                <div className={`${compact ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}`}>
                  {event.status === 'current' && (
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                        event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') 
                          ? 'bg-blue-50 text-blue-700 border-blue-100' 
                          : 'bg-secondary/10 text-primary border-secondary/20'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') ? 'local_shipping' : 'auto_awesome'}
                        </span>
                        {event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') ? 'กำลังจัดส่ง' : 'รอจัดส่ง'}
                      </span>
                    </div>
                  )}
                  {event.deliveryMatchStatus && (
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                        event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                          ? 'bg-amber-50 text-amber-800 border-amber-100'
                          : 'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'move_location' : 'task_alt'}
                        </span>
                        {event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'ส่งคนละจุด' : 'ส่งตรงปลายทาง'}
                      </span>
                      {event.deliveryMismatchReason && (
                        <p className="mt-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-xs font-semibold leading-snug text-on-surface-variant/70">
                          เหตุผล: {event.deliveryMismatchReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className={`flex flex-wrap items-center border-t border-outline-variant/10 ${compact ? 'gap-3 pt-3' : 'gap-4 pt-4'}`}>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <time className="tracking-tight uppercase">{event.timestamp ? formatThaiDateTime(event.timestamp) : '-'}</time>
                    </div>
                    {event.location && (
                      <div className="text-xs font-bold text-on-surface-variant/40">
                        <span className="tracking-tight text-on-surface-variant/60">{event.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Proof Image */}
                  {event.imageUrl && (
                    <div className={`${compact ? 'p-0.5 rounded-xl' : 'p-1 rounded-2xl'} bg-surface-container-low inline-block border border-outline-variant/30 overflow-hidden group/img transition-transform hover:scale-[1.02]`}>
                      <div className="relative">
                        <ImagePopup url={event.imageUrl} className="rounded-xl overflow-hidden" />
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
