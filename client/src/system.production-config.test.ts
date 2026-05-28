import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../..');

function readPngSize(relativePath: string): { width: number; height: number } {
  const buffer = readFileSync(resolve(repoRoot, relativePath));
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('production configuration', () => {
  it('ships Vercel security and PWA cache headers', () => {
    const config = JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf8')) as {
      headers?: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };

    const allHeaders = new Map(
      (config.headers ?? []).flatMap(entry => entry.headers.map(header => [header.key, header.value])),
    );
    expect(allHeaders.get('X-Content-Type-Options')).toBe('nosniff');
    expect(allHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(allHeaders.get('X-Frame-Options')).toBe('DENY');
    expect(allHeaders.get('Permissions-Policy')).toContain('camera=(self)');
    expect(config.headers?.some(entry => entry.source.includes('manifest.webmanifest') && entry.headers.some(header => header.value === 'no-cache'))).toBe(true);
    expect(config.headers?.some(entry => entry.source === '/assets/(.*)' && entry.headers.some(header => header.value.includes('immutable')))).toBe(true);
  });

  it('keeps the PWA manifest on the cache-busted icon files', () => {
    const viteConfig = readFileSync(resolve(repoRoot, 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('"apple-touch-icon-v2.png"');
    expect(viteConfig).toContain('src: "icon-192-v2.png"');
    expect(viteConfig).toContain('src: "icon-512-v2.png"');
    expect(viteConfig).not.toContain('src: "icon-192.png"');
    expect(viteConfig).not.toContain('src: "icon-512.png"');
  });

  it('ships generated PWA icons with the expected dimensions', () => {
    expect(readPngSize('client/public/apple-touch-icon-v2.png')).toEqual({ width: 180, height: 180 });
    expect(readPngSize('client/public/icon-192-v2.png')).toEqual({ width: 192, height: 192 });
    expect(readPngSize('client/public/icon-512-v2.png')).toEqual({ width: 512, height: 512 });
  });

  it('keeps realtime parcel refresh and event marker maps wired into the main screens', () => {
    const trackPage = readFileSync(resolve(repoRoot, 'client/src/pages/Track.tsx'), 'utf8');
    const dashboardPage = readFileSync(resolve(repoRoot, 'client/src/pages/Dashboard.tsx'), 'utf8');
    const trackingMap = readFileSync(resolve(repoRoot, 'client/src/components/TrackingMap.tsx'), 'utf8');

    expect(trackPage).toContain('useRealtimeParcel');
    expect(dashboardPage).toContain('useRealtimeParcel');
    expect(trackingMap).toContain('MAIN_MARKER_TYPES');
    expect(trackingMap).not.toContain('Polyline');
  });
});
