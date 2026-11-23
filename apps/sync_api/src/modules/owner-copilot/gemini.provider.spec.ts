import { GeminiOwnerCopilotProvider } from './gemini.provider';
import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';

describe('GeminiOwnerCopilotProvider', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('accepts only an allowlisted model plan and keeps the key in a server header', async () => {
    process.env.GEMINI_API_KEY = 'test-key-not-a-real-secret';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"kind":"read","tool":"inventory_alerts"}' }] } }] }),
    });
    global.fetch = fetchMock;
    const provider = new GeminiOwnerCopilotProvider(new LocalDemoOwnerCopilotProvider());

    await expect(provider.plan('¿Qué falta en inventario?')).resolves.toEqual({ kind: 'read', tool: 'inventory_alerts' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.objectContaining({
      headers: expect.objectContaining({ 'x-goog-api-key': 'test-key-not-a-real-secret' }),
    }));
  });
});
