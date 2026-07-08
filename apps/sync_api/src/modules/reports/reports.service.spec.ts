import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockDb: { select: jest.Mock };

  const makeQuery = (rows: unknown[]) => ({
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
    orderBy: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns collected sales and reconciliation exceptions for mismatched orders', async () => {
    const orders = [
      {
        id: 'paid-order',
        total: '116.00',
        subtotal: '100.00',
        discount: '0.00',
        tax: '16.00',
        createdAt: new Date('2026-07-01T14:00:00.000Z'),
        branchId: 'branch-1',
        branchName: 'Centro',
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        waiterRole: 'waiter',
      },
      {
        id: 'zero-total-order',
        total: '0.00',
        subtotal: '0.00',
        discount: '0.00',
        tax: '0.00',
        createdAt: new Date('2026-07-01T15:00:00.000Z'),
        branchId: 'branch-1',
        branchName: 'Centro',
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        waiterRole: 'waiter',
      },
      {
        id: 'unpaid-order',
        total: '80.00',
        subtotal: '80.00',
        discount: '0.00',
        tax: '0.00',
        createdAt: new Date('2026-07-01T16:00:00.000Z'),
        branchId: 'branch-1',
        branchName: 'Centro',
        waiterId: 'waiter-2',
        waiterName: 'Ana',
        waiterRole: 'waiter',
      },
    ];
    const items = [
      {
        orderId: 'paid-order',
        productId: 'product-1',
        productName: 'Cafe',
        sku: 'CAF-1',
        quantity: 2,
        price: '50.00',
        cost: '20.00',
      },
      {
        orderId: 'zero-total-order',
        productId: 'product-2',
        productName: 'Bagel',
        sku: 'BAG-1',
        quantity: 1,
        price: '90.00',
        cost: '30.00',
      },
      {
        orderId: 'unpaid-order',
        productId: 'product-3',
        productName: 'Jugo',
        sku: 'JUG-1',
        quantity: 1,
        price: '80.00',
        cost: '25.00',
      },
    ];
    const payments = [
      {
        orderId: 'paid-order',
        amount: '116.00',
        paymentMethod: 'card',
        createdAt: new Date('2026-07-01T14:05:00.000Z'),
      },
    ];

    mockDb.select
      .mockReturnValueOnce(makeQuery(orders))
      .mockReturnValueOnce(makeQuery(items))
      .mockReturnValueOnce(makeQuery(payments));

    const result = await service.getSalesDashboard(
      'business-1',
      '2026-07-01T00:00:00.000Z',
      '2026-07-02T00:00:00.000Z',
    );

    expect(result.totalSales).toBe(116);
    expect(result.averageTicket).toBe(116);
    expect(result.financial).toEqual(expect.objectContaining({
      netSales: 196,
      collectedSales: 116,
      ordersCount: 3,
      paidOrdersCount: 1,
      paymentMix: [
        {
          paymentMethod: 'card',
          total: 116,
          paymentsCount: 1,
          sharePercent: 100,
        },
      ],
    }));
    expect(result.reconciliation).toEqual(expect.objectContaining({
      status: 'warning',
      ordersTotal: 196,
      paymentsTotal: 116,
      itemsGrossTotal: 270,
      exceptionsCount: 2,
    }));
    expect(result.reconciliation.exceptions.map((exception) => exception.type)).toEqual([
      'zero_total_with_items',
      'missing_payment',
    ]);
  });

  it('calculates gross, net, and tax sales correctly for product report', async () => {
    const items = [
      {
        productId: 'product-1',
        productName: 'Chocolatín',
        sku: 'CHOCO-1',
        categoryName: 'Repostería',
        price: '65.00',
        quantity: 2,
      },
      {
        productId: 'product-2',
        productName: 'Café de Olla',
        sku: 'CAF-OLLA',
        categoryName: 'Bebidas Calientes',
        price: '45.00',
        quantity: 3,
      },
    ];

    mockDb.select.mockReturnValueOnce(makeQuery(items));

    const result = await service.getProductSalesReport({
      businessId: 'business-1',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });

    expect(result.length).toBe(2);

    const choco = result.find(r => r.productId === 'product-1');
    expect(choco).toBeDefined();
    expect(choco.quantitySold).toBe(2);
    expect(choco.averagePrice).toBe(65.00);
    expect(choco.grossSales).toBe(130.00);
    expect(choco.netSales).toBe(112.07);
    expect(choco.taxAmount).toBe(17.93);

    const cafe = result.find(r => r.productId === 'product-2');
    expect(cafe).toBeDefined();
    expect(cafe.quantitySold).toBe(3);
    expect(cafe.averagePrice).toBe(45.00);
    expect(cafe.grossSales).toBe(135.00);
    expect(cafe.netSales).toBe(116.38);
    expect(cafe.taxAmount).toBe(18.62);
  });

  it('calculates payment methods report totals and shares correctly', async () => {
    const payments = [
      {
        paymentMethod: 'cash',
        amount: '150.00',
      },
      {
        paymentMethod: 'card',
        amount: '350.00',
      },
      {
        paymentMethod: 'cash',
        amount: '100.00',
      },
    ];

    mockDb.select.mockReturnValueOnce(makeQuery(payments));

    const result = await service.getPaymentMethodsSalesReport({
      businessId: 'business-1',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });

    expect(result.length).toBe(2);
    
    const card = result.find(r => r.paymentMethod === 'card');
    expect(card).toBeDefined();
    expect(card.totalAmount).toBe(350.00);
    expect(card.paymentsCount).toBe(1);
    expect(card.sharePercent).toBe(58.33);

    const cash = result.find(r => r.paymentMethod === 'cash');
    expect(cash).toBeDefined();
    expect(cash.totalAmount).toBe(250.00);
    expect(cash.paymentsCount).toBe(2);
    expect(cash.sharePercent).toBe(41.67);
  });
});
