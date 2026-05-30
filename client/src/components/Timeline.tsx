/**
 * Timeline Component
 * แสดงเส้นเวลาการจัดส่งแบบทีละขั้นตอน
 * Design: Premium Minimalist Logistics
 */

import { useEffect, useMemo, useState } from 'react';
import type { TimelineEvent } from '@/types/timeline';
import ImagePopup from '@/components/ImagePopup';
import { formatThaiDateTime, parseDateInput } from '@/lib/dateUtils';
import { formatCoordinateKey, reverseGeocode } from '@/lib/geocoding';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  compact?: boolean;
}

export default function Timeline({ events, className = '', compact = false }: TimelineProps) {
  const [resolvedPlaceNames, setResolvedPlaceNames] = useState<Record<string, string>>({});

  const eventsWithCoords = useMemo(
    () => events.filter((event) => !event.location && typeof event.latitude === 'number' && typeof event.longitude === 'number'),
    [events],
  );

  useEffect(() => {
    const coordKeys = eventsWithCoords
      .map((event) => formatCoordinateKey(event.latitude!, event.longitude!))
      .filter((coordKey, index, arr) => arr.indexOf(coordKey) === index && !resolvedPlaceNames[coordKey]);

    if (coordKeys.length === 0) return;

    let isMounted = true;
    const fetchPlaceNames = async () => {
      const nextPlaceNames = { ...resolvedPlaceNames };
      for (const coordKey of coordKeys) {
        const [latString, lngString] = coordKey.split(',');
        const latitude = Number(latString);
        const longitude = Number(lngString);
        try {
          nextPlaceNames[coordKey] = await reverseGeocode(latitude, longitude);
        } catch (error) {
          nextPlaceNames[coordKey] = 'ไม่สามารถระบุสถานที่ได้';
        }
      }
      if (isMounted) {
        setResolvedPlaceNames(nextPlaceNames);
      }
    };

    void fetchPlaceNames();
    return () => {
      isMounted = false;
    };
  }, [eventsWithCoords, resolvedPlaceNames]);

  const getEventLocation = (event: TimelineEvent) => {
    if (event.location) return event.location;
    if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      const coordKey = formatCoordinateKey(event.latitude, event.longitude);
      return resolvedPlaceNames[coordKey] ?? 'กำลังค้นหาสถานที่...';
    }
    return undefined;
  };

  const displayTimelineEvents = events;
  events = displayTimelineEvents;
  const isDelivered = events.some((event) => event.title.includes('ส่งสำเร็จ'));
  const currentEvent = events.find(e => e.status === 'current') || events[0];
  const isTransit = currentEvent?.title.includes('จัดส่ง') || currentEvent?.title.includes('เดินทาง') || currentEvent?.title.includes('ส่งต่อ');
  
  const headerStyle = isDelivered 
    ? { icon: 'task_alt', color: 'bg-emerald-600', shadow: 'shadow-emerald-200', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'ส่งสำเร็จ', sub: 'รายการนี้ถูกส่งถึงปลายทางเรียบร้อยแล้ว', badgeText: 'ส่งสำเร็จ' }
    : isTransit
      ? { icon: 'local_shipping', color: 'bg-blue-600', shadow: 'shadow-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200', text: 'กำลังจัดส่ง', sub: 'รายการนี้อยู่ระหว่างนำส่งไปยังปลายทาง', badgeText: 'กำลังจัดส่ง' }
      : { icon: 'inventory_2', color: 'bg-amber-500', shadow: 'shadow-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'รอจัดส่ง', sub: 'รายการนี้ถูกบันทึกแล้วและรอพนักงานรับงาน', badgeText: 'รอจัดส่ง' };

  const getStatusIcon = (status: TimelineEvent['status'], title: string) => {
    const iconSize = compact ? 'w-7 h-7' : 'w-8 h-8';
    const iconText = compact ? 'text-base' : 'text-lg';
    switch (status) {
      case 'completed':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 ${iconSize}`}>
            <span className={`material-symbols-outlined font-bold ${iconText}`} aria-hidden="true">check</span>
          </div>
        );
      case 'current':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-secondary text-primary shadow-lg shadow-secondary/30 ${iconSize}`}>
            <div className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-25"></div>
            <span className={`material-symbols-outlined font-bold ${iconText}`} aria-hidden="true">
              {title.includes('ส่งต่อ') ? 'local_shipping' : 'radio_button_checked'}
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className={`relative flex items-center justify-center rounded-full bg-surface-container border-2 border-outline-variant ${iconSize}`}>
            <span className={`material-symbols-outlined text-outline-variant ${iconText}`} aria-hidden="true">pending</span>
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
        return 'bg-white dark:bg-card border-outline-variant/30 hover:border-primary/20 hover:bg-surface-container-low/20';
      case 'current': {
        const isCurrentTransit = title.includes('จัดส่ง') || title.includes('เดินทาง');
        const colorClass = isCurrentTransit ? 'border-blue-500 shadow-blue-500/5 ring-blue-500/10' : 'border-secondary shadow-secondary/5 ring-secondary/10';
        return `bg-white dark:bg-card ${colorClass} shadow-xl ring-1`;
      }
      case 'pending':
        return 'bg-surface-container-lowest border-outline-variant/20 opacity-70';
      default:
        return 'bg-white dark:bg-card border-outline-variant/30';
    }
  };

  const formatTimelineDateParts = (timestamp: string) => {
    const parsed = parseDateInput(timestamp);
    if (!timestamp || !parsed) return { day: '', time: '' };

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
    const getCompactTone = (event: TimelineEvent, isLatest: boolean) => {
      const isDeliveredEvent = event.title.includes('ส่งสำเร็จ');
      const isTransitEvent = event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') || event.title.includes('รับงาน');
      const isWaitingEvent = event.status === 'current' && !isDeliveredEvent && !isTransitEvent;

      if (isDeliveredEvent) {
        return {
          dot: 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.16)]',
          card: isLatest ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/25 dark:border-emerald-800/50 shadow-sm' : 'border-emerald-100 dark:border-emerald-800/30 bg-white dark:bg-card',
          title: 'text-emerald-900 dark:text-emerald-300',
          badge: isLatest ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/40',
          line: 'bg-emerald-200 dark:bg-emerald-800/50',
        };
      }

      if (isTransitEvent || event.status === 'current') {
        return {
          dot: 'border-blue-500 bg-blue-600 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.16)]',
          card: isLatest ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/25 dark:border-blue-800/50 shadow-sm' : 'border-blue-100 dark:border-blue-800/30 bg-white dark:bg-card',
          title: 'text-blue-900 dark:text-blue-300',
          badge: isLatest ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/40',
          line: 'bg-blue-200 dark:bg-blue-800/50',
        };
      }

      if (isWaitingEvent || event.status === 'pending') {
        return {
          dot: 'border-amber-500 bg-amber-500 text-white',
          card: isLatest ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/25 dark:border-amber-800/50 shadow-sm' : 'border-amber-100 dark:border-amber-800/30 bg-white dark:bg-card',
          title: 'text-amber-900 dark:text-amber-300',
          badge: isLatest ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-800/40',
          line: 'bg-amber-200 dark:bg-amber-800/50',
        };
      }

      return {
        dot: event.status === 'completed' ? 'border-slate-400 bg-slate-500 text-white' : 'border-slate-300 bg-white dark:bg-card text-slate-400',
        card: isLatest ? 'border-slate-200 dark:border-outline-variant bg-slate-50 dark:bg-surface-container shadow-sm' : 'border-slate-100 dark:border-outline-variant/50 bg-white dark:bg-card',
        title: 'text-slate-800 dark:text-foreground',
        badge: 'bg-slate-100 dark:bg-surface-container text-slate-600 dark:text-muted-foreground',
        line: 'bg-slate-200 dark:bg-outline-variant/50',
      };
    };

    return (
      <div className={`relative ${className}`}>
        <div className="space-y-1">
          {displayEvents.map((event, index) => {
            const { day, time } = formatTimelineDateParts(event.timestamp);
            const isLatest = index === 0;
            const hasNext = index < displayEvents.length - 1;
            const stepNumber = displayEvents.length - index;
            const tone = getCompactTone(event, isLatest);
            const statusLabel = isLatest ? 'ล่าสุด' : event.status === 'completed' ? 'บันทึกแล้ว' : 'รอดำเนินการ';
            const locationText = getEventLocation(event);
            return (
              <div key={event.id} className="grid grid-cols-[52px_28px_minmax(0,1fr)] gap-2.5">
                <div className={`pt-2 text-right leading-none ${isLatest ? 'text-slate-900 dark:text-foreground' : 'text-slate-400 dark:text-muted-foreground'}`}>
                  {day ? (
                    <>
                      <p className="text-[10px] font-black">{day}</p>
                      <p className="mt-1 text-[9px] font-semibold">{time}</p>
                    </>
                  ) : (
                    <p className="text-[9px] font-bold leading-tight text-slate-300 dark:text-muted-foreground/50">ไม่ระบุเวลา</p>
                  )}
                </div>
                <div className="relative flex justify-center">
                  {hasNext && (
                    <span className={`absolute bottom-[-4px] top-[25px] w-0.5 rounded-full ${tone.line}`} />
                  )}
                  <span className={`relative z-10 mt-1 grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-black ${tone.dot}`}>
                    {event.title.includes('ส่งสำเร็จ') || (event.status === 'completed' && !isLatest) ? '✓' : stepNumber}
                  </span>
                </div>
                <div className="min-w-0 pb-3">
                  <div className={`rounded-xl border px-3 py-2.5 transition-all ${tone.card}`}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-black leading-none ${tone.badge}`}>
                            {statusLabel}
                          </span>
                          <p className={`text-sm font-black leading-tight ${tone.title}`}>
                            {event.title}
                          </p>
                        </div>
                        {event.description && (
                          <p className={`${isLatest ? 'line-clamp-3' : 'line-clamp-2'} mt-1.5 break-words text-[11px] font-semibold leading-snug text-slate-500 dark:text-muted-foreground`}>
                            {event.description}
                          </p>
                        )}
                      </div>
                      {event.imageUrl && (
                        <ImagePopup
                          url={event.imageUrl}
                          title="รูปหลักฐาน"
                          triggerVariant="icon"
                          className="h-10 w-10 rounded-xl bg-white dark:bg-surface-container text-slate-900 dark:text-foreground shadow-sm ring-1 ring-blue-100 dark:ring-outline-variant hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300"
                        />
                      )}
                    </div>

                    <div className={`${isLatest ? 'mt-2 border-t border-white/70 dark:border-outline-variant/30 pt-1.5' : 'mt-2'} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                      {event.timestamp && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-muted-foreground">
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">schedule</span>
                          {formatThaiDateTime(event.timestamp)}
                        </span>
                      )}
                      {locationText && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-muted-foreground">
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">place</span>
                          <span className="truncate">{locationText}</span>
                        </span>
                      )}
                    </div>

                    {event.deliveryMatchStatus && (
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-bold ${
                          event.deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                            ? 'border-amber-100 bg-amber-50 text-amber-800'
                            : 'border-green-100 bg-green-50 text-green-700'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
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
        <div className="mb-10 rounded-3xl border border-outline-variant/20 bg-white dark:bg-card p-6 shadow-md flex flex-col items-center gap-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${headerStyle.color} text-white ${headerStyle.shadow} shadow-lg`}>
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
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
        {events.map((event) => {
          const locationText = getEventLocation(event);
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
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
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
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
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
                      <span className="material-symbols-outlined text-base" aria-hidden="true">schedule</span>
                      <time className="tracking-tight uppercase">{event.timestamp ? formatThaiDateTime(event.timestamp) : '-'}</time>
                    </div>
                    {locationText && (
                      <div className="text-xs font-bold text-on-surface-variant/40">
                        <span className="tracking-tight text-on-surface-variant/60">{locationText}</span>
                      </div>
                    )}
                  </div>

                  {/* Proof Image */}
                  {event.imageUrl && (
                    <ImagePopup
                      url={event.imageUrl}
                      title="รูปหลักฐาน"
                      triggerVariant="icon"
                      className="h-10 w-10 rounded-xl bg-surface-container-low text-primary shadow-sm ring-1 ring-outline-variant/30 hover:bg-surface-container"
                    />
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
