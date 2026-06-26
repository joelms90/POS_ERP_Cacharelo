import type { Knex } from 'knex';

const connectionString = process.env.DATABASE_URL || 'postgresql://pos_user:pos_password@localhost:5432/pos_db';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: connectionString,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
      extension: 'ts',
    },
  },
  production: {
    client: 'postgresql',
    connection: connectionString,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },
};

export default config;
