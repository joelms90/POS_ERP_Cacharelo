import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { runMigrations } from './database/migrate';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // In production, migrations should be run separately via Cloud Run Jobs
  // In development, run migrations on startup for convenience
  const shouldRunMigrations =
    process.env.RUN_MIGRATIONS_ON_STARTUP === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.SKIP_MIGRATIONS !== 'true');

  if (shouldRunMigrations) {
    console.log('🔄 Running migrations on startup...');
    await runMigrations();
  } else {
    console.log('⏭️  Skipping migrations (run separately in production)');
  }

  const app = await NestFactory.create(AppModule);

  // Increase body parser payload limits for layout images
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
