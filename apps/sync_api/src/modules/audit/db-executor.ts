import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';

/** The root connection or a transaction handle (both expose select/insert/update). */
export type DbExecutor = Pick<
  NodePgDatabase<typeof schema>,
  'select' | 'insert' | 'update' | 'execute'
>;
export type AppDatabase = NodePgDatabase<typeof schema>;
