export const OWNER_COPILOT_READ_TOOLS = ['sales_summary', 'inventory_alerts'] as const;
export type OwnerCopilotReadTool = (typeof OWNER_COPILOT_READ_TOOLS)[number];
export type OwnerCopilotActor = { sub: string; role?: string; roles?: string[]; businessId?: string; branchId?: string };
export type OwnerCopilotWriteAction = 'generate_purchase_order' | 'update_product_price';
export type OwnerCopilotPlan = { kind: 'read'; tool: OwnerCopilotReadTool } | { kind: 'write_proposal'; actionType: OwnerCopilotWriteAction };
export const OWNER_COPILOT_PROVIDER = 'OWNER_COPILOT_PROVIDER';
export interface OwnerCopilotProvider {
  readonly name: 'local' | 'gemini';
  plan(prompt: string): Promise<OwnerCopilotPlan>;
  summarize(prompt: string, tool: OwnerCopilotReadTool, result: unknown): Promise<string>;
}
export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(/(bearer\s+|token[=:]\s*|password[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => (/token|secret|password|authorization|jwt/i.test(k) ? [k, '[REDACTED]'] : [k, redact(v)])));
  return value;
};
