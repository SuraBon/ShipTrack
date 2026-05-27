import { logTelemetry } from './telemetry';

const SYNC_INTERVAL_MS = 30_000;
const BACKGROUND_SYNC_TAG = 'shiptrack-offline-sync';
const SW_SYNC_MESSAGE = 'SHIPTRACK_RUN_SYNC';

let syncRunner: (() => Promise<void>) | null = null;
let isRunning = false;
let intervalId: number | null = null;

export function registerSyncRunner(run: () => Promise<void>): void {
  syncRunner = run;
}

export async function runManagedSync(reason: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!syncRunner || isRunning) return;

  isRunning = true;
  logTelemetry({ level: 'info', name: 'sync.manager.start', message: reason });
  try {
    await syncRunner();
    logTelemetry({ level: 'info', name: 'sync.manager.finish', message: reason });
  } catch (err) {
    logTelemetry({
      level: 'error',
      name: 'sync.manager.error',
      message: reason,
      data: { error: err instanceof Error ? err.message : String(err) },
    });
  } finally {
    isRunning = false;
  }
}

async function registerBackgroundSyncTag(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (syncManager?.register) {
      await syncManager.register(BACKGROUND_SYNC_TAG);
    }
  } catch {
    // Background Sync is optional (browser / permission dependent).
  }
}

export function initSyncManager(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    void runManagedSync('online');
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void runManagedSync('visible');
    }
  });

  window.addEventListener('load', () => {
    if (navigator.onLine) void runManagedSync('load');
    void registerBackgroundSyncTag();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === SW_SYNC_MESSAGE) {
        void runManagedSync('service-worker');
      }
    });
  }

  if (intervalId !== null) window.clearInterval(intervalId);
  intervalId = window.setInterval(() => {
    void runManagedSync('interval');
  }, SYNC_INTERVAL_MS);
}

export { BACKGROUND_SYNC_TAG, SW_SYNC_MESSAGE };
