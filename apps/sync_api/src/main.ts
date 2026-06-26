import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { runMigrations } from './database/migrate';

async function bootstrap() {
  // Run database migrations on startup
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
