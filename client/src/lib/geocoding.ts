const reverseGeocodeCache = new Map<string, string>();

export function formatCoordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const coordKey = formatCoordinateKey(latitude, longitude);
  if (reverseGeocodeCache.has(coordKey)) {
    return reverseGeocodeCache.get(coordKey)!;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=th`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Doc-Track-PWA/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocode request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data && typeof data.display_name === 'string' && data.display_name.trim().length > 0) {
    const displayName = data.display_name.trim();
    reverseGeocodeCache.set(coordKey, displayName);
    return displayName;
  }

  throw new Error('Reverse geocode returned no display name');
}
