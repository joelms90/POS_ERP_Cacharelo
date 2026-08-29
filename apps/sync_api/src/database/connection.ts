import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://pos_user:pos_password@localhost:5432/pos_dev';

const numberFromEnv = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const pool = new Pool({
  connectionString,
  max: numberFromEnv('PG_POOL_MAX', 5),
  idleTimeoutMillis: numberFromEnv('PG_IDLE_TIMEOUT_MS', 30000),
  connectionTimeoutMillis: numberFromEnv('PG_CONNECTION_TIMEOUT_MS', 5000),
});

export const db = drizzle(pool, { schema });
