export type AuditEvent =
  | 'sync.accepted'
  | 'sync.duplicate'
  | 'sync.conflict'
  | 'sync.failed'
  | 'printer.cloud_event';

export interface AuditLogEntry {
  event: AuditEvent;
  transactionId?: string;
  deviceId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export function audit(entry: AuditLogEntry): void {
  const safeEntry = {
    ...entry,
    metadata: redactSensitive(entry.metadata ?? {})
  };
  console.log(JSON.stringify({ level: 'info', ...safeEntry }));
}

function redactSensitive(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    redacted[key] = /card|pan|paymentToken/i.test(key) ? '[redacted]' : value;
  }
  return redacted;
}

