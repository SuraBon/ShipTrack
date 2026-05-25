import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DeliveryMatchStatus, Parcel, ParcelSummary } from '@/types/parcel';
import * as parcelService from '@/lib/parcelService';
import { summarizeParcels } from '@/lib/parcelStatus';
import { saveCreatedParcelHistory } from '@/lib/createdParcelHistory';
import { useAuth } from '@/contexts/AuthContext';

interface ParcelStoreValue {
  parcels: Parcel[];
  summary: ParcelSummary | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  loadParcels: (status?: string, reset?: boolean) => Promise<void>;
  loadMoreParcels: () => Promise<void>;
  createParcel: (
    senderName: string,
    senderBranch: string,
    receiverName: string,
    receiverBranch: string,
    description?: string,
    note?: string,
    latitude?: number,
    longitude?: number,
    photoUrl?: string,
    pin?: string,
  ) => Promise<{ trackingId: string | null; error?: string }>;
  confirmReceipt: (
    trackingID: string,
    photoUrl: string,
    note?: string,
    latitude?: number,
    longitude?: number,
    eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED',
    location?: string,
    destLocation?: string,
    person?: string,
    deliveryMatchStatus?: DeliveryMatchStatus,
    deliveryMismatchReason?: string,
    pin?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeParcelLocally: (trackingID: string) => void;
  updateParcelLocally: (trackingID: string, updates: Partial<Parcel>) => void;
}

const ParcelStoreContext = createContext<ParcelStoreValue | null>(null);

export function ParcelStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [summary, setSummary] = useState<ParcelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('ทั้งหมด');
  const offsetRef = useRef(0);

  const summaryRef = useRef(summary);
  useEffect(() => { summaryRef.current = summary; }, [summary]);

  const loadParcels = useCallback(async (status = 'ทั้งหมด', reset = true) => {
    setCurrentStatus(status);
    if (reset) {
      offsetRef.current = 0;
      setParcels([]);
    }
    setLoading(true);
    setError(null);
    try {
      const [res, rawSummary] = await Promise.all([
        parcelService.getParcels(status, 10, offsetRef.current),
        reset ? parcelService.getParcels('ทั้งหมด', 500, 0) : Promise.resolve(null),
      ]);

      if (res.success) {
        const incomingParcels = res.parcels || [];
        setParcels(prev => reset ? incomingParcels : [...prev, ...incomingParcels]);
        setHasMore(res.hasMore || false);
        setTotalCount(res.totalCount || 0);
        offsetRef.current += incomingParcels.length;
        
        if (reset) {
          // Use all parcels (up to 500) for accurate summary counts
          const allParcels = rawSummary?.success ? (rawSummary.parcels || []) : incomingParcels;
          setSummary(summarizeParcels(allParcels));
        }
        setError(null);
      } else {
        setError(res.error ?? 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, []); // ✅ No deps — uses refs to avoid stale closures

  useEffect(() => {
    const handleSyncComplete = () => {
      void loadParcels(undefined, true);
    };
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('offline-sync-complete', handleSyncComplete);
  }, [loadParcels]);

  const loadMoreParcels = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadParcels(currentStatus, false);
  }, [hasMore, loading, currentStatus, loadParcels]);

  const createParcel = useCallback<ParcelStoreValue['createParcel']>(
    async (senderName, senderBranch, receiverName, receiverBranch, description, note, latitude, longitude, photoUrl, pin) => {
      setError(null);
      try {
        const res = await parcelService.createParcel(
          senderName, senderBranch, receiverName, receiverBranch, description, note, latitude, longitude, photoUrl, pin
        );
        if (!res.success) {
          const message = res.error ?? 'ไม่สามารถสร้างรายการได้';
          setError(message);
          return { trackingId: null, error: message };
        }
        if (res.trackingID) {
          saveCreatedParcelHistory({
            trackingID: res.trackingID,
            createdAt: new Date().toISOString(),
            senderName,
            senderBranch,
            receiverName,
            receiverBranch,
            status: 'รอจัดส่ง',
            proofPhotoUrl: photoUrl,
          });
        }
        if (user) await loadParcels();
        return { trackingId: res.trackingID ?? null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
        setError(message);
        return { trackingId: null, error: message };
      }
    },
    [loadParcels, user],
  );

  const confirmReceipt = useCallback<ParcelStoreValue['confirmReceipt']>(
    async (trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person, deliveryMatchStatus, deliveryMismatchReason, pin) => {
      setError(null);
      try {
        const res = await parcelService.confirmReceipt(trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person, deliveryMatchStatus, deliveryMismatchReason, pin);
        if (res.success) {
          // Optimistic update already applied by the caller (ConfirmReceipt page).
          // Only do a background refresh — don't block the UI.
          loadParcels().catch(() => {});
        } else {
          setError(res.error ?? 'ไม่สามารถยืนยันส่งได้');
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
        setError(message);
        return { success: false, error: message };
      }
    },
    [loadParcels],
  );

  const removeParcelLocally = useCallback((trackingID: string) => {
    setParcels(prev => prev.filter(p => p.TrackingID !== trackingID));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  const updateParcelLocally = useCallback((trackingID: string, updates: Partial<Parcel>) => {
    setParcels(prev => prev.map(p => p.TrackingID === trackingID ? { ...p, ...updates } : p));
  }, []);

  const value = useMemo<ParcelStoreValue>(
    () => ({ parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt, removeParcelLocally, updateParcelLocally }),
    [parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt, removeParcelLocally, updateParcelLocally],
  );

  return <ParcelStoreContext.Provider value={value}>{children}</ParcelStoreContext.Provider>;
}

export function useParcelStoreContext(): ParcelStoreValue {
  const ctx = useContext(ParcelStoreContext);
  if (!ctx) throw new Error('useParcelStore must be used within ParcelStoreProvider');
  return ctx;
}
