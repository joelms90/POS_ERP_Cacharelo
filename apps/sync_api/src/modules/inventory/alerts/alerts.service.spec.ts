import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { ThresholdsService } from '../thresholds/thresholds.service';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';

describe('AlertsService - Warehouse Support', () => {
  let service: AlertsService;
  let mockDb: any;
  let mockThresholdsService: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      groupBy: jest.fn(),
      orderBy: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      values: jest.fn(),
      set: jest.fn(),
      transaction: jest.fn(),
      execute: jest.fn(),
    };

    mockThresholdsService = {
      getEffectiveThreshold: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: ThresholdsService, useValue: mockThresholdsService },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should classify warehouse alerts with locationType warehouse and return warehouse summary', async () => {
    // Mock runAlertEngine (executeAlertEngine) returning 0
    jest.spyOn(service as any, 'executeAlertEngine').mockResolvedValue({
      processed: 1,
      created: 0,
      updated: 0,
      resolved: 0,
    });

    const mockAlerts = [
      {
        id: 'alert-1',
        productId: 'prod-1',
        branchId: null,
        warehouseId: 'wh-1',
        alertType: 'low_stock',
        threshold: '10.000',
        currentQty: '1.000',
        status: 'active',
        createdAt: new Date(),
        resolvedAt: null,
        productName: 'Toalla Interdoblada',
        productSku: '912',
        itemType: 'raw_material',
        providerId: 'prov-1',
        branchName: null,
        warehouseName: 'Almacén Cafetería',
      },
    ];

    jest.spyOn(service, 'list').mockResolvedValue([
      {
        ...mockAlerts[0],
        locationType: 'warehouse',
        locationName: 'Almacén Cafetería',
        hasProvider: true,
        transferableQty: null,
      },
    ]);

    jest.spyOn(service as any, 'countPendingRequisitions').mockResolvedValue(0);
    jest.spyOn(service as any, 'countDraftPos').mockResolvedValue(1);

    const summary = await service.getSummary('biz-1');

    expect(summary.summary.totalAlerts).toBe(1);
    expect(summary.summary.warehouseAlerts).toBe(1);
    expect(summary.summary.branchAlerts).toBe(0);
    expect(summary.summary.lowStock).toBe(1);
    expect(summary.alerts[0].locationType).toBe('warehouse');
    expect(summary.alerts[0].warehouseName).toBe('Almacén Cafetería');
  });
});
