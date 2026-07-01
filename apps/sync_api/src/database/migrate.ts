import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './connection';
import * as path from 'path';
import * as schema from './schema';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

export async function runMigrations() {
  console.log('⏳ Running database migrations...');
  try {
    // Relative path from dist/database/migrate.js to root migrations/
    const migrationsPath = path.join(__dirname, '../../migrations');
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('✅ Migrations completed successfully.');

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
        await db.update(schema.businesses)
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
        await db.update(schema.branches)
          .set({ name: b.branchName })
          .where(eq(schema.branches.id, b.branchId));
      }
    }
    console.log('✅ Specific default business lines and branches seeded.');

    // Clear and seed fresh employees for Cafetería only
    console.log('🧹 Clearing old users/employees...');
    await db.delete(schema.refreshTokens);
    await db.delete(schema.users);

    console.log('🌱 Seeding fresh employees for Cafetería...');
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
    console.log('✅ Fresh Cafetería employees seeded.');

    // Cleanup any bulk imports left in 'pending' or 'processing' states due to server restarts
    console.log('🧹 Cleaning up interrupted bulk imports...');
    await db
      .update(schema.bulkImports)
      .set({
        status: 'failed',
        errorDetails: [{ error: 'La importación fue interrumpida por un reinicio o apagado del servidor.' }],
        updatedAt: new Date(),
      })
      .where(inArray(schema.bulkImports.status, ['pending', 'processing']));
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
