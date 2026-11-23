import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { OwnerCopilotController } from './owner-copilot.controller';
import { OwnerCopilotService } from './owner-copilot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('OwnerCopilot authorization', () => {
  let app: INestApplication; let jwt: JwtService;
  const service = { chat: jest.fn().mockResolvedValue({ answer: 'ok' }), confirm: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [JwtModule.register({})], controllers: [OwnerCopilotController], providers: [{ provide: OwnerCopilotService, useValue: service }, JwtAuthGuard, RolesGuard, Reflector] }).compile();
    app = module.createNestApplication(); jwt = module.get(JwtService); await app.init();
  });
  afterAll(async () => app.close());
  const token = (role: string) => jwt.sign({ sub: '00000000-0000-4000-8000-000000000001', role }, { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' });
  it('requires a real owner JWT', async () => {
    await request(app.getHttpServer()).post('/owner-copilot/chat').send({ prompt: 'ventas', businessId: '00000000-0000-4000-8000-000000000002' }).expect(401);
    await request(app.getHttpServer()).post('/owner-copilot/chat').auth(token('inventory_admin'), { type: 'bearer' }).send({ prompt: 'ventas', businessId: '00000000-0000-4000-8000-000000000002' }).expect(403);
    await request(app.getHttpServer()).post('/owner-copilot/chat').auth(token('owner'), { type: 'bearer' }).send({ prompt: 'ventas', businessId: '00000000-0000-4000-8000-000000000002' }).expect(201);
  });
});
