import { Module, Global } from '@nestjs/common';
import { db } from './connection';

export const DRIZZLE_CONNECTION = 'DRIZZLE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_CONNECTION,
      useValue: db,
    },
  ],
  exports: [DRIZZLE_CONNECTION],
})
export class DatabaseModule {}
