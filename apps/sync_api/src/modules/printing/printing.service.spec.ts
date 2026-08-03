import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrintingService } from './printing.service';

const branchId = 'c4f07384-d113-4a0e-a555-e5b12824bf02';

function createService() {
  const repository = {
    upsertStation: jest.fn(),
    findEnabledStations: jest.fn(),
    createPrintJob: jest.fn(),
    findPrintJobs: jest.fn(),
    findPrintJobById: jest.fn(),
    updatePrintJobStatus: jest.fn(),
  };
  const gateway = {
    broadcastChange: jest.fn(),
  };

  const service = new PrintingService(repository as any, gateway as any);
  return { service, repository, gateway };
}

describe('PrintingService', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('upserts station heartbeat and broadcasts printStations changes', async () => {
    const { service, repository, gateway } = createService();
    const lastSeenAt = new Date();
    repository.upsertStation.mockResolvedValue({
      stationId: 'station-1',
      branchId,
      deviceName: 'Caja Principal',
      role: 'cashier',
      operatorId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
      operatorName: 'Carlos',
      printerName: 'EPSON TM-T20',
      canPrintComandas: true,
      lastSeenAt,
    });

    const result = await service.heartbeat({
      stationId: 'station-1',
      branchId,
      deviceName: 'Caja Principal',
      role: 'cashier',
      operatorName: 'Carlos',
      printerName: 'EPSON TM-T20',
      canPrintComandas: true,
    });

    expect(repository.upsertStation).toHaveBeenCalledWith(
      expect.objectContaining({ stationId: 'station-1' }),
    );
    expect(gateway.broadcastChange).toHaveBeenCalledWith(branchId, {
      tipo: 'cambio',
      changes: [{ entity: 'printStations', entityId: 'station-1' }],
    });
    expect(result).toMatchObject({ stationId: 'station-1', online: true });
  });

  it('lists enabled stations with presence status', async () => {
    const { service, repository } = createService();
    repository.findEnabledStations.mockResolvedValue([
      {
        stationId: 'station-1',
        branchId,
        deviceName: 'Caja Principal',
        role: 'cashier',
        printerName: 'EPSON TM-T20',
        canPrintComandas: true,
        lastSeenAt: new Date(),
      },
    ]);

    const result = await service.findOnlineStations(branchId);

    expect(repository.findEnabledStations).toHaveBeenCalledWith(branchId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      stationId: 'station-1',
      online: true,
      presenceStatus: 'online',
    });
  });

  it('rejects station list without branchId', async () => {
    const { service } = createService();
    await expect(service.findOnlineStations('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a queued print job and broadcasts printJobs changes', async () => {
    const { service, repository, gateway } = createService();
    repository.createPrintJob.mockResolvedValue({
      id: 'job-1',
      branchId,
      targetStationId: 'station-1',
      status: 'queued',
    });

    const result = await service.createPrintJob({
      id: 'job-1',
      branchId,
      targetStationId: 'station-1',
      title: 'Comanda Cocina - Mesa 1',
      details: '1x Lasagna',
      target: 'Cocina',
    });

    expect(result).toMatchObject({ id: 'job-1', status: 'queued' });
    expect(gateway.broadcastChange).toHaveBeenCalledWith(branchId, {
      tipo: 'cambio',
      changes: [{ entity: 'printJobs', entityId: 'job-1' }],
    });
  });

  it('updates print job status and broadcasts changes', async () => {
    const { service, repository, gateway } = createService();
    repository.findPrintJobById.mockResolvedValue({ id: 'job-1', branchId });
    repository.updatePrintJobStatus.mockResolvedValue({
      id: 'job-1',
      status: 'printed',
    });

    const result = await service.updatePrintJobStatus('job-1', {
      status: 'printed',
    });

    expect(repository.updatePrintJobStatus).toHaveBeenCalledWith(
      'job-1',
      'printed',
      undefined,
    );
    expect(gateway.broadcastChange).toHaveBeenCalledWith(branchId, {
      tipo: 'cambio',
      changes: [{ entity: 'printJobs', entityId: 'job-1' }],
    });
    expect(result).toMatchObject({ id: 'job-1', status: 'printed' });
  });

  it('throws NotFoundException when updating a missing print job', async () => {
    const { service, repository } = createService();
    repository.findPrintJobById.mockResolvedValue(null);

    await expect(
      service.updatePrintJobStatus('missing', { status: 'failed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
