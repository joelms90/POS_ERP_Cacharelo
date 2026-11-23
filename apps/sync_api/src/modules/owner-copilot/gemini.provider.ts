import { Injectable } from '@nestjs/common';
import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';
import { OwnerCopilotPlan, OwnerCopilotProvider, OwnerCopilotReadTool } from './owner-copilot.types';

const SYSTEM_INSTRUCTION = `Eres un clasificador de intenciones para un Copiloto de negocio.
Devuelve exclusivamente JSON válido, sin markdown. Solo se permite uno de:
{"kind":"read","tool":"inventory_alerts"}
{"kind":"read","tool":"sales_summary"}
{"kind":"write_proposal","actionType":"generate_purchase_order"}
{"kind":"write_proposal","actionType":"update_product_price"}
No inventes herramientas, no ejecutes acciones y no incluyas secretos ni explicaciones.`;

/** Server-only Gemini adapter. It selects a plan; the API executes every tool itself. */
@Injectable()
export class GeminiOwnerCopilotProvider implements OwnerCopilotProvider {
  constructor(private readonly fallback: LocalDemoOwnerCopilotProvider) {}
  readonly name = 'gemini' as const;

  get isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async plan(prompt: string): Promise<OwnerCopilotPlan> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return this.fallback.plan(prompt);

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const text = await this.generate(prompt.slice(0, 4000), SYSTEM_INSTRUCTION, true);
      return this.parsePlan(text);
    } catch {
      // Preserve local availability and never emit provider errors or keys to the browser.
      return this.fallback.plan(prompt);
    }
  }

  async summarize(prompt: string, tool: OwnerCopilotReadTool, result: unknown): Promise<string> {
    if (!process.env.GEMINI_API_KEY) return this.fallback.summarize(prompt, tool, result);
    const safeResult = JSON.stringify(result).slice(0, 12_000);
    const instruction = 'Responde en español en máximo 4 oraciones. Resume solo los datos proporcionados; no inventes cifras, no sugieras ejecutar acciones y no expongas secretos.';
    try {
      return await this.generate(`Pregunta: ${prompt}\nHerramienta: ${tool}\nDatos permitidos: ${safeResult}`, instruction, false);
    } catch {
      return this.fallback.summarize(prompt, tool, result);
    }
  }

  private async generate(prompt: string, instruction: string, json: boolean): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey! },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, ...(json ? { responseMimeType: 'application/json' } : {}) } }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  private parsePlan(text: string | undefined): OwnerCopilotPlan {
    try {
      const plan = JSON.parse(text || '') as OwnerCopilotPlan;
      if (plan.kind === 'read' && (plan.tool === 'inventory_alerts' || plan.tool === 'sales_summary')) return plan;
      if (plan.kind === 'write_proposal' && (plan.actionType === 'generate_purchase_order' || plan.actionType === 'update_product_price')) return plan;
    } catch {
      // Fall through to a safe non-tool response below.
    }
    return { kind: 'read', tool: 'sales_summary' };
  }
}
