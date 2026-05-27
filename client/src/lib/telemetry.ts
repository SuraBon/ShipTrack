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

export function logTelemetry(event: Omit<TelemetryEvent, 'ts'> & { ts?: string }): void {
  const full: TelemetryEvent = {
    ts: event.ts ?? new Date().toISOString(),
    level: event.level,
    name: event.name,
    requestId: event.requestId,
    trackingID: event.trackingID,
    action: event.action,
    message: event.message,
    data: event.data,
  };

  const list = safeRead();
  list.push(full);
  safeWrite(list);

  // Console is still the primary "free" observability surface.
  const tag = `[telemetry] ${full.name}`;
  if (full.level === 'error') console.error(tag, full);
  else if (full.level === 'warn') console.warn(tag, full);
  else if (full.level === 'info') console.info(tag, full);
  else console.debug(tag, full);
}

export function getRecentTelemetry(): TelemetryEvent[] {
  return safeRead();
}

