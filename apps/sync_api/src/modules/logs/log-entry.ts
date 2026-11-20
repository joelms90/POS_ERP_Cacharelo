import { createHash } from 'crypto';

/**
 * Shared shapes + pure helpers for the production log pipeline.
 * Kept free of Nest/DB imports so they can be unit-tested in isolation.
 */

export const LOG_SOURCES = ['pos_flutter', 'admin_web', 'sync_api'] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppLogEntry {
  source: LogSource;
  level: LogLevel;
  message: string;
  stack: string | null;
  fingerprint: string;
  occurredAt: Date;
  businessId: string | null;
  branchId: string | null;
  branchName: string | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  deviceId: string | null;
  appVersion: string | null;
  platform: string | null;
  route: string | null;
  httpMethod: string | null;
  httpStatus: number | null;
  context: Record<string, unknown> | null;
  breadcrumbs: string[] | null;
  userAgent: string | null;
}

export const LIMITS = {
  entriesPerRequest: 50,
  message: 2000,
  stack: 8000,
  shortField: 200,
  route: 500,
  contextJson: 8000,
  breadcrumbs: 40,
  breadcrumbLength: 300,
};

const SECRET_PATTERN =
  /("?(?:pin|password|passwd|secret|token|accessToken|refreshToken|authorization|x-admin-token)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,&}]+)/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-_.=]+/g;

/** Removes obvious credentials (PINs, passwords, tokens) from free text. */
export function scrubSecrets(text: string): string {
  return text
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(SECRET_PATTERN, '$1[REDACTED]');
}

const SENSITIVE_QUERY =
  /"users"|\bpin\b|pin_hash|encrypted_pin|password|token/i;

/**
 * Drizzle errors embed the SQL and its bound values ("params: …"). Values of
 * queries touching credentials are redacted; others are kept (useful for
 * debugging, e.g. an invalid uuid).
 */
export function redactQueryParams(text: string): string {
  const idx = text.indexOf('\nparams:');
  if (idx === -1 || !SENSITIVE_QUERY.test(text.slice(0, idx))) return text;
  return text.replace(/\nparams:[^\n]*/g, '\nparams: [REDACTED]');
}

/** Message without bound values, so one bug yields one fingerprint. */
export function stripQueryParams(text: string): string {
  return text.replace(/\nparams:[^\n]*/g, '');
}

function str(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const s = typeof value === 'string' ? value : String(value);
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n < 1000 ? n : null;
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  // Reject clocks that are wildly off; keep server time instead.
  const drift = Math.abs(d.getTime() - fallback.getTime());
  return drift > 7 * 24 * 3600 * 1000 ? fallback : d;
}

/**
 * Normalizes a message so that the same bug produces the same fingerprint
 * regardless of ids, numbers or quoted values embedded in it.
 */
export function normalizeForFingerprint(message: string): string {
  return message
    .toLowerCase()
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '<uuid>',
    )
    .replace(/https?:\/\/[^\s?]+(\?\S*)?/g, (url) => url.split('?')[0])
    .replace(/"[^"]*"|'[^']*'/g, '<str>')
    .replace(/\d+(\.\d+)?/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function fingerprintOf(
  source: string,
  message: string,
  route?: string | null,
): string {
  const routeKey = route ? normalizeForFingerprint(route.split('?')[0]) : '';
  return createHash('sha1')
    .update(`${source}|${normalizeForFingerprint(message)}|${routeKey}`)
    .digest('hex')
    .slice(0, 16);
}

function sanitizeContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const json = scrubSecrets(JSON.stringify(value));
    if (json.length <= LIMITS.contextJson) return JSON.parse(json);
    return { truncated: true, preview: json.slice(0, LIMITS.contextJson) };
  } catch {
    return null;
  }
}

function sanitizeBreadcrumbs(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const crumbs = value
    .slice(-LIMITS.breadcrumbs)
    .map((c) => str(c, LIMITS.breadcrumbLength))
    .filter((c): c is string => Boolean(c))
    .map(scrubSecrets);
  return crumbs.length ? crumbs : null;
}

/**
 * Converts an untrusted client payload into a bounded, scrubbed entry.
 * Returns null when the payload has no usable message.
 */
export function sanitizeClientEntry(
  raw: unknown,
  defaults: { source?: LogSource; userAgent?: string | null; now?: Date } = {},
): AppLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const now = defaults.now ?? new Date();

  const message = str(r.message, LIMITS.message);
  if (!message) return null;

  const source = LOG_SOURCES.includes(r.source as LogSource)
    ? (r.source as LogSource)
    : (defaults.source ?? 'pos_flutter');
  const level = LOG_LEVELS.includes(r.level as LogLevel)
    ? (r.level as LogLevel)
    : 'error';
  const route = str(r.route, LIMITS.route);
  const scrubbedMessage = scrubSecrets(message);

  return {
    source,
    level,
    message: scrubbedMessage,
    stack: (() => {
      const s = str(r.stack, LIMITS.stack);
      return s ? scrubSecrets(s) : null;
    })(),
    fingerprint: fingerprintOf(source, scrubbedMessage, route),
    occurredAt: parseDate(r.occurredAt, now),
    businessId: str(r.businessId, 64),
    branchId: str(r.branchId, 64),
    branchName: str(r.branchName, LIMITS.shortField),
    userId: str(r.userId, 64),
    userName: str(r.userName, LIMITS.shortField),
    userRole: str(r.userRole, 50),
    deviceId: str(r.deviceId, 100),
    appVersion: str(r.appVersion, 50),
    platform: str(r.platform, 50),
    route: route ? scrubSecrets(route) : null,
    httpMethod: str(r.httpMethod, 10)?.toUpperCase() ?? null,
    httpStatus: int(r.httpStatus),
    context: sanitizeContext(r.context),
    breadcrumbs: sanitizeBreadcrumbs(r.breadcrumbs),
    userAgent: str(defaults.userAgent, 300),
  };
}
