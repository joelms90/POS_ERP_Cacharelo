import { BadRequestException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { ReportsService } from '../reports/reports.service';
import { AlertsService } from '../inventory/alerts/alerts.service';
import { isGlobalOwner } from '../auth/business-access';
import { OWNER_COPILOT_PROVIDER, OWNER_COPILOT_READ_TOOLS, redact } from './owner-copilot.types';
import type { OwnerCopilotActor, OwnerCopilotProvider, OwnerCopilotReadTool } from './owner-copilot.types';

type Db = { insert: (table: unknown) => { values: (value: unknown) => { returning?: () => Promise<any[]>; then?: unknown } } };

@Injectable()
export class OwnerCopilotService {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: Db,
    private readonly reports: ReportsService,
    private readonly alerts: AlertsService,
    @Inject(OWNER_COPILOT_PROVIDER) private readonly provider: OwnerCopilotProvider,
  ) {}

  async chat(actor: OwnerCopilotActor, input: { prompt: string; businessId: string; branchId?: string; conversationId?: string }) {
    this.assertOwner(actor);
    if (!input.prompt?.trim()) throw new BadRequestException('El mensaje es obligatorio.');
    const conversationId = input.conversationId || randomUUID();
    const correlationId = randomUUID();
    await this.auditConversation(conversationId, actor, input.businessId, input.branchId, correlationId);
    await this.auditMessage(conversationId, 'user', input.prompt);
    const plan = await this.provider.plan(input.prompt);
    if (plan.kind === 'write_proposal') {
      const confirmation = await this.createConfirmation(conversationId, actor, input.businessId, input.branchId, plan.actionType);
      const isPriceChange = plan.actionType === 'update_product_price';
      const proposalSummary = isPriceChange
        ? 'Cambio de precio solicitado. Debes revisar el producto y el nuevo precio antes de confirmar.'
        : 'Generar orden de compra desde alertas activas.';
      const answer = 'Preparé una propuesta de acción. Revísala y confírmala explícitamente antes de cualquier cambio.';
      await this.auditMessage(conversationId, 'assistant', answer);
      return {
        conversationId,
        correlationId,
        provider: this.provider.name,
        answer,
        proposal: { actionType: plan.actionType, summary: proposalSummary },
        confirmation,
        message: {
          id: randomUUID(), role: 'assistant', content: answer, createdAt: new Date().toISOString(),
          actionProposal: {
            title: isPriceChange ? 'Cambiar precio' : 'Generar orden de compra', summary: proposalSummary,
            confirmationToken: confirmation.token, expiresAt: confirmation.expiresAt,
          },
        },
      };
    }
    const result = await this.runReadTool(plan.tool, input.businessId, input.branchId, conversationId);
    const answer = await this.provider.summarize(input.prompt, plan.tool, redact(result));
    await this.auditMessage(conversationId, 'assistant', answer);
    const source = { label: plan.tool === 'inventory_alerts' ? 'Alertas de inventario' : 'Resumen de ventas', href: plan.tool === 'inventory_alerts' ? '/inventory/alerts' : '/reports/sales-dashboard' };
    return {
      conversationId, correlationId, provider: this.provider.name, tool: plan.tool, result, sources: [source],
      message: {
        id: randomUUID(), role: 'assistant', content: answer, createdAt: new Date().toISOString(),
        toolRuns: [{ tool: plan.tool, status: 'completed', summary: `Consulta permitida: ${source.label}` }], sources: [source],
      },
    };
  }

  async confirm(actor: OwnerCopilotActor, input: { confirmationToken: string }) {
    this.assertOwner(actor);
    // The MVP intentionally has no write executor. A token is necessary but never sufficient.
    if (!input.confirmationToken) throw new BadRequestException('Se requiere el token de confirmación.');
    throw new ForbiddenException('Las acciones de escritura del Copiloto aún no están habilitadas.');
  }

  private assertOwner(actor: OwnerCopilotActor) {
    if (!actor?.sub || !isGlobalOwner(actor)) throw new ForbiddenException('Solo el propietario autenticado puede usar el Copiloto.');
  }

  private async runReadTool(tool: OwnerCopilotReadTool, businessId: string, branchId: string | undefined, conversationId: string) {
    if (!OWNER_COPILOT_READ_TOOLS.includes(tool)) throw new ForbiddenException('Herramienta no permitida.');
    await this.auditTool(conversationId, tool, { businessId, branchId }, 'running');
    try {
      const output = tool === 'sales_summary'
        ? await this.reports.getSalesDashboard(businessId, undefined, undefined, branchId)
        : await this.alerts.getSummary(businessId, { branchId });
      await this.auditTool(conversationId, tool, { businessId, branchId }, 'completed', output);
      return output;
    } catch (error) {
      await this.auditTool(conversationId, tool, { businessId, branchId }, 'failed', { error: error instanceof Error ? error.message : 'error' });
      throw error;
    }
  }

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private async createConfirmation(conversationId: string, actor: OwnerCopilotActor, businessId: string, branchId: string | undefined, actionType: string) {
    const token = randomUUID(); const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.safeInsert(schema.ownerCopilotConfirmations, { conversationId, ownerId: actor.sub, businessId, branchId, actionType, tokenHash: this.hash(token), payloadRedacted: {}, expiresAt });
    return { token, expiresAt: expiresAt.toISOString(), requiresExplicitConfirmation: true };
  }
  private auditConversation(id: string, actor: OwnerCopilotActor, businessId: string, branchId: string | undefined, correlationId: string) { return this.safeInsert(schema.ownerCopilotConversations, { id, ownerId: actor.sub, businessId, branchId, correlationId }); }
  private auditMessage(conversationId: string, role: string, content: string) { return this.safeInsert(schema.ownerCopilotMessages, { conversationId, role, redactedContent: String(redact(content)) }); }
  private auditTool(conversationId: string, toolName: string, input: unknown, status: string, output?: unknown) { return this.safeInsert(schema.ownerCopilotToolRuns, { conversationId, toolName, inputRedacted: redact(input), outputRedacted: output ? redact(output) : undefined, status }); }
  private async safeInsert(table: unknown, value: unknown) { try { const query = this.db?.insert?.(table)?.values(value); if (query && typeof (query as any).then === 'function') await query; else if ((query as any)?.returning) await (query as any).returning(); } catch { /* audit persistence must not expose or block owner reads */ } }
}
