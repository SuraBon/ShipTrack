import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCoordinateKey, reverseGeocode } from './geocoding';

describe('geocoding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats coordinate keys consistently', () => {
    expect(formatCoordinateKey(13.756331, 100.501762)).toBe('13.756331,100.501762');
    expect(formatCoordinateKey(13.7563314, 100.5017616)).toBe('13.756331,100.501762');
  });

  it('reverse geocodes latitude and longitude to a display name', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ display_name: 'กรุงเทพมหานคร ประเทศไทย' }),
    }));

    vi.stubGlobal('fetch', mockFetch as unknown);

    const displayName = await reverseGeocode(13.756331, 100.501762);
    expect(displayName).toBe('กรุงเทพมหานคร ประเทศไทย');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=13.756331&lon=100.501762&accept-language=th',
      {
        headers: {
          'User-Agent': 'Doc-Track-PWA/1.0',
        },
      },
    );
  });

  it('throws when reverse geocode response has no display name', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ display_name: '' }),
    }) as unknown);

    await expect(reverseGeocode(13.000000, 100.000000)).rejects.toThrow('Reverse geocode returned no display name');
  });
});
