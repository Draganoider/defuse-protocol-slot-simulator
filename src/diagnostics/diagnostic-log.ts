export const DIAGNOSTIC_STORAGE_KEY = 'defuse-protocol:diagnostics:v1';
const ACTIVE_SESSION_KEY = 'defuse-protocol:diagnostics-active:v1';
const MAX_EVENTS = 240;

export type DiagnosticValue = string | number | boolean | null;

export interface DiagnosticEvent {
  readonly sequence: number;
  readonly at: string;
  readonly type: string;
  readonly details: Readonly<Record<string, DiagnosticValue>>;
}

const subscribers = new Set<(events: readonly DiagnosticEvent[]) => void>();
const rateLimits = new Map<string, number>();
let cache: DiagnosticEvent[] | undefined;

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function isEvent(value: unknown): value is DiagnosticEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<DiagnosticEvent>;
  return Number.isInteger(event.sequence)
    && typeof event.at === 'string'
    && typeof event.type === 'string'
    && Boolean(event.details && typeof event.details === 'object');
}

export function parseDiagnosticEvents(value: unknown): DiagnosticEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEvent).slice(-MAX_EVENTS).map((event) => ({
    sequence: event.sequence,
    at: event.at,
    type: event.type.slice(0, 80),
    details: event.details,
  }));
}

export function appendDiagnosticEvent(events: readonly DiagnosticEvent[], event: DiagnosticEvent): DiagnosticEvent[] {
  return [...events, event].slice(-MAX_EVENTS);
}

export function readDiagnosticEvents(): readonly DiagnosticEvent[] {
  if (cache) return cache;
  const target = storage();
  if (!target) return [];
  try {
    cache = parseDiagnosticEvents(JSON.parse(target.getItem(DIAGNOSTIC_STORAGE_KEY) ?? '[]'));
  } catch {
    cache = [];
  }
  return cache;
}

function persist(events: readonly DiagnosticEvent[]): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Diagnostics are best-effort and must never interfere with play.
  }
}

export function recordDiagnostic(type: string, details: Readonly<Record<string, DiagnosticValue>> = {}): void {
  const previous = readDiagnosticEvents();
  const event: DiagnosticEvent = {
    sequence: (previous.at(-1)?.sequence ?? 0) + 1,
    at: new Date().toISOString(),
    type: type.slice(0, 80),
    details,
  };
  cache = appendDiagnosticEvent(previous, event);
  persist(cache);
  subscribers.forEach((subscriber) => subscriber(cache ?? []));
}

export function recordDiagnosticRateLimited(
  type: string,
  details: Readonly<Record<string, DiagnosticValue>> = {},
  intervalMs = 1_000,
): void {
  const now = performance.now();
  const last = rateLimits.get(type) ?? Number.NEGATIVE_INFINITY;
  if (now - last < intervalMs) return;
  rateLimits.set(type, now);
  recordDiagnostic(type, details);
}

export function clearDiagnosticEvents(): void {
  cache = [];
  rateLimits.clear();
  try {
    storage()?.removeItem(DIAGNOSTIC_STORAGE_KEY);
  } catch {
    // Clearing diagnostics is best-effort.
  }
  subscribers.forEach((subscriber) => subscriber([]));
}

export function subscribeDiagnosticEvents(subscriber: (events: readonly DiagnosticEvent[]) => void): () => void {
  subscribers.add(subscriber);
  subscriber(readDiagnosticEvents());
  return () => subscribers.delete(subscriber);
}

export function formatDiagnosticEvents(events = readDiagnosticEvents()): string {
  return JSON.stringify({
    format: 'defuse-protocol-diagnostics-v1',
    exportedAt: new Date().toISOString(),
    events,
  }, null, 2);
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message.slice(0, 500);
  return String(value).slice(0, 500);
}

export function installGlobalDiagnostics(): void {
  const globalState = globalThis as typeof globalThis & { __defuseProtocolDiagnosticsInstalled?: boolean };
  if (globalState.__defuseProtocolDiagnosticsInstalled) return;
  globalState.__defuseProtocolDiagnosticsInstalled = true;

  const target = storage();
  let previousSession: string | null = null;
  try {
    previousSession = target?.getItem(ACTIVE_SESSION_KEY) ?? null;
    target?.setItem(ACTIVE_SESSION_KEY, new Date().toISOString());
  } catch {
    // Session markers are optional.
  }
  if (previousSession) recordDiagnostic('unclean-session-recovery', { previousSession });
  recordDiagnostic('app-start', {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
  });

  window.addEventListener('error', (event) => {
    recordDiagnostic('window-error', {
      message: event.message.slice(0, 500),
      source: event.filename ? event.filename.split('/').at(-1) ?? 'unknown' : 'unknown',
      line: event.lineno,
      column: event.colno,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordDiagnostic('unhandled-rejection', { message: errorMessage(event.reason) });
  });
  window.addEventListener('pagehide', () => {
    recordDiagnostic('pagehide', { visibility: document.visibilityState });
    try {
      target?.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // Session markers are optional.
    }
  });
}
