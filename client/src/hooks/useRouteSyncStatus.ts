import { useEffect, useState } from 'react';
import { getActiveRouteIds, getUnsyncedRouteSamples } from '@/lib/routeTracking';

export function useRouteSyncStatus() {
  const [pendingRouteSampleCount, setPendingRouteSampleCount] = useState(0);
  const [activeRouteCount, setActiveRouteCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getUnsyncedRouteSamples().then(samples => {
        if (active) setPendingRouteSampleCount(samples.length);
      });
      setActiveRouteCount(getActiveRouteIds().length);
    };

    refresh();
    window.addEventListener('shiptrack-route-samples-updated', refresh);
    window.addEventListener('shiptrack-route-tracking-updated', refresh);
    window.addEventListener('offline-sync-complete', refresh);
    window.addEventListener('online', refresh);
    const intervalId = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.removeEventListener('shiptrack-route-samples-updated', refresh);
      window.removeEventListener('shiptrack-route-tracking-updated', refresh);
      window.removeEventListener('offline-sync-complete', refresh);
      window.removeEventListener('online', refresh);
      window.clearInterval(intervalId);
    };
  }, []);

  return { pendingRouteSampleCount, activeRouteCount };
}
