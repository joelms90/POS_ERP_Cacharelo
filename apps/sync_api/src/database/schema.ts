import { pgTable, uuid, varchar, integer, timestamp, boolean, decimal, text } from 'drizzle-orm/pg-core';

// ==========================================
// 1. Tenants & Catalog Entities
// ==========================================

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  taxId: varchar('tax_id', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const branchTables = pgTable('branch_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  label: varchar('label', { length: 50 }).notNull(), // e.g. "Mesa 1"
  capacity: integer('capacity').default(4).notNull(),
  room: varchar('room', { length: 50 }).default('General').notNull(), // e.g. "Terraza", "Salon"
  state: varchar('state', { length: 20 }).default('free').notNull(), // free, occupied, billing, cleaning
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 2. Operators & Authentication
// ==========================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id), // Nullable for system-wide admins
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  pin: varchar('pin', { length: 255 }).notNull(), // Checked for uniqueness per business
  role: varchar('role', { length: 20 }).notNull(), // waiter, cashier, kitchen, admin
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceUuid: varchar('device_uuid', { length: 255 }).unique().notNull(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "Tablet Mesero 1"
  role: varchar('role', { length: 20 }).notNull(), // ordering, kds, cashier
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 3. Products & Menu Catalog
// ==========================================

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0.00').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).default('0.00').notNull(),
  isSellable: boolean('is_sellable').default(true).notNull(),
  isIngredient: boolean('is_ingredient').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

// ==========================================
// 4. POS Order Workflow & Shifts
// ==========================================

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  tableId: uuid('table_id').references(() => branchTables.id).notNull(),
  waiterId: uuid('waiter_id').references(() => users.id).notNull(),
  state: varchar('state', { length: 20 }).default('open').notNull(), // open, billing, closed, cancelled
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).default('0.00').notNull(),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  assignedGuest: integer('assigned_guest').default(1).notNull(),
  isSent: boolean('is_sent').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(), // cash, card
  referenceCode: varchar('reference_code', { length: 50 }), // "Visa - **** 1234"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cashShifts = pgTable('cash_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cashierId: uuid('cashier_id').references(() => users.id).notNull(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  initialFloat: decimal('initial_float', { precision: 10, scale: 2 }).notNull(),
  cashDrawerAmount: decimal('cash_drawer_amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, closed
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const cashTransactions = pgTable('cash_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').references(() => cashShifts.id).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // cash-in, cash-out
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deviceSyncCheckpoints = pgTable('device_sync_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const kitchenTickets = pgTable('kitchen_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, preparing, ready, served
  station: varchar('station', { length: 50 }).notNull(), // cocina, barra
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  servedAt: timestamp('served_at', { withTimezone: true }),
});
