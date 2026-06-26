import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './connection';
import * as path from 'path';

export async function runMigrations() {
  console.log('⏳ Running database migrations...');
  try {
    // Relative path from dist/database/migrate.js to root migrations/
    const migrationsPath = path.join(__dirname, '../../migrations');
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('✅ Migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Do not block app boot in development if database is not reachable,
    // but in production it is best to throw to prevent inconsistent states.
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
