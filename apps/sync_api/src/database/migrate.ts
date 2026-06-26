import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './connection';
import * as path from 'path';
import * as schema from './schema';

export async function runMigrations() {
  console.log('⏳ Running database migrations...');
  try {
    // Relative path from dist/database/migrate.js to root migrations/
    const migrationsPath = path.join(__dirname, '../../migrations');
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('✅ Migrations completed successfully.');

    // Ensure default business and branch exist
    const existingBusinesses = await db.select().from(schema.businesses).limit(1);
    if (existingBusinesses.length === 0) {
      console.log('🌱 Seeding default business and branch...');
      const businessId = 'd3b07384-d113-4a0e-a555-e5b12824bf01';
      const branchId = 'c4f07384-d113-4a0e-a555-e5b12824bf02';

      await db.insert(schema.businesses).values({
        id: businessId,
        name: 'Cacharelo',
        taxId: 'MX123456789',
        isActive: true,
        version: 1,
      });

      await db.insert(schema.branches).values({
        id: branchId,
        businessId: businessId,
        name: 'Sucursal Principal',
        address: 'Av. Principal 123',
        phone: '555-1234',
        version: 1,
      });
      console.log('✅ Default business and branch seeded.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Do not block app boot in development if database is not reachable,
    // but in production it is best to throw to prevent inconsistent states.
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
