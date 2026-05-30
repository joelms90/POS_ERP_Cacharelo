import pg from 'pg';

const { Pool } = pg;

export interface DbConfig {
  connectionString: string;
  max?: number;
}

let pool: pg.Pool | undefined;

export function getPool(config: DbConfig = envConfig()): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.connectionString,
      max: config.max ?? 4
    });
  }
  return pool;
}

export function envConfig(): DbConfig {
  const connectionString = process.env.RDS_PROXY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('RDS_PROXY_DATABASE_URL is required');
  }
  return { connectionString };
}

export async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows as T[];
}

