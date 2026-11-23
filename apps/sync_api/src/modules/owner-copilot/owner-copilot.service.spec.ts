import { ForbiddenException } from '@nestjs/common';
import { OwnerCopilotService } from './owner-copilot.service';
import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';
import { redact } from './owner-copilot.types';

describe('OwnerCopilotService safety', () => {
  const insert = jest.fn(() => ({ values: jest.fn(() => Promise.resolve()) }));
  const reports = { getSalesDashboard: jest.fn().mockResolvedValue({ total: 12 }) };
  const alerts = { getSummary: jest.fn().mockResolvedValue({ active: 2 }) };
  const service = new OwnerCopilotService({ insert } as any, reports as any, alerts as any, new LocalDemoOwnerCopilotProvider());
  const owner = { sub: '00000000-0000-4000-8000-000000000001', roles: ['owner'] };
  beforeEach(() => jest.clearAllMocks());

  it('allows only typed read tools selected by the provider', async () => {
    const reply = await service.chat(owner, { prompt: 'Muéstrame ventas', businessId: '00000000-0000-4000-8000-000000000002' });
    expect(reply.tool).toBe('sales_summary');
    expect(reports.getSalesDashboard).toHaveBeenCalled();
    await expect((service as any).runReadTool('call_backend_api', 'b', undefined, 'c')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never performs a write when a proposal is confirmed in the MVP', async () => {
    const proposal = await service.chat(owner, { prompt: 'Genera una orden de compra', businessId: '00000000-0000-4000-8000-000000000002' });
    expect(proposal.confirmation.requiresExplicitConfirmation).toBe(true);
    expect(new Date(proposal.confirmation.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await expect(service.confirm(owner, { confirmationToken: proposal.confirmation.token })).rejects.toBeInstanceOf(ForbiddenException);
    expect(alerts.getSummary).not.toHaveBeenCalled();
  });

  it('redacts secrets before audit persistence', () => {
    expect(redact({ authorization: 'Bearer should-not-persist', note: 'token=abc' })).toEqual({ authorization: '[REDACTED]', note: 'token=[REDACTED]' });
  });
});
