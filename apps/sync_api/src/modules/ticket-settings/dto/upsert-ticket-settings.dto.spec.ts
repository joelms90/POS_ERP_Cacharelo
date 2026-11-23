import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertTicketSettingsDto } from './upsert-ticket-settings.dto';

const payload = {
  businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
  branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf04',
  sellerDisplayName: 'Cacharelo',
  legalName: 'Cacharelo S.A. de C.V.',
  fiscalId: 'CACX010101ABC',
  branchName: 'Punto de Venta Isla',
  branchAddress: 'Av. Principal 123',
  phone: '555-1234',
  receiptPrefix: 'EMP',
  taxMode: 'included',
  footerText: 'Gracias por su compra',
  isActive: true,
};

const validateDto = (value: Record<string, unknown>) =>
  validate(plainToInstance(UpsertTicketSettingsDto, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpsertTicketSettingsDto', () => {
  it('accepts the payload sent by the admin, including businessId and branchId', async () => {
    await expect(validateDto(payload)).resolves.toHaveLength(0);
  });

  it('accepts the business-wide configuration without branchId', async () => {
    await expect(
      validateDto({ ...payload, branchId: undefined }),
    ).resolves.toHaveLength(0);
  });

  it('rejects unknown properties', async () => {
    const errors = await validateDto({ ...payload, unexpected: true });
    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });

  it('rejects a missing businessId', async () => {
    const errors = await validateDto({ ...payload, businessId: undefined });
    expect(errors.some((error) => error.property === 'businessId')).toBe(true);
  });
});
