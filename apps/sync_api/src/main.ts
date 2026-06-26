import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { runMigrations } from './database/migrate';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Run database migrations on startup
  await runMigrations();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
