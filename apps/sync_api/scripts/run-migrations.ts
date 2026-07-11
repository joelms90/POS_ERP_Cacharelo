#!/usr/bin/env tsx
/**
 * Standalone migration script for production deployments
 * Run this BEFORE deploying new application versions
 */

import { runMigrations } from '../src/database/migrate';

async function main() {
  console.log('🚀 Starting database migration script...');
  console.log('Environment:', process.env.NODE_ENV || 'development');

  try {
    await runMigrations();
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
