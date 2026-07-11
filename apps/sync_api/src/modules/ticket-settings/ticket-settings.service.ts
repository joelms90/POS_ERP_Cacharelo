import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { UpsertTicketSettingsDto } from './dto/upsert-ticket-settings.dto';

@Injectable()
export class TicketSettingsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findActiveOrDefault(businessId?: string, branchId?: string) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }

    if (branchId) {
      const branchRows = await this.db
        .select()
        .from(schema.ticketFiscalConfigurations)
        .where(
          and(
            eq(schema.ticketFiscalConfigurations.businessId, businessId),
            eq(schema.ticketFiscalConfigurations.branchId, branchId),
            eq(schema.ticketFiscalConfigurations.isActive, true),
          ),
        )
        .limit(1);

      if (branchRows.length > 0) return branchRows[0];
    }

    const businessRows = await this.db
      .select()
      .from(schema.ticketFiscalConfigurations)
      .where(
        and(
          eq(schema.ticketFiscalConfigurations.businessId, businessId),
          isNull(schema.ticketFiscalConfigurations.branchId),
          eq(schema.ticketFiscalConfigurations.isActive, true),
        ),
      )
      .limit(1);

    if (businessRows.length > 0) return businessRows[0];

    return this.mockDefault(businessId, branchId);
  }

  async upsert(dto: UpsertTicketSettingsDto) {
    this.validate(dto);

    const normalized = {
      businessId: dto.businessId,
      branchId: dto.branchId || null,
      sellerDisplayName: dto.sellerDisplayName.trim(),
      legalName: dto.legalName.trim(),
      fiscalId: dto.fiscalId.trim().toUpperCase(),
      branchName: dto.branchName.trim(),
      branchAddress: dto.branchAddress.trim(),
      phone: dto.phone?.trim() || null,
      receiptPrefix: dto.receiptPrefix.trim().toUpperCase(),
      taxMode: dto.taxMode || 'breakdown',
      footerText: dto.footerText?.trim() || null,
      isActive: dto.isActive ?? true,
    };

    const existing = await this.db
      .select()
      .from(schema.ticketFiscalConfigurations)
      .where(
        normalized.branchId
          ? and(
              eq(schema.ticketFiscalConfigurations.businessId, normalized.businessId),
              eq(schema.ticketFiscalConfigurations.branchId, normalized.branchId),
            )
          : and(
              eq(schema.ticketFiscalConfigurations.businessId, normalized.businessId),
              isNull(schema.ticketFiscalConfigurations.branchId),
            ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(schema.ticketFiscalConfigurations)
        .set({
          ...normalized,
          updatedAt: new Date(),
          version: sql`${schema.ticketFiscalConfigurations.version} + 1`,
        })
        .where(eq(schema.ticketFiscalConfigurations.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(schema.ticketFiscalConfigurations)
      .values({ ...normalized, version: 1 })
      .returning();

    return created;
  }

  private validate(dto: UpsertTicketSettingsDto) {
    const missing = [
      ['businessId', dto.businessId],
      ['sellerDisplayName', dto.sellerDisplayName],
      ['legalName', dto.legalName],
      ['fiscalId', dto.fiscalId],
      ['branchName', dto.branchName],
      ['branchAddress', dto.branchAddress],
      ['receiptPrefix', dto.receiptPrefix],
    ].filter(([, value]) => !String(value || '').trim());

    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan campos obligatorios: ${missing.map(([field]) => field).join(', ')}`,
      );
    }
  }

  private mockDefault(businessId: string, branchId?: string) {
    return {
      id: 'mock-ticket-config',
      businessId,
      branchId: branchId || null,
      sellerDisplayName: 'Cafeteria Cacharelo',
      legalName: 'Cafeteria Cacharelo S.A. de C.V.',
      fiscalId: 'CACX010101ABC',
      branchName: 'Sucursal Demo',
      branchAddress: 'Av. Principal 123, Centro, Mexico',
      phone: '555-1234',
      receiptPrefix: 'CCH',
      taxMode: 'breakdown',
      footerText:
        'Comprobante de compra. IVA incluido en precios al publico.\ncacharelo.com',
      isActive: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
