import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { SyncGateway } from '../sync/sync.gateway';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { PrintStationHeartbeatDto } from './dto/print-station-heartbeat.dto';
import { UpdatePrintJobStatusDto } from './dto/update-print-job-status.dto';
import { PrintingRepository } from './repositories/printing.repository';

@Injectable()
export class PrintingService {
  constructor(
    private readonly printingRepository: PrintingRepository,
    @Inject(forwardRef(() => SyncGateway))
    private readonly syncGateway: SyncGateway,
  ) {}

  async heartbeat(dto: PrintStationHeartbeatDto) {
    const station = await this.printingRepository.upsertStation(dto);
    this.broadcast(dto.branchId, 'printStations', dto.stationId);
    return this.withOnlineFlag(station);
  }

  async findOnlineStations(branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const stations =
      await this.printingRepository.findEnabledStations(branchId);
    return stations.map((station) => this.withOnlineFlag(station));
  }

  async createPrintJob(dto: CreatePrintJobDto) {
    const job = await this.printingRepository.createPrintJob(dto);
    this.broadcast(dto.branchId, 'printJobs', dto.id);
    return job;
  }

  async findPrintJobs(query: {
    branchId?: string;
    targetStationId?: string;
    status?: string;
    limit?: string;
  }) {
    if (!query.branchId) throw new BadRequestException('branchId is required');
    const parsedLimit = query.limit
      ? Number.parseInt(query.limit, 10)
      : undefined;
    return this.printingRepository.findPrintJobs({
      branchId: query.branchId,
      targetStationId: query.targetStationId,
      status: query.status,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  async updatePrintJobStatus(id: string, dto: UpdatePrintJobStatusDto) {
    const existing = await this.printingRepository.findPrintJobById(id);
    if (!existing) {
      throw new NotFoundException(`Print job with ID ${id} not found.`);
    }
    const job = await this.printingRepository.updatePrintJobStatus(
      id,
      dto.status,
      dto.error,
    );
    this.broadcast(existing.branchId, 'printJobs', id);
    return job;
  }

  private withOnlineFlag(station: any) {
    const lastSeenAt = new Date(station.lastSeenAt);
    const lastSeenMsAgo = Date.now() - lastSeenAt.getTime();
    const online = lastSeenMsAgo < 120_000;
    const recentlySeen = lastSeenMsAgo < 24 * 60 * 60_000;
    return {
      stationId: station.stationId,
      branchId: station.branchId,
      deviceName: station.deviceName,
      role: station.role,
      operatorId: station.operatorId,
      operatorName: station.operatorName,
      printerName: station.printerName,
      canPrintComandas: station.canPrintComandas,
      lastSeenAt: station.lastSeenAt,
      online,
      recentlySeen,
      presenceStatus: online ? 'online' : recentlySeen ? 'recent' : 'offline',
      lastSeenSecondsAgo: Math.max(0, Math.floor(lastSeenMsAgo / 1000)),
    };
  }

  private broadcast(
    branchId: string,
    entity: 'printStations' | 'printJobs',
    entityId?: string,
  ) {
    this.syncGateway.broadcastChange(branchId, {
      tipo: 'cambio',
      changes: [{ entity, entityId }],
    });
  }
}
