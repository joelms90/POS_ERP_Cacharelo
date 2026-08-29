import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { CreatePrintJobDto } from '../dto/create-print-job.dto';
import { PrintStationHeartbeatDto } from '../dto/print-station-heartbeat.dto';

@Injectable()
export class PrintingRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async upsertStation(dto: PrintStationHeartbeatDto) {
    const now = new Date();
    // Delete stale entries for the same branchId + deviceName with a different stationId
    await this.db
      .delete(schema.printStations)
      .where(
        and(
          eq(schema.printStations.branchId, dto.branchId),
          eq(schema.printStations.deviceName, dto.deviceName),
          sql`${schema.printStations.stationId} != ${dto.stationId}`,
        ),
      );

    const [station] = await this.db
      .insert(schema.printStations)
      .values({
        stationId: dto.stationId,
        branchId: dto.branchId,
        deviceName: dto.deviceName,
        role: dto.role,
        operatorId: dto.operatorId || null,
        operatorName: dto.operatorName || null,
        printerName: dto.printerName,
        canPrintComandas: dto.canPrintComandas ?? true,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.printStations.stationId,
        set: {
          branchId: dto.branchId,
          deviceName: dto.deviceName,
          role: dto.role,
          operatorId: dto.operatorId || null,
          operatorName: dto.operatorName || null,
          printerName: dto.printerName,
          canPrintComandas: dto.canPrintComandas ?? true,
          lastSeenAt: now,
          updatedAt: now,
        },
      })
      .returning();
    return station;
  }

  async findEnabledStations(branchId: string) {
    return this.db
      .select()
      .from(schema.printStations)
      .where(
        and(
          eq(schema.printStations.branchId, branchId),
          eq(schema.printStations.canPrintComandas, true),
        ),
      )
      .orderBy(desc(schema.printStations.lastSeenAt));
  }

  async createPrintJob(dto: CreatePrintJobDto) {
    const createdAt = dto.createdAt ? new Date(dto.createdAt) : new Date();
    const [job] = await this.db
      .insert(schema.printJobs)
      .values({
        id: dto.id,
        branchId: dto.branchId,
        targetStationId: dto.targetStationId,
        sourceUserId: dto.sourceUserId || null,
        sourceUserName: dto.sourceUserName || null,
        title: dto.title,
        details: dto.details,
        target: dto.target,
        status: 'queued',
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.printJobs.id,
        set: {
          branchId: dto.branchId,
          targetStationId: dto.targetStationId,
          sourceUserId: dto.sourceUserId || null,
          sourceUserName: dto.sourceUserName || null,
          title: dto.title,
          details: dto.details,
          target: dto.target,
          updatedAt: new Date(),
        },
      })
      .returning();
    return job;
  }

  async findPrintJobs(query: {
    branchId: string;
    targetStationId?: string;
    status?: string;
    limit?: number;
  }) {
    const conditions = [eq(schema.printJobs.branchId, query.branchId)];
    if (query.targetStationId) {
      conditions.push(
        eq(schema.printJobs.targetStationId, query.targetStationId),
      );
    }
    if (query.status) {
      conditions.push(eq(schema.printJobs.status, query.status));
    }

    return this.db
      .select()
      .from(schema.printJobs)
      .where(and(...conditions))
      .orderBy(schema.printJobs.createdAt)
      .limit(query.limit ?? 50);
  }

  async findPrintJobById(id: string) {
    const rows = await this.db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async updatePrintJobStatus(
    id: string,
    status: 'queued' | 'printing' | 'printed' | 'failed',
    error?: string,
  ) {
    const now = new Date();
    const updates: Partial<typeof schema.printJobs.$inferInsert> = {
      status,
      error: error || null,
      updatedAt: now,
    };
    if (status === 'printed') updates.printedAt = now;
    if (status === 'failed') updates.failedAt = now;

    const [job] = await this.db
      .update(schema.printJobs)
      .set(updates)
      .where(eq(schema.printJobs.id, id))
      .returning();
    return job || null;
  }

  async deleteOldPrintedJobs(before: Date) {
    return this.db.execute(
      sql`DELETE FROM ${schema.printJobs} WHERE status IN ('printed', 'failed') AND updated_at < ${before}`,
    );
  }
}
