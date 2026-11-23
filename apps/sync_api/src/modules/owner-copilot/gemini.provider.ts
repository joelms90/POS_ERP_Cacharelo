import { Injectable } from '@nestjs/common';
import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';
import { OwnerCopilotPlan, OwnerCopilotProvider } from './owner-copilot.types';

const SYSTEM_INSTRUCTION = `Eres un clasificador de intenciones para un Copiloto de negocio.
Devuelve exclusivamente JSON válido, sin markdown. Solo se permite uno de:
{"kind":"read","tool":"inventory_alerts"}
{"kind":"read","tool":"sales_summary"}
{"kind":"write_proposal","actionType":"generate_purchase_order"}
No inventes herramientas, no ejecutes acciones y no incluyas secretos ni explicaciones.`;

/** Server-only Gemini adapter. It selects a plan; the API executes every tool itself. */
@Injectable()
export class GeminiOwnerCopilotProvider implements OwnerCopilotProvider {
  constructor(private readonly fallback: LocalDemoOwnerCopilotProvider) {}

  get isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async plan(prompt: string): Promise<OwnerCopilotPlan> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return this.fallback.plan(prompt);

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: prompt.slice(0, 4000) }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      return this.parsePlan(text);
    } catch {
      // Preserve local availability and never emit provider errors or keys to the browser.
      return this.fallback.plan(prompt);
    }
  }

  private parsePlan(text: string | undefined): OwnerCopilotPlan {
    try {
      const plan = JSON.parse(text || '') as OwnerCopilotPlan;
      if (plan.kind === 'read' && (plan.tool === 'inventory_alerts' || plan.tool === 'sales_summary')) return plan;
      if (plan.kind === 'write_proposal' && plan.actionType === 'generate_purchase_order') return plan;
    } catch {
      // Fall through to a safe non-tool response below.
    }
    return { kind: 'read', tool: 'sales_summary' };
  }
}
