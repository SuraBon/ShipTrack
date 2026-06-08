// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecentTelemetry, logTelemetry } from './telemetry';

describe('telemetry', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('does not persist or log telemetry when explicitly disabled', () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_TELEMETRY', 'false');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logTelemetry({ level: 'info', name: 'api.call', data: { action: 'getParcel' } });

    expect(getRecentTelemetry()).toEqual([]);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('redacts sensitive data before persisting enabled telemetry', () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_TELEMETRY', 'true');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logTelemetry({
      level: 'info',
      name: 'api.call',
      data: {
        token: 'secret-token',
        apiKey: 'secret-api-key',
        photoUrl: 'data:image/jpeg;base64,abc',
        nested: { password: '1234', safe: 'visible' },
      },
    });

    expect(getRecentTelemetry()[0].data).toEqual({
      token: '[redacted]',
      apiKey: '[redacted]',
      photoUrl: '[redacted]',
      nested: { password: '[redacted]', safe: 'visible' },
    });
  });

  it('keeps only the most recent 200 events', () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_TELEMETRY', 'true');
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    for (let i = 0; i < 205; i++) {
      logTelemetry({ level: 'debug', name: 'test.event', data: { index: i } });
    }

    const recent = getRecentTelemetry();
    expect(recent).toHaveLength(200);
    expect(recent[0].data).toEqual({ index: 5 });
    expect(recent[199].data).toEqual({ index: 204 });
  });
});
