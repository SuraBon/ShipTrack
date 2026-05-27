import { useEffect, useState } from 'react';
import { getActiveRouteIds, getRouteSyncSnapshot } from '@/lib/routeTracking';

const ROUTE_SYNC_STATUS_EVENT = 'shiptrack-route-sync-status';

export function useRouteSyncStatus() {
  const [pendingRouteSampleCount, setPendingRouteSampleCount] = useState(0);
  const [activeRouteCount, setActiveRouteCount] = useState(0);
  const [latestRouteSampleAt, setLatestRouteSampleAt] = useState<string | null>(null);
  const [lastRouteSyncAt, setLastRouteSyncAt] = useState<string | null>(null);
  const [isRouteSyncing, setIsRouteSyncing] = useState(false);
  const [lastRouteSyncError, setLastRouteSyncError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      setActiveRouteCount(getActiveRouteIds().length);
      void getRouteSyncSnapshot().then(snapshot => {
        if (!active) return;
        setPendingRouteSampleCount(snapshot.pendingRouteSampleCount);
        setLatestRouteSampleAt(snapshot.latestRouteSampleAt);
      });
    };

    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{
        status?: 'start' | 'success' | 'error';
        error?: string;
      }>).detail;
      if (detail?.status === 'start') {
        setIsRouteSyncing(true);
        setLastRouteSyncError(null);
      } else if (detail?.status === 'success') {
        setIsRouteSyncing(false);
        setLastRouteSyncAt(new Date().toISOString());
        setLastRouteSyncError(null);
        refresh();
      } else if (detail?.status === 'error') {
        setIsRouteSyncing(false);
        setLastRouteSyncError(detail.error || 'ซิงค์พิกัดไม่สำเร็จ');
        refresh();
      }
    };

    refresh();
    window.addEventListener('shiptrack-route-samples-updated', refresh);
    window.addEventListener('shiptrack-route-tracking-updated', refresh);
    window.addEventListener('offline-sync-complete', refresh);
    window.addEventListener(ROUTE_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener('online', refresh);
    const intervalId = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.removeEventListener('shiptrack-route-samples-updated', refresh);
      window.removeEventListener('shiptrack-route-tracking-updated', refresh);
      window.removeEventListener('offline-sync-complete', refresh);
      window.removeEventListener(ROUTE_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener('online', refresh);
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    pendingRouteSampleCount,
    activeRouteCount,
    latestRouteSampleAt,
    lastRouteSyncAt,
    isRouteSyncing,
    lastRouteSyncError,
  };
}
