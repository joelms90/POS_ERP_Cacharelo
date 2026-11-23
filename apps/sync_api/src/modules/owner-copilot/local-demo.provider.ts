import { Injectable } from '@nestjs/common';
import { OwnerCopilotPlan, OwnerCopilotProvider } from './owner-copilot.types';

/** Deterministic development provider; production adapters must stay server-side. */
@Injectable()
export class LocalDemoOwnerCopilotProvider implements OwnerCopilotProvider {
  async plan(prompt: string): Promise<OwnerCopilotPlan> {
    const normalized = prompt.toLocaleLowerCase('es-MX');
    if (/crear|generar|comprar|orden de compra/.test(normalized)) return { kind: 'write_proposal', actionType: 'generate_purchase_order' };
    if (/inventario|alerta|existencia|faltante/.test(normalized)) return { kind: 'read', tool: 'inventory_alerts' };
    return { kind: 'read', tool: 'sales_summary' };
  }
}
