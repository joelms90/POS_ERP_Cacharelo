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
    const businessLines = [
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
        name: 'Cafetería Cacharelo',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf02',
        branchName: 'Cacharelo Centro',
      },
      {
        id: 'd3b07384-d113-4a0e-a555-e5b12824bf03',
        name: 'Empanadas & Tortas',
        branchId: 'c4f07384-d113-4a0e-a555-e5b12824bf04',
        branchName: 'Sucursal Empanadas',
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
      }
    }
    console.log('✅ Specific default business lines and branches seeded.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Do not block app boot in development if database is not reachable,
    // but in production it is best to throw to prevent inconsistent states.
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
