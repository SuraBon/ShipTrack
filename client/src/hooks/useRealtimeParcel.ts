import { useEffect, useRef, useState } from 'react';
import type { Parcel } from '@/types/parcel';
import { getParcel } from '@/lib/parcelService';

const REALTIME_REFRESH_MS = 15_000;

type RealtimeParcelState = {
  parcel: Parcel | null;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
};

export function useRealtimeParcel(
  trackingID: string | undefined,
  enabled: boolean,
  initialParcel?: Parcel | null,
): RealtimeParcelState {
  const [parcel, setParcel] = useState<Parcel | null>(initialParcel ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setParcel(initialParcel ?? null);
  }, [initialParcel]);

  useEffect(() => {
    if (!trackingID || !enabled) return;

    let active = true;
    let timerId: number | undefined;

    const refresh = async () => {
      if (inFlightRef.current) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      inFlightRef.current = true;
      setIsRefreshing(true);
      try {
        const res = await getParcel(trackingID);
        if (active && res.success && res.parcel) {
          setParcel(res.parcel);
          setLastUpdatedAt(Date.now());
        }
      } finally {
        inFlightRef.current = false;
        if (active) setIsRefreshing(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    timerId = window.setInterval(() => void refresh(), REALTIME_REFRESH_MS);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      if (timerId !== undefined) window.clearInterval(timerId);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, trackingID]);

  return { parcel, isRefreshing, lastUpdatedAt };
}
