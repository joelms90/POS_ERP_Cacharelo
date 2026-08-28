import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './connection';
import * as path from 'path';
import * as schema from './schema';
import { eq, inArray, sql, lte, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

export async function runMigrations() {
  console.log('⏳ Running database migrations...');
  try {
    console.log('🧹 Terminating orphaned database connections...');
    try {
      await db.execute(sql`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE pid <> pg_backend_pid()
          AND (state = 'idle in transaction' OR age(clock_timestamp(), query_start) > interval '3 minutes');
      `);
      console.log('✅ Orphaned database connections terminated.');
    } catch (e) {
      console.error('⚠️ Failed to terminate orphaned connections:', e);
    }

    // Relative path from dist/database/migrate.js to root migrations/
    const migrationsPath = path.join(__dirname, '../../migrations');
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('✅ Migrations completed successfully.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_fiscal_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL REFERENCES businesses(id),
        branch_id uuid REFERENCES branches(id),
        seller_display_name varchar(120) NOT NULL,
        legal_name varchar(180) NOT NULL,
        fiscal_id varchar(50) NOT NULL,
        branch_name varchar(120) NOT NULL,
        branch_address text NOT NULL,
        phone varchar(30),
        receipt_prefix varchar(20) NOT NULL DEFAULT 'CCH',
        tax_mode varchar(20) NOT NULL DEFAULT 'breakdown',
        footer_text text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1
      );
    `);
    console.log('✅ Ticket fiscal configuration table ensured.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_business_access (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        business_id uuid NOT NULL REFERENCES businesses(id),
        role varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        version integer NOT NULL DEFAULT 1
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS admin_business_access_user_business_active_idx
      ON admin_business_access(user_id, business_id)
      WHERE deleted_at IS NULL;
    `);
    console.log('✅ Admin business access table ensured.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS print_stations (
        station_id varchar(120) PRIMARY KEY,
        branch_id uuid NOT NULL REFERENCES branches(id),
        device_name varchar(120) NOT NULL,
        role varchar(30) NOT NULL,
        operator_id uuid REFERENCES users(id),
        operator_name varchar(120),
        printer_name varchar(180) NOT NULL,
        can_print_comandas boolean NOT NULL DEFAULT true,
        last_seen_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS print_stations_branch_idx ON print_stations(branch_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS print_stations_last_seen_idx ON print_stations(last_seen_at);`,
    );

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id varchar(120) PRIMARY KEY,
        branch_id uuid NOT NULL REFERENCES branches(id),
        target_station_id varchar(120) NOT NULL,
        source_user_id uuid REFERENCES users(id),
        source_user_name varchar(120),
        title varchar(180) NOT NULL,
        details text NOT NULL,
        target varchar(50) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'queued',
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        printed_at timestamptz,
        failed_at timestamptz
      );
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS print_jobs_branch_idx ON print_jobs(branch_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS print_jobs_station_status_idx ON print_jobs(target_station_id, status);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS print_jobs_created_at_idx ON print_jobs(created_at);`,
    );
    console.log('✅ Print station tables ensured.');

    await db.execute(sql`
      ALTER TABLE cash_shifts
        ADD COLUMN IF NOT EXISTS denomination_counts jsonb,
        ADD COLUMN IF NOT EXISTS close_notes text,
        ADD COLUMN IF NOT EXISTS close_snapshot jsonb;
    `);
    console.log('✅ Cash shift close snapshot columns ensured.');

    await db.execute(sql`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS client_uuid varchar(120);
    `);
    await db.execute(sql`
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS client_uuid varchar(120);
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_client_uuid_unique_idx
      ON orders(client_uuid)
      WHERE client_uuid IS NOT NULL;
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS order_items_client_uuid_unique_idx
      ON order_items(client_uuid)
      WHERE client_uuid IS NOT NULL;
    `);
    console.log('✅ Order client idempotency columns ensured.');

    // Product inventory model columns (item_type, production_strategy, uom)
    await db.execute(sql`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS item_type varchar(20) NOT NULL DEFAULT 'finished_good',
        ADD COLUMN IF NOT EXISTS production_strategy varchar(20) NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS uom varchar(10) NOT NULL DEFAULT 'piece';
    `);
    await db.execute(sql`
      UPDATE products SET item_type = 'raw_material'
      WHERE is_ingredient = true AND item_type = 'finished_good';
    `);
    await db.execute(sql`
      UPDATE products SET uom = sale_type
      WHERE sale_type IS NOT NULL AND sale_type <> 'pieza' AND uom = 'piece';
    `);
    console.log('✅ Product inventory model columns ensured.');

    // Immutable stock ledger (source of truth for inventory)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stock_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL REFERENCES businesses(id),
        product_id uuid NOT NULL REFERENCES products(id),
        branch_id uuid REFERENCES branches(id),
        warehouse_id uuid REFERENCES warehouses(id),
        quantity_delta numeric(12, 3) NOT NULL,
        event_type varchar(30) NOT NULL,
        unit_cost numeric(10, 2),
        reference_type varchar(30),
        reference_id uuid,
        document_number varchar(50),
        notes text,
        lot_number varchar(100),
        expiration_date timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by_id uuid REFERENCES users(id)
      );
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_stock_ledger_bus_prod ON stock_ledger(business_id, product_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_stock_ledger_branch ON stock_ledger(branch_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_stock_ledger_warehouse ON stock_ledger(warehouse_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_stock_ledger_created_at ON stock_ledger(created_at);`,
    );
    console.log('✅ Stock ledger table ensured.');

    // Intelligent inventory control tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS branch_stock_thresholds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL REFERENCES businesses(id),
        product_id uuid NOT NULL REFERENCES products(id),
        branch_id uuid NOT NULL REFERENCES branches(id),
        min_stock numeric(12, 3) DEFAULT '0.000',
        max_stock numeric(12, 3) DEFAULT '0.000',
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid REFERENCES users(id)
      );
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS unq_bst_product_branch ON branch_stock_thresholds(product_id, branch_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_bst_branch ON branch_stock_thresholds(branch_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_bst_business ON branch_stock_thresholds(business_id);`,
    );

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL REFERENCES businesses(id),
        product_id uuid NOT NULL REFERENCES products(id),
        branch_id uuid NOT NULL REFERENCES branches(id),
        alert_type varchar(20) NOT NULL,
        threshold numeric(12, 3) NOT NULL,
        current_qty numeric(12, 3) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        acknowledged_at timestamptz,
        acknowledged_by uuid REFERENCES users(id),
        resolved_at timestamptz
      );
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS unq_ia_product_branch_active ON inventory_alerts(product_id, branch_id) WHERE status IN ('active', 'acknowledged');`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ia_business_status ON inventory_alerts(business_id, status);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ia_branch_status ON inventory_alerts(branch_id, status);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ia_product ON inventory_alerts(product_id);`,
    );

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS business_inventory_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL UNIQUE REFERENCES businesses(id),
        auto_requisition_enabled boolean NOT NULL DEFAULT false,
        default_warehouse_id uuid REFERENCES warehouses(id),
        alert_engine_interval_minutes integer NOT NULL DEFAULT 15,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid REFERENCES users(id)
      );
    `);
    console.log('✅ Intelligent inventory control tables ensured.');

    // Recipe waste percentage column
    await db.execute(sql`
      ALTER TABLE recipes
        ADD COLUMN IF NOT EXISTS waste_percent numeric(5, 2) NOT NULL DEFAULT '0.00';
    `);
    console.log('✅ Recipe waste percent column ensured.');

    // Warehouse location type (transit support)
    await db.execute(sql`
      ALTER TABLE warehouses
        ADD COLUMN IF NOT EXISTS location_type varchar(30) NOT NULL DEFAULT 'warehouse';
    `);
    console.log('✅ Warehouse location type column ensured.');

    // Inventory alerts: branch_id nullable for global alerts + global unique index
    await db.execute(sql`
      ALTER TABLE inventory_alerts ALTER COLUMN branch_id DROP NOT NULL;
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS unq_ia_product_global_active ON inventory_alerts(product_id) WHERE branch_id IS NULL AND status IN ('active', 'acknowledged');`,
    );
    console.log('✅ Global inventory alert support ensured.');

    // Ensure specific default business and branch exist
    const businessLines = [
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
        name: 'Cafetería Cacharelo',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf02',
        branchName: 'Cacharelo Centro',
      },
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf03',
        name: 'Empanadas',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf04',
        branchName: 'Sucursal Empanadas',
      },
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf07',
        name: 'Tortas',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf08',
        branchName: 'Sucursal Tortas',
      },
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf05',
        name: 'Hamburguesas',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf06',
        branchName: 'Sucursal Hamburguesas',
      },
    ];

    for (const b of businessLines) {
      const matchBusiness = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, b.id))
        .limit(1);

      if (matchBusiness.length === 0) {
        console.log(`🌱 Seeding business line: ${b.name}...`);
        await db.insert(schema.businesses).values({
          id: b.id,
          name: b.name,
          taxId: 'MX123456789',
          isActive: true,
          version: 1,
        });
      } else {
        await db
          .update(schema.businesses)
          .set({ name: b.name })
          .where(eq(schema.businesses.id, b.id));
      }

      const matchBranch = await db
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.id, b.branchId))
        .limit(1);

      if (matchBranch.length === 0) {
        console.log(`🌱 Seeding branch: ${b.branchName}...`);
        await db.insert(schema.branches).values({
          id: b.branchId,
          businessId: b.id,
          name: b.branchName,
          address: 'Av. Principal 123',
          phone: '555-1234',
          version: 1,
        });
      } else {
        await db
          .update(schema.branches)
          .set({ name: b.branchName })
          .where(eq(schema.branches.id, b.branchId));
      }

      const mockFiscalConfig = {
        businessId: b.id,
        branchId: b.branchId,
        sellerDisplayName: b.name,
        legalName: `${b.name} S.A. de C.V.`,
        fiscalId: 'CACX010101ABC',
        branchName: b.branchName,
        branchAddress: 'Av. Principal 123, Centro, Mexico',
        phone: '555-1234',
        receiptPrefix: b.name.substring(0, 3).toUpperCase(),
        taxMode: 'breakdown',
        footerText:
          'Comprobante de compra. IVA incluido en precios al publico.\ncacharelo.com',
        isActive: true,
        version: 1,
      };

      const matchTicketConfig = await db
        .select()
        .from(schema.ticketFiscalConfigurations)
        .where(
          and(
            eq(schema.ticketFiscalConfigurations.businessId, b.id),
            eq(schema.ticketFiscalConfigurations.branchId, b.branchId),
          ),
        )
        .limit(1);

      if (matchTicketConfig.length === 0) {
        await db
          .insert(schema.ticketFiscalConfigurations)
          .values(mockFiscalConfig);
      } else if (
        !String(matchTicketConfig[0].footerText || '').includes('cacharelo.com')
      ) {
        const existingFooter = String(
          matchTicketConfig[0].footerText || '',
        ).trim();
        await db
          .update(schema.ticketFiscalConfigurations)
          .set({
            footerText: existingFooter
              ? `${existingFooter}\ncacharelo.com`
              : mockFiscalConfig.footerText,
            updatedAt: new Date(),
            version: sql`${schema.ticketFiscalConfigurations.version} + 1`,
          })
          .where(
            eq(schema.ticketFiscalConfigurations.id, matchTicketConfig[0].id),
          );
      }
    }
    console.log('✅ Specific default business lines and branches seeded.');

    console.log('🌱 Ensuring default employees for Cafetería...');

    // Check if users exist first to avoid slow bcrypt operations
    const existingEmployees = await db
      .select()
      .from(schema.users)
      .where(
        inArray(schema.users.id, [
          '81a6df6c-5bcb-4d0b-8e75-02f18f399041',
          '81a6df6c-5bcb-4d0b-8e75-02f18f399042',
          '81a6df6c-5bcb-4d0b-8e75-02f18f399043',
        ]),
      );

    if (existingEmployees.length === 0) {
      console.log('  Hashing default employee PINs (first time only)...');
      const waiterPin = await bcrypt.hash('1111', 10);
      const cashierPin = await bcrypt.hash('2222', 10);
      const kitchenPin = await bcrypt.hash('3333', 10);

      await db.insert(schema.users).values([
        {
          id: '81a6df6c-5bcb-4d0b-8e75-02f18f399041',
          businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01', // Cafeteria
          name: 'Juan (Mesero)',
          pin: waiterPin,
          role: 'waiter',
          version: 1,
        },
        {
          id: '81a6df6c-5bcb-4d0b-8e75-02f18f399042',
          businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01', // Cafeteria
          name: 'Sofia (Cajero)',
          pin: cashierPin,
          role: 'cashier',
          version: 1,
        },
        {
          id: '81a6df6c-5bcb-4d0b-8e75-02f18f399043',
          businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01', // Cafeteria
          name: 'Carlos (Cocina)',
          pin: kitchenPin,
          role: 'kitchen',
          version: 1,
        },
      ]);
    }
    console.log('✅ Default Cafetería employees ensured.');

    console.log('🌱 Ensuring default Business Control admin users...');

    // Check if admin users exist first to avoid slow bcrypt operations
    const existingAdmins = await db
      .select()
      .from(schema.users)
      .where(
        inArray(schema.users.id, [
          '91a6df6c-5bcb-4d0b-8e75-02f18f399041',
          '91a6df6c-5bcb-4d0b-8e75-02f18f399042',
        ]),
      );

    if (existingAdmins.length === 0) {
      console.log('  Hashing admin passwords (first time only)...');
      const adminPin = await bcrypt.hash('0000', 10);
      const ownerPassword = await bcrypt.hash(
        process.env.DEFAULT_OWNER_PASSWORD || 'owner123',
        10,
      );
      const inventoryAdminPassword = await bcrypt.hash(
        process.env.DEFAULT_INVENTORY_ADMIN_PASSWORD || 'inventario123',
        10,
      );

      await db.insert(schema.users).values([
        {
          id: '91a6df6c-5bcb-4d0b-8e75-02f18f399041',
          businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
          name: 'Owner Cacharelo',
          email: 'owner@cacharelo.com',
          passwordHash: ownerPassword,
          pin: adminPin,
          role: 'owner',
          version: 1,
        },
        {
          id: '91a6df6c-5bcb-4d0b-8e75-02f18f399042',
          businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
          name: 'Inventario Cacharelo',
          email: 'inventario@cacharelo.com',
          passwordHash: inventoryAdminPassword,
          pin: adminPin,
          role: 'inventory_admin',
          version: 1,
        },
      ]);
    }

    const accessRows = [
      {
        userId: '91a6df6c-5bcb-4d0b-8e75-02f18f399041',
        businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
        role: 'owner',
        version: 1,
      },
      {
        userId: '91a6df6c-5bcb-4d0b-8e75-02f18f399042',
        businessId: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
        role: 'inventory_admin',
        version: 1,
      },
    ];

    for (const access of accessRows) {
      await db.execute(sql`
        INSERT INTO admin_business_access (user_id, business_id, role, version)
        VALUES (${access.userId}, ${access.businessId}, ${access.role}, ${access.version})
        ON CONFLICT (user_id, business_id) WHERE deleted_at IS NULL
        DO UPDATE SET
          role = excluded.role,
          updated_at = now(),
          version = admin_business_access.version + 1;
      `);
    }
    console.log('✅ Default Business Control admin users ensured.');

    // Cleanup any bulk imports left in 'pending' or 'processing' states due to server restarts (stale > 5 mins)
    console.log('🧹 Cleaning up interrupted bulk imports...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db
      .update(schema.bulkImports)
      .set({
        status: 'failed',
        errorDetails: [
          {
            error:
              'La importación fue interrumpida por un reinicio o apagado del servidor.',
          },
        ],
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(schema.bulkImports.status, ['pending', 'processing']),
          lte(schema.bulkImports.updatedAt, fiveMinutesAgo),
        ),
      );
    console.log('✅ Interrupted bulk imports cleaned up.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Do not block app boot in development if database is not reachable,
    // but in production it is best to throw to prevent inconsistent states.
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
