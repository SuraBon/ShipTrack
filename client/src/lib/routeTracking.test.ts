import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRouteSamples,
  startRouteTracking,
  stopRouteTracking,
  clearRouteSamples,
  getUnsyncedRouteSamples,
  markRouteSamplesSynced,
} from './routeTracking';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key in store) delete store[key];
  }),
};

let watchSuccess: ((position: GeolocationPosition) => void) | null = null;
const geolocationMock = {
  watchPosition: vi.fn((success: (position: GeolocationPosition) => void) => {
    watchSuccess = success;
    return 7;
  }),
  clearWatch: vi.fn(),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true });
Object.defineProperty(globalThis, 'window', {
  value: {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
  },
  writable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: { geolocation: geolocationMock },
  writable: true,
});

function emitPosition(latitude: number, longitude: number, timestamp = Date.now()) {
  watchSuccess?.({
    coords: {
      latitude,
      longitude,
      accuracy: 20,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp,
    toJSON: () => ({}),
  } as GeolocationPosition);
}

describe('routeTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    watchSuccess = null;
  });

  it('starts tracking and stores route samples', async () => {
    expect(startRouteTracking('TRK1')).toBe(true);
    emitPosition(13.7563, 100.5018, 1_000);
    emitPosition(13.7580, 100.5030, 20_000);

    const samples = await getRouteSamples('TRK1');
    expect(samples).toHaveLength(2);
    expect(samples[0]).toMatchObject({ trackingID: 'TRK1', latitude: 13.7563 });
  });

  it('stops active tracking', () => {
    startRouteTracking('TRK2');
    stopRouteTracking('TRK2');
    expect(geolocationMock.clearWatch).toHaveBeenCalledWith(7);
  });

  it('clears stored route samples for a tracking id', async () => {
    startRouteTracking('TRK3');
    emitPosition(13.7563, 100.5018, 1_000);

    await clearRouteSamples('TRK3');
    await expect(getRouteSamples('TRK3')).resolves.toEqual([]);
  });

  it('marks route samples as synced without deleting local map data', async () => {
    startRouteTracking('TRK4');
    emitPosition(13.7563, 100.5018, 1_000);

    const [sample] = await getUnsyncedRouteSamples('TRK4');
    expect(sample).toBeTruthy();

    await markRouteSamplesSynced([sample.id]);

    await expect(getUnsyncedRouteSamples('TRK4')).resolves.toEqual([]);
    await expect(getRouteSamples('TRK4')).resolves.toMatchObject([{ id: sample.id, synced: true }]);
  });

  it('does not throw when route sample fallback storage is unavailable', async () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('quota');
    });

    expect(startRouteTracking('TRK5')).toBe(true);
    expect(() => emitPosition(13.7563, 100.5018, 1_000)).not.toThrow();
  });

  it('returns false when geolocation watch cannot start', () => {
    geolocationMock.watchPosition.mockImplementationOnce(() => {
      throw new Error('permission');
    });

    expect(startRouteTracking('TRK6')).toBe(false);
  });
});
