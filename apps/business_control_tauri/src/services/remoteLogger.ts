/**
 * Ships admin-web errors to `POST {apiUrl}/logs` (table app_logs) so issues
 * reported by users of cacharelo-central.web.app can be triaged later by an
 * agent via `make logs-today` / the MCP log tools.
 *
 * Standalone on purpose (no imports from api.ts) so it can never create a
 * circular dependency or recurse through the API client it observes.
 */

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LoggerConfig {
  apiUrl: () => string;
  user: () => { id?: string; name?: string; role?: string; businessId?: string; branchId?: string } | null;
}

interface Entry {
  source: 'admin_web';
  level: Level;
  message: string;
  stack?: string;
  occurredAt: string;
  route?: string;
  httpMethod?: string;
  httpStatus?: number;
  context?: Record<string, unknown>;
  breadcrumbs: string[];
  businessId?: string;
  branchId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  deviceId: string;
  appVersion: string;
  platform: string;
}

declare const __APP_BUILD_ID__: string;

const STORAGE_KEY = 'BC-Remote-Log-Queue';
const DEVICE_KEY = 'BC-Device-Id';
const MAX_QUEUE = 100;
const MAX_CRUMBS = 30;
const DEDUPE_MS = 5 * 60_000;

const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode / quota); logging stays in memory
    }
  },
};

const normalize = (msg: string) =>
  msg
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\d+/g, '<n>');

class RemoteLogger {
  private config: LoggerConfig | null = null;
  private queue: Array<Entry & { _key: string }> = [];
  private crumbs: string[] = [];
  private recent = new Map<string, number>();
  private flushing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private screen = '';

  configure(config: LoggerConfig) {
    this.config = config;
    try {
      const stored = JSON.parse(safeStorage.get(STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) this.queue = stored.slice(-MAX_QUEUE);
    } catch {
      this.queue = [];
    }
    setInterval(() => void this.flush(), 60_000);
    window.addEventListener('pagehide', () => void this.flush(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush(true);
    });
    window.addEventListener('online', () => void this.flush());
    if (this.queue.length) void this.flush();
  }

  /** Current admin screen/tab; attached to every entry. */
  setScreen(screen: string) {
    if (screen !== this.screen) this.breadcrumb(`screen → ${screen}`);
    this.screen = screen;
  }

  breadcrumb(message: string) {
    const ts = new Date().toISOString().slice(11, 19);
    this.crumbs.push(`${ts} ${message.slice(0, 300)}`);
    if (this.crumbs.length > MAX_CRUMBS) this.crumbs.shift();
  }

  error(message: string, extra: Partial<Pick<Entry, 'stack' | 'context'>> = {}) {
    this.log('error', message, extra);
  }

  log(
    level: Level,
    message: string,
    extra: Partial<Pick<Entry, 'stack' | 'route' | 'httpMethod' | 'httpStatus' | 'context'>> = {},
  ) {
    const key = `${level}|${extra.route ?? ''}|${normalize(message)}`;
    const now = Date.now();
    for (const [k, t] of this.recent) if (now - t > DEDUPE_MS) this.recent.delete(k);
    if (this.recent.has(key)) {
      const existing = [...this.queue].reverse().find((e) => e._key === key);
      if (existing) {
        const count = Number(existing.context?.repeatCount ?? 1) + 1;
        existing.context = { ...existing.context, repeatCount: count };
      }
      return;
    }
    this.recent.set(key, now);

    const user = this.safeUser();
    this.queue.push({
      _key: key,
      source: 'admin_web',
      level,
      message: message.slice(0, 2000),
      stack: extra.stack?.slice(0, 8000),
      occurredAt: new Date(now).toISOString(),
      route: extra.route,
      httpMethod: extra.httpMethod,
      httpStatus: extra.httpStatus,
      context: { screen: this.screen, url: window.location.pathname + window.location.hash, ...extra.context },
      breadcrumbs: [...this.crumbs],
      businessId: safeStorage.get('BC-Active-Business') ?? user?.businessId,
      branchId: user?.branchId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      deviceId: this.deviceId(),
      appVersion: typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev',
      platform: 'web',
    });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    this.persist();

    if (level === 'error' || level === 'fatal') {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => void this.flush(), 2000);
    }
  }

  async flush(unloading = false): Promise<void> {
    if (this.flushing || !this.queue.length || !this.config) return;
    this.flushing = true;
    const batch = this.queue.slice(0, 50);
    try {
      const entries = batch.map(({ _key, ...rest }) => rest);
      const res = await fetch(`${this.config.apiUrl().replace(/\/+$/, '')}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
        keepalive: unloading,
      });
      if (res.status < 500) {
        this.queue = this.queue.filter((e) => !batch.includes(e));
        this.persist();
      }
    } catch {
      // offline / API down: keep for next attempt
    } finally {
      this.flushing = false;
    }
  }

  private safeUser() {
    try {
      return this.config?.user() ?? null;
    } catch {
      return null;
    }
  }

  private deviceId(): string {
    let id = safeStorage.get(DEVICE_KEY);
    if (!id) {
      id = `web-${Math.random().toString(36).slice(2, 10)}`;
      safeStorage.set(DEVICE_KEY, id);
    }
    return id;
  }

  private persist() {
    safeStorage.set(STORAGE_KEY, JSON.stringify(this.queue));
  }
}

export const remoteLogger = new RemoteLogger();
