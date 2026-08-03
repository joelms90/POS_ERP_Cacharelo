import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.mock('pg', () => {
  const mClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return { Client: jest.fn(() => mClient), Pool: jest.fn(() => ({ on: jest.fn(), end: jest.fn().mockResolvedValue(undefined) })) };
});
import { WsAdapter } from '@nestjs/platform-ws';
import { DRIZZLE_CONNECTION } from '../src/database/database.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const mockDb = {
    execute: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DRIZZLE_CONNECTION)
      .useValue(mockDb)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'OK', database: 'connected' });
  });

  afterEach(async () => {
    await app.close();
  });
});
