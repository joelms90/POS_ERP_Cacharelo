import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';

const FIXTURES = [
  { prompt: '¿Qué alertas de inventario tengo?', expected: { kind: 'read', tool: 'inventory_alerts' } },
  { prompt: 'Muéstrame las ventas de hoy', expected: { kind: 'read', tool: 'sales_summary' } },
  { prompt: 'Genera una orden de compra', expected: { kind: 'write_proposal', actionType: 'generate_purchase_order' } },
] as const;

describe('OwnerCopilot deterministic evaluation fixture', () => {
  const provider = new LocalDemoOwnerCopilotProvider();

  it.each(FIXTURES)('selects only the expected safe plan for $prompt', ({ prompt, expected }) => {
    expect(provider.plan(prompt)).toEqual(expected);
  });
});
