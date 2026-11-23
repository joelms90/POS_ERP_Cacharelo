/**
 * Read-only vocabulary shared conceptually with the Owner Business Copilot.
 *
 * This file deliberately contains no client, credential, user identity, or
 * request function. The web Copilot runs its adapters inside the API using the
 * authenticated caller; it never invokes MCP or inherits this server's static
 * service identity.
 */
export type OwnerCopilotReadToolName =
  | 'get_stock_alerts'
  | 'get_active_orders'
  | 'get_requisitions'
  | 'get_purchase_orders'
  | 'get_error_summary';

export interface OwnerCopilotReadToolConcept {
  name: OwnerCopilotReadToolName;
  label: string;
  sourcePath: string;
}

export const OWNER_COPILOT_READ_TOOL_CONCEPTS: readonly OwnerCopilotReadToolConcept[] = [
  { name: 'get_stock_alerts', label: 'Alertas de inventario', sourcePath: '/inventory/alerts' },
  { name: 'get_active_orders', label: 'Órdenes abiertas', sourcePath: '/orders/active' },
  { name: 'get_requisitions', label: 'Requisiciones', sourcePath: '/requisitions' },
  { name: 'get_purchase_orders', label: 'Órdenes de compra', sourcePath: '/purchase-orders' },
  { name: 'get_error_summary', label: 'Resumen de incidencias', sourcePath: '/logs/summary' },
];

export function isOwnerCopilotReadTool(value: string): value is OwnerCopilotReadToolName {
  return OWNER_COPILOT_READ_TOOL_CONCEPTS.some((tool) => tool.name === value);
}
