import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.mock('pg', () => {
  const mClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return { Client: jest.fn(() => mClient), Pool: jest.fn(() => ({ on: jest.fn(), end: jest.fn().mockResolvedValue(undefined) })) };
});
import { DRIZZLE_CONNECTION } from '../src/database/database.module';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';

import { WsAdapter } from '@nestjs/platform-ws';

describe('Purchase Orders & Requisitions Workflow E2E Validation', () => {
  let app: INestApplication<App>;
  let mockDbCount = 0;
  let mockDbRows: any[] = [];

  const mockDb = {
    transaction: jest.fn(async (cb) => cb(mockDb)),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
    then: function(onFulfilled: any, onRejected: any) {
      mockDbCount++;
      const res = mockDbRows[mockDbCount - 1] || [];
      return Promise.resolve(res).then(onFulfilled, onRejected);
    },
  };

  beforeEach(async () => {
    mockDbCount = 0;
    mockDbRows = [];
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(DRIZZLE_CONNECTION)
      .useValue(mockDb)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Purchase Orders API Flow', () => {
    it('1. Create a Purchase Order (POST /purchase-orders)', async () => {
      mockDbRows = [
        [{ id: 'po-uuid-1', status: 'pending', notes: 'First PO order' }], // Insert PO returning
        [{ id: 'item-uuid-1', quantityOrdered: 100 }], // Insert Items returning
      ];

      const res = await request(app.getHttpServer())
        .post('/purchase-orders')
        .send({
          businessId: 'bus-uuid-1',
          providerId: 'prov-uuid-1',
          warehouseId: 'wh-uuid-1',
          items: [
            { productId: 'prod-uuid-1', quantityOrdered: 100, unitCostEstimated: 10.50 }
          ],
          notes: 'First PO order',
          createdBy: 'user-uuid-1',
        })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.id).toEqual('po-uuid-1');
      expect(res.body.status).toEqual('pending');
    });

    it('2. Transition status to Sent (POST /purchase-orders/:id/send)', async () => {
      mockDbRows = [
        [{ id: 'po-uuid-1', status: 'sent' }], // Update PO status returning
      ];

      const res = await request(app.getHttpServer())
        .post('/purchase-orders/po-uuid-1/send')
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.status).toEqual('sent');
    });

    it('3. Record Reception & Average Cost Recalculation (POST /purchase-orders/:id/receive)', async () => {
      mockDbRows = [
        // 1. Find PO details
        [{ id: 'po-uuid-1', status: 'sent', warehouseId: 'wh-uuid-1' }],
        // 2. Find PO items
        [{ id: 'item-uuid-1', productId: 'prod-uuid-1', quantityOrdered: 100, unitCostEstimated: 10.50 }],
        // 3. Find Product current details (e.g. Current Stock = 50, Current Cost = $10.00)
        [{ id: 'prod-uuid-1', cost: '10.00', isIngredient: true }],
        // 4. Update Product cost to new Weighted Average Cost: $11.00
        [{ id: 'prod-uuid-1', cost: '11.00' }],
        // 5. Find stock level in destination warehouse before update (Stock = 50)
        [{ id: 'stock-uuid-1', quantity: 50 }],
        // 6. Update destination stock level (50 + 50 received = 100)
        [{ id: 'stock-uuid-1', quantity: 100 }],
        // 7. Insert inventory movement log of type 'receipt'
        [{ id: 'movement-uuid-1', type: 'receipt', quantity: 50 }],
        // 8. Update PO status to 'received' or 'partially_received'
        [{ id: 'po-uuid-1', status: 'received' }],
        // 9. Update actuals on PO items
        [{ id: 'item-uuid-1', quantityReceived: 50, unitCostActual: '12.00' }],
      ];

      const res = await request(app.getHttpServer())
        .post('/purchase-orders/po-uuid-1/receive')
        .send({
          items: [
            { productId: 'prod-uuid-1', quantityReceived: 50, unitCostActual: 12.00 }
          ]
        })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.status).toEqual('received');
    });
  });

  describe('Requisitions API Flow', () => {
    it('1. Create Requisition (POST /requisitions)', async () => {
      mockDbRows = [
        [{ id: 'req-uuid-1', status: 'pending_approval' }], // Insert Requisition returning
        [{ id: 'req-item-uuid-1', quantityRequested: 20 }], // Insert items returning
      ];

      const res = await request(app.getHttpServer())
        .post('/requisitions')
        .send({
          businessId: 'bus-uuid-1',
          fromBranchId: 'branch-uuid-1',
          toWarehouseId: 'wh-uuid-1',
          items: [
            { productId: 'prod-uuid-1', quantityRequested: 20 }
          ],
          createdBy: 'user-uuid-1',
        })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.status).toEqual('pending_approval');
    });

    it('2. Approve Requisition (PATCH /requisitions/:id/status)', async () => {
      mockDbRows = [
        // 1. Transaction select: requisition details
        [{ id: 'req-uuid-1', businessId: 'bus-uuid-1', fromBranchId: 'branch-uuid-1', toWarehouseId: 'wh-uuid-1', status: 'pending_approval' }],
        // 2. Transaction select: requisition items
        [{ id: 'req-item-uuid-1', productId: 'prod-uuid-1', quantityRequested: 20 }],
        // 3. Update Requisition status to 'approved'
        [{ id: 'req-uuid-1', status: 'approved' }],
        // 4. Insert pending stock transfer
        [{ id: 'transfer-uuid-1', status: 'pending' }],
        // 5. Select product average cost for transfer item
        [{ id: 'prod-uuid-1', cost: '11.00' }],
        // 6. Insert stock transfer item
        [{ id: 'transfer-item-uuid-1', quantity: 20, unitCost: '11.00' }],
      ];

      const res = await request(app.getHttpServer())
        .patch('/requisitions/req-uuid-1/status')
        .send({
          status: 'approved',
          notes: 'Approval notes',
        })
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body.status).toEqual('approved');
    });
  });
});
