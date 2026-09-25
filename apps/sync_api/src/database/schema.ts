import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  decimal,
  text,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
  bigserial,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================================
// 1. Tenants & Catalog Entities
// ==========================================

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  taxId: varchar('tax_id', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  roomConfigs: text('room_configs'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const ticketFiscalConfigurations = pgTable(
  'ticket_fiscal_configurations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    branchId: uuid('branch_id').references(() => branches.id),
    sellerDisplayName: varchar('seller_display_name', {
      length: 120,
    }).notNull(),
    legalName: varchar('legal_name', { length: 180 }).notNull(),
    fiscalId: varchar('fiscal_id', { length: 50 }).notNull(),
    branchName: varchar('branch_name', { length: 120 }).notNull(),
    branchAddress: text('branch_address').notNull(),
    phone: varchar('phone', { length: 30 }),
    receiptPrefix: varchar('receipt_prefix', { length: 20 })
      .default('CCH')
      .notNull(),
    taxMode: varchar('tax_mode', { length: 20 }).default('breakdown').notNull(),
    footerText: text('footer_text'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer('version').default(1).notNull(),
  },
);

export const branchTables = pgTable('branch_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  label: varchar('label', { length: 50 }).notNull(), // e.g. "Mesa 1"
  capacity: integer('capacity').default(4).notNull(),
  room: varchar('room', { length: 50 }).default('General').notNull(), // e.g. "Terraza", "Salon"
  state: varchar('state', { length: 20 }).default('free').notNull(), // free, occupied, billing, cleaning
  x: doublePrecision('x'),
  y: doublePrecision('y'),
  shape: varchar('shape', { length: 20 }).default('square').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 2. Operators & Authentication
// ==========================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id), // Nullable for system-wide admins
  branchId: uuid('branch_id').references(() => branches.id),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  pin: varchar('pin', { length: 255 }).notNull(), // Checked for uniqueness per business
  role: varchar('role', { length: 20 }).notNull(), // waiter, cashier, kitchen, admin
  roles: jsonb('roles').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const adminBusinessAccess = pgTable('admin_business_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  role: varchar('role', { length: 20 }).notNull(), // owner, inventory_admin
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceUuid: varchar('device_uuid', { length: 255 }).unique().notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "Tablet Mesero 1"
  role: varchar('role', { length: 20 }).notNull(), // ordering, kds, cashier
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 3. Products & Menu Catalog
// ==========================================

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  targetStation: varchar('target_station', { length: 20 }).default('cocina'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  categoryId: uuid('category_id')
    .references(() => categories.id)
    .notNull(),
  providerId: uuid('provider_id').references(() => providers.id),
  name: varchar('name', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  internalCode: varchar('internal_code', { length: 50 }),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0.00').notNull(),
  price: decimal('price', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  priceWholesale: decimal('price_wholesale', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  minStock: decimal('min_stock', { precision: 12, scale: 3 })
    .default('0.000')
    .notNull(),
  maxStock: decimal('max_stock', { precision: 12, scale: 3 })
    .default('0.000')
    .notNull(),
  saleType: varchar('sale_type', { length: 20 }).default('pieza').notNull(),
  itemType: varchar('item_type', { length: 20 }).default('finished_good').notNull(), // raw_material | wip | finished_good | service
  productionStrategy: varchar('production_strategy', { length: 20 })
    .default('none')
    .notNull(), // none | backflush | work_order
  uom: varchar('uom', { length: 10 }).default('piece').notNull(), // piece | kg | g | l | ml
  isSellable: boolean('is_sellable').default(true).notNull(),
  isIngredient: boolean('is_ingredient').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 4. POS Order Workflow & Shifts
// ==========================================

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientUuid: varchar('client_uuid', { length: 120 }),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  tableId: uuid('table_id')
    .references(() => branchTables.id)
    .notNull(),
  waiterId: uuid('waiter_id')
    .references(() => users.id)
    .notNull(),
  state: varchar('state', { length: 20 }).default('open').notNull(), // open, billing, closed, cancelled
  subtotal: decimal('subtotal', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  discount: decimal('discount', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  cancellationReason: text('cancellation_reason'),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientUuid: varchar('client_uuid', { length: 120 }),
  orderId: uuid('order_id')
    .references(() => orders.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: integer('quantity').default(1).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  assignedGuest: integer('assigned_guest').default(1).notNull(),
  isSent: boolean('is_sent').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .references(() => orders.id)
    .notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(), // cash, card
  referenceCode: varchar('reference_code', { length: 50 }), // "Visa - **** 1234"
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cashShifts = pgTable('cash_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cashierId: uuid('cashier_id')
    .references(() => users.id)
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  initialFloat: decimal('initial_float', { precision: 10, scale: 2 }).notNull(),
  cashDrawerAmount: decimal('cash_drawer_amount', {
    precision: 10,
    scale: 2,
  }).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, closed
  openedAt: timestamp('opened_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  denominationCounts: jsonb('denomination_counts'),
  closeNotes: text('close_notes'),
  closeSnapshot: jsonb('close_snapshot'),
  version: integer('version').default(1).notNull(),
});

export const cashTransactions = pgTable('cash_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id')
    .references(() => cashShifts.id)
    .notNull(),
  type: varchar('type', { length: 20 }).notNull(), // cash-in, cash-out
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const deviceSyncCheckpoints = pgTable('device_sync_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const kitchenTickets = pgTable('kitchen_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .references(() => orders.id)
    .notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, preparing, ready, served
  station: varchar('station', { length: 50 }).notNull(), // cocina, barra
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  servedAt: timestamp('served_at', { withTimezone: true }),
});

export const printStations = pgTable(
  'print_stations',
  {
    stationId: varchar('station_id', { length: 120 }).primaryKey(),
    branchId: uuid('branch_id')
      .references(() => branches.id)
      .notNull(),
    deviceName: varchar('device_name', { length: 120 }).notNull(),
    role: varchar('role', { length: 30 }).notNull(),
    operatorId: uuid('operator_id').references(() => users.id),
    operatorName: varchar('operator_name', { length: 120 }),
    printerName: varchar('printer_name', { length: 180 }).notNull(),
    canPrintComandas: boolean('can_print_comandas').default(true).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    branchIdx: index('print_stations_branch_idx').on(table.branchId),
    lastSeenIdx: index('print_stations_last_seen_idx').on(table.lastSeenAt),
  }),
);

export const printJobs = pgTable(
  'print_jobs',
  {
    id: varchar('id', { length: 120 }).primaryKey(),
    branchId: uuid('branch_id')
      .references(() => branches.id)
      .notNull(),
    targetStationId: varchar('target_station_id', { length: 120 }).notNull(),
    sourceUserId: uuid('source_user_id').references(() => users.id),
    sourceUserName: varchar('source_user_name', { length: 120 }),
    title: varchar('title', { length: 180 }).notNull(),
    details: text('details').notNull(),
    target: varchar('target', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).default('queued').notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    printedAt: timestamp('printed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
  },
  (table) => ({
    branchIdx: index('print_jobs_branch_idx').on(table.branchId),
    stationStatusIdx: index('print_jobs_station_status_idx').on(
      table.targetStationId,
      table.status,
    ),
    createdAtIdx: index('print_jobs_created_at_idx').on(table.createdAt),
  }),
);

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 30 }),
  address: text('address'),
  locationType: varchar('location_type', { length: 30 }).default('warehouse').notNull(), // 'warehouse' | 'factory' | 'transit'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const stockLevels = pgTable('stock_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  quantity: decimal('quantity', { precision: 12, scale: 3 })
    .default('0.000')
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentProductId: uuid('parent_product_id')
    .references(() => products.id)
    .notNull(),
  ingredientProductId: uuid('ingredient_product_id')
    .references(() => products.id)
    .notNull(),
  quantityNeeded: decimal('quantity_needed', {
    precision: 12,
    scale: 3,
  }).notNull(),
  wastePercent: decimal('waste_percent', { precision: 5, scale: 2 })
    .default('0.00')
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const inventoryReceipts = pgTable('inventory_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  providerId: uuid('provider_id')
    .references(() => providers.id)
    .notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  documentNumber: varchar('document_number', { length: 50 }),
  receivedAt: timestamp('received_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const inventoryReceiptItems = pgTable('inventory_receipt_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptId: uuid('receipt_id')
    .references(() => inventoryReceipts.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
});

export const productionRuns = pgTable('production_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id')
    .references(() => warehouses.id)
    .notNull(),
  destinationWarehouseId: uuid('destination_warehouse_id')
    .references(() => warehouses.id),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantityProduced: decimal('quantity_produced', {
    precision: 12,
    scale: 3,
  }).notNull(),
  actualQuantityProduced: decimal('actual_quantity_produced', {
    precision: 12,
    scale: 3,
  }),
  status: varchar('status', { length: 20 }).default('completed').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  assembledAt: timestamp('assembled_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  fromWarehouseId: uuid('from_warehouse_id').references(() => warehouses.id),
  fromBranchId: uuid('from_branch_id').references(() => branches.id),
  toWarehouseId: uuid('to_warehouse_id').references(() => warehouses.id),
  toBranchId: uuid('to_branch_id').references(() => branches.id),
  transferredAt: timestamp('transferred_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: varchar('status', { length: 20 }).default('completed').notNull(),
  notes: text('notes'),
  receivedBy: uuid('received_by').references(() => users.id),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  receiptNote: text('receipt_note'),
});

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id')
    .references(() => stockTransfers.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 12, scale: 3 }),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
});

export const supplierProducts = pgTable('supplier_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  providerId: uuid('provider_id')
    .references(() => providers.id)
    .notNull(),
  providerProductName: varchar('provider_product_name', {
    length: 150,
  }).notNull(),
  providerSku: varchar('provider_sku', { length: 50 }),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0.00').notNull(),
  conversionFactor: decimal('conversion_factor', { precision: 10, scale: 4 })
    .default('1.0000')
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const bulkImports = pgTable('bulk_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, processing, completed, failed
  successCount: integer('success_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  totalRows: integer('total_rows').default(0).notNull(),
  errorDetails: jsonb('error_details'), // array of { rowNumber, error, field } etc
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),

    // Ubicaciones
    branchId: uuid('branch_id').references(() => branches.id),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),

    // Detalle del Movimiento
    quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(), // Positivo = Entrada, Negativo = Salida
    type: varchar('type', { length: 30 }).notNull(),
    // 'receipt' | 'sale' | 'production_input' | 'production_output' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'initial'

    // Referencias cruzadas
    referenceId: uuid('reference_id'), // ID de la tabla asociada (order_id, receipt_id, transfer_id, etc.)
    documentNumber: varchar('document_number', { length: 50 }), // SKU de orden, Folio de compra, etc.
    notes: text('notes'),

    // Lotes y Caducidades
    lotNumber: varchar('lot_number', { length: 100 }),
    expirationDate: timestamp('expiration_date', { withTimezone: true }),
    drawerLocation: varchar('drawer_location', { length: 100 }), // Ubicación física (cajón/anaquel)

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdById: uuid('created_by_id').references(() => users.id),
  },
  (table) => [
    index('idx_inv_mov_bus_prod').on(table.businessId, table.productId),
    index('idx_inv_mov_branch').on(table.branchId),
    index('idx_inv_mov_warehouse').on(table.warehouseId),
    index('idx_inv_mov_created_at').on(table.createdAt),
  ],
);

// Immutable inventory ledger. Stock is derived from SUM(quantity_delta),
// never edited directly. Each row is one auditable movement.
export const stockLedger = pgTable(
  'stock_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),

    // Ubicaciones
    branchId: uuid('branch_id').references(() => branches.id),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),

    // Detalle del Movimiento (delta, no valor absoluto)
    quantityDelta: decimal('quantity_delta', { precision: 12, scale: 3 }).notNull(), // Positivo = Entrada, Negativo = Salida
    eventType: varchar('event_type', { length: 30 }).notNull(),
    // 'receipt' | 'sale' | 'production_input' | 'production_output' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'initial'

    // Costo y referencias cruzadas
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
    referenceType: varchar('reference_type', { length: 30 }),
    referenceId: uuid('reference_id'), // ID de la tabla asociada (order_id, receipt_id, transfer_id, etc.)
    documentNumber: varchar('document_number', { length: 50 }),
    notes: text('notes'),

    // Lotes y Caducidades
    lotNumber: varchar('lot_number', { length: 100 }),
    expirationDate: timestamp('expiration_date', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdById: uuid('created_by_id').references(() => users.id),
  },
  (table) => [
    index('idx_stock_ledger_bus_prod').on(table.businessId, table.productId),
    index('idx_stock_ledger_branch').on(table.branchId),
    index('idx_stock_ledger_warehouse').on(table.warehouseId),
    index('idx_stock_ledger_created_at').on(table.createdAt),
  ],
);

export const changeLog = pgTable(
  'change_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    entity: varchar('entity', { length: 50 }).notNull(), // 'orders' | 'orderItems' | 'branchTables'
    entityId: uuid('entity_id').notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id)
      .notNull(),
    versionAt: timestamp('version_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('idx_change_log_branch_version').on(table.branchId, table.versionAt),
  ],
);

// ==========================================
// 5. Purchase Orders & Inventory Requisitions
// ==========================================

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  providerId: uuid('provider_id')
    .references(() => providers.id)
    .notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  branchId: uuid('branch_id').references(() => branches.id),
  poNumber: varchar('po_number', { length: 50 }).unique().notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft', 'sent', 'partially_received', 'received', 'cancelled'
  orderDate: timestamp('order_date', { withTimezone: true })
    .defaultNow()
    .notNull(),
  expectedDeliveryDate: timestamp('expected_delivery_date', {
    withTimezone: true,
  }),
  actualDeliveryDate: timestamp('actual_delivery_date', { withTimezone: true }),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).default('0.00'),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0.00'),
  total: decimal('total', { precision: 10, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id')
    .references(() => purchaseOrders.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantityOrdered: decimal('quantity_ordered', {
    precision: 12,
    scale: 3,
  }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 12, scale: 3 })
    .default('0.000')
    .notNull(),
  unitCostEstimated: decimal('unit_cost_estimated', {
    precision: 10,
    scale: 2,
  }).notNull(),
  unitCostActual: decimal('unit_cost_actual', { precision: 10, scale: 2 })
    .default('0.00')
    .notNull(),
});

export const branchRequisitions = pgTable('branch_requisitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  fromBranchId: uuid('from_branch_id')
    .references(() => branches.id)
    .notNull(),
  toWarehouseId: uuid('to_warehouse_id')
    .references(() => warehouses.id)
    .notNull(),
  status: varchar('status', { length: 20 })
    .default('pending_approval')
    .notNull(), // 'pending_approval', 'approved', 'standby', 'rejected', 'completed'
  notes: text('notes'),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  version: integer('version').default(1).notNull(),
});

export const branchRequisitionItems = pgTable('branch_requisition_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  requisitionId: uuid('requisition_id')
    .references(() => branchRequisitions.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  quantityRequested: decimal('quantity_requested', {
    precision: 12,
    scale: 3,
  }).notNull(),
  quantityApproved: decimal('quantity_approved', { precision: 12, scale: 3 })
    .default('0.000')
    .notNull(),
});

// ==========================================
// 6. Intelligent Inventory Control (alerts & thresholds)
// ==========================================

export const branchStockThresholds = pgTable(
  'branch_stock_thresholds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id)
      .notNull(),
    minStock: decimal('min_stock', { precision: 12, scale: 3 }).default('0.000'), // 0 = use global
    maxStock: decimal('max_stock', { precision: 12, scale: 3 }).default('0.000'), // 0 = use global
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => ({
    unqProductBranch: uniqueIndex('unq_bst_product_branch').on(
      table.productId,
      table.branchId,
    ),
    idxBranch: index('idx_bst_branch').on(table.branchId),
    idxBusiness: index('idx_bst_business').on(table.businessId),
  }),
);

export const warehouseStockThresholds = pgTable(
  'warehouse_stock_thresholds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    warehouseId: uuid('warehouse_id')
      .references(() => warehouses.id)
      .notNull(),
    minStock: decimal('min_stock', { precision: 12, scale: 3 }).default('0.000'), // 0 = use global
    maxStock: decimal('max_stock', { precision: 12, scale: 3 }).default('0.000'), // 0 = use global
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => ({
    unqProductWarehouse: uniqueIndex('unq_wst_product_warehouse').on(
      table.productId,
      table.warehouseId,
    ),
    idxWarehouse: index('idx_wst_warehouse').on(table.warehouseId),
    idxBusiness: index('idx_wst_business').on(table.businessId),
  }),
);

export const inventoryAlerts = pgTable(
  'inventory_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    branchId: uuid('branch_id').references(() => branches.id), // null = global (needs purchase) alert
    alertType: varchar('alert_type', { length: 20 }).notNull(), // 'low_stock' | 'out_of_stock'
    threshold: decimal('threshold', { precision: 12, scale: 3 }).notNull(),
    currentQty: decimal('current_qty', { precision: 12, scale: 3 }).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'acknowledged' | 'resolved'
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    unqActiveAlert: uniqueIndex('unq_ia_product_branch_active')
      .on(table.productId, table.branchId)
      .where(sql`${table.status} IN ('active', 'acknowledged')`),
    unqActiveGlobalAlert: uniqueIndex('unq_ia_product_global_active')
      .on(table.productId)
      .where(sql`${table.branchId} IS NULL AND ${table.status} IN ('active', 'acknowledged')`),
    idxBusinessStatus: index('idx_ia_business_status').on(
      table.businessId,
      table.status,
    ),
    idxBranchStatus: index('idx_ia_branch_status').on(table.branchId, table.status),
    idxProduct: index('idx_ia_product').on(table.productId),
  }),
);

export const businessInventorySettings = pgTable('business_inventory_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .unique()
    .notNull(),
  autoRequisitionEnabled: boolean('auto_requisition_enabled')
    .default(false)
    .notNull(),
  defaultWarehouseId: uuid('default_warehouse_id').references(() => warehouses.id),
  alertEngineIntervalMinutes: integer('alert_engine_interval_minutes')
    .default(15)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// Per-branch catalog: overrides which products a branch can sell (e.g. sell an
// insumo at a retail branch, or hide a finished good from a specific branch).
export const branchProducts = pgTable(
  'branch_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    isSellable: boolean('is_sellable').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    unqBranchProduct: uniqueIndex('unq_branch_products').on(
      table.branchId,
      table.productId,
    ),
    idxBranch: index('idx_branch_products_branch').on(table.branchId),
    idxProduct: index('idx_branch_products_product').on(table.productId),
  }),
);
