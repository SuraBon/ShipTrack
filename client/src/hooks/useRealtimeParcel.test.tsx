// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Parcel } from '@/types/parcel';
import { getParcel } from '@/lib/parcelService';
import { useRealtimeParcel } from './useRealtimeParcel';

vi.mock('@/lib/parcelService', () => ({
  getParcel: vi.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const baseParcel: Parcel = {
  TrackingID: 'TRK1',
  'วันที่สร้าง': '2026-01-01T00:00:00.000Z',
  'ผู้ส่ง': 'A',
  'สาขาผู้ส่ง': 'HQ',
  'ผู้รับ': 'B',
  'สาขาผู้รับ': 'ปลายทาง',
  'สถานะ': 'กำลังจัดส่ง',
};

type HookState = ReturnType<typeof useRealtimeParcel>;

function Probe({
  enabled,
  initialParcel,
  onState,
}: {
  enabled: boolean;
  initialParcel: Parcel | null;
  onState: (state: HookState) => void;
}) {
  const state = useRealtimeParcel(initialParcel?.TrackingID, enabled, initialParcel);
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return null;
}

function renderProbe(props: {
  enabled: boolean;
  initialParcel: Parcel | null;
  onState: (state: HookState) => void;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Probe {...props} />);
  });
  return { root, container };
}

describe('useRealtimeParcel', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getParcel).mockReset();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    container?.remove();
    container = null;
    vi.useRealTimers();
  });

  it('does not poll when disabled', async () => {
    const states: HookState[] = [];
    ({ root, container } = renderProbe({
      enabled: false,
      initialParcel: baseParcel,
      onState: state => states.push(state),
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(getParcel).not.toHaveBeenCalled();
    expect(states.at(-1)?.parcel).toBe(baseParcel);
  });

  it('fetches immediately and stores the latest parcel when enabled', async () => {
    const updatedParcel = {
      ...baseParcel,
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '2026-01-01T00:01:00.000Z',
        eventType: 'START_DELIVERY' as const,
        location: 'HQ',
        latitude: 13.7,
        longitude: 100.5,
      }],
    };
    vi.mocked(getParcel).mockResolvedValueOnce({ success: true, parcel: updatedParcel });
    const states: HookState[] = [];

    ({ root, container } = renderProbe({
      enabled: true,
      initialParcel: baseParcel,
      onState: state => states.push(state),
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getParcel).toHaveBeenCalledWith('TRK1');
    expect(states.at(-1)?.parcel).toBe(updatedParcel);
    expect(states.at(-1)?.lastUpdatedAt).toEqual(expect.any(Number));
  });

  it('does not start overlapping requests while a refresh is in flight', async () => {
    let resolveRequest: (value: { success: boolean; parcel: Parcel }) => void = () => undefined;
    vi.mocked(getParcel).mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve;
    }));

    ({ root, container } = renderProbe({
      enabled: true,
      initialParcel: baseParcel,
      onState: () => undefined,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    expect(getParcel).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({ success: true, parcel: baseParcel });
      await Promise.resolve();
    });
  });
});
