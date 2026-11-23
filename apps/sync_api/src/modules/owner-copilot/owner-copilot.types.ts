export const OWNER_COPILOT_READ_TOOLS = ['sales_summary', 'inventory_alerts'] as const;
export type OwnerCopilotReadTool = (typeof OWNER_COPILOT_READ_TOOLS)[number];
export type OwnerCopilotActor = { sub: string; role?: string; roles?: string[]; businessId?: string; branchId?: string };
export type OwnerCopilotPlan = { kind: 'read'; tool: OwnerCopilotReadTool } | { kind: 'write_proposal'; actionType: 'generate_purchase_order' };
export const OWNER_COPILOT_PROVIDER = 'OWNER_COPILOT_PROVIDER';
export interface OwnerCopilotProvider { plan(prompt: string): Promise<OwnerCopilotPlan>; }
export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(/(bearer\s+|token[=:]\s*|password[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => (/token|secret|password|authorization|jwt/i.test(k) ? [k, '[REDACTED]'] : [k, redact(v)])));
  return value;
};
