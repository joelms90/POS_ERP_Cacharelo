import { Injectable } from '@nestjs/common';
import { OwnerCopilotPlan, OwnerCopilotProvider, OwnerCopilotReadTool } from './owner-copilot.types';

/** Deterministic development provider; production adapters must stay server-side. */
@Injectable()
export class LocalDemoOwnerCopilotProvider implements OwnerCopilotProvider {
  readonly name = 'local' as const;
  async plan(prompt: string): Promise<OwnerCopilotPlan> {
    const normalized = prompt.toLocaleLowerCase('es-MX');
    if (/precio|prescio|coste|costo/.test(normalized)) return { kind: 'write_proposal', actionType: 'update_product_price' };
    if (/crear|generar|comprar|orden de compra/.test(normalized)) return { kind: 'write_proposal', actionType: 'generate_purchase_order' };
    if (/inventario|alerta|existencia|faltante/.test(normalized)) return { kind: 'read', tool: 'inventory_alerts' };
    return { kind: 'read', tool: 'sales_summary' };
  }

  async summarize(_prompt: string, tool: OwnerCopilotReadTool, result: unknown): Promise<string> {
    const count = Array.isArray(result) ? result.length : undefined;
    if (tool === 'inventory_alerts') return count === undefined ? 'Estas son las alertas de inventario activas.' : `Encontré ${count} alertas de inventario activas.`;
    return 'Este es el resumen de ventas solicitado.';
  }
}
