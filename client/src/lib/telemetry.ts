type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

type TelemetryEvent = {
  ts: string;
  level: TelemetryLevel;
  name: string;
  requestId?: string;
  trackingID?: string;
  action?: string;
  message?: string;
  data?: Record<string, unknown>;
};

const STORAGE_KEY = 'shiptrack_telemetry_v1';
const MAX_EVENTS = 200;
const MAX_STRING_LENGTH = 240;
const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN = /token|apikey|api_key|password|pin|photourl|image|base64/i;

function isTelemetryEnabled(): boolean {
  const explicit = import.meta.env.VITE_ENABLE_CLIENT_TELEMETRY;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return Boolean(import.meta.env.DEV && import.meta.env.MODE !== 'test');
}

export function createRequestId(prefix: string = 'req'): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${t}_${r}`;
}

function safeRead(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(events: TelemetryEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // ignore quota/private mode
  }
}

function sanitizeTelemetryValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return REDACTED;
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeTelemetryValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeTelemetryValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function sanitizeTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  return {
    ...event,
    trackingID: typeof event.trackingID === 'string' ? event.trackingID.slice(0, 100) : event.trackingID,
    message: typeof event.message === 'string' ? String(sanitizeTelemetryValue(event.message)) : event.message,
    data: event.data ? sanitizeTelemetryValue(event.data) as Record<string, unknown> : undefined,
  };
}

export function logTelemetry(event: Omit<TelemetryEvent, 'ts'> & { ts?: string }): void {
  const full = sanitizeTelemetryEvent({
    ts: event.ts ?? new Date().toISOString(),
    level: event.level,
    name: event.name,
    requestId: event.requestId,
    trackingID: event.trackingID,
    action: event.action,
    message: event.message,
    data: event.data,
  });

  if (isTelemetryEnabled()) {
    const list = safeRead();
    list.push(full);
    safeWrite(list);

    const tag = `[telemetry] ${full.name}`;
    if (full.level === 'error') console.error(tag, full);
    else if (full.level === 'warn') console.warn(tag, full);
    else if (full.level === 'info') console.info(tag, full);
    else console.debug(tag, full);
  }
}

export function getRecentTelemetry(): TelemetryEvent[] {
  return safeRead();
}
