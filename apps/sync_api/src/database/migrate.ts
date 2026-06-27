import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './connection';
import * as path from 'path';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

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
    const businessId = 'd3b07384-d113-4a0e-a555-e5b12824bf01';
    const branchId = 'c4f07384-d113-4a0e-a555-e5b12824bf02';

    const matchBusiness = await db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId))
      .limit(1);

    if (matchBusiness.length === 0) {
      console.log('🌱 Seeding specific default business ID...');
      await db.insert(schema.businesses).values({
        id: businessId,
        name: 'Cacharelo',
        taxId: 'MX123456789',
        isActive: true,
        version: 1,
      });
      console.log('✅ Specific default business seeded.');
    }

    const matchBranch = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.id, branchId))
      .limit(1);

    if (matchBranch.length === 0) {
      console.log('🌱 Seeding specific default branch ID...');
      await db.insert(schema.branches).values({
        id: branchId,
        businessId: businessId,
        name: 'Sucursal Principal',
        address: 'Av. Principal 123',
        phone: '555-1234',
        version: 1,
      });
      console.log('✅ Specific default branch seeded.');
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
