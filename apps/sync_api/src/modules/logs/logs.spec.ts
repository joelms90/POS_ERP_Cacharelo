import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import {
  fingerprintOf,
  redactQueryParams,
  sanitizeClientEntry,
  scrubSecrets,
} from './log-entry';
import { LogsService } from './logs.service';
import { ServerErrorsInterceptor } from './server-errors.interceptor';

jest.mock('../../database/connection', () => ({ pool: { query: jest.fn() } }));

describe('log-entry helpers', () => {
  it('redacts pins, passwords and bearer tokens', () => {
    const out = scrubSecrets(
      'login failed {"pin":"1234","password":"hunter2"} Authorization: Bearer abc.def.ghi',
    );
    expect(out).not.toContain('1234');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('abc.def.ghi');
    expect(out).toContain('[REDACTED]');
  });

  it('gives the same fingerprint to the same bug with different ids/numbers', () => {
    const a = fingerprintOf(
      'pos_flutter',
      'Order 6b1c6a3e-2f4b-4d2a-9a51-0c3a3b0e1f22 failed with 500 after 3 retries',
    );
    const b = fingerprintOf(
      'pos_flutter',
      'Order 0a0a0a0a-1111-2222-3333-444444444444 failed with 502 after 1 retries',
    );
    const c = fingerprintOf('pos_flutter', 'Printer disconnected');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('bounds and normalizes untrusted client payloads', () => {
    const entry = sanitizeClientEntry(
      {
        source: 'admin_web',
        level: 'nonsense',
        message: 'x'.repeat(5000),
        httpStatus: 'abc',
        httpMethod: 'post',
        breadcrumbs: Array.from({ length: 100 }, (_, i) => `crumb ${i}`),
        occurredAt: '1999-01-01T00:00:00Z',
      },
      { now: new Date('2026-11-20T12:00:00Z') },
    )!;
    expect(entry.source).toBe('admin_web');
    expect(entry.level).toBe('error');
    expect(entry.message.length).toBeLessThanOrEqual(2001);
    expect(entry.httpStatus).toBeNull();
    expect(entry.httpMethod).toBe('POST');
    expect(entry.breadcrumbs).toHaveLength(40);
    expect(entry.breadcrumbs![39]).toBe('crumb 99');
    expect(entry.occurredAt.toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });

  it('redacts bound params only for credential-related queries', () => {
    const users =
      'Failed query: insert into "users" ("name", "pin") values ($1, $2)\nparams: Ana,$2b$10$hash';
    const branches =
      'Failed query: select * from "branches" where id = $1\nparams: not-a-uuid';
    expect(redactQueryParams(users)).toContain('params: [REDACTED]');
    expect(redactQueryParams(users)).not.toContain('$2b$10$hash');
    expect(redactQueryParams(branches)).toContain('params: not-a-uuid');
  });

  it('rejects entries without a message', () => {
    expect(sanitizeClientEntry({ level: 'error' })).toBeNull();
    expect(sanitizeClientEntry(null)).toBeNull();
  });
});

describe('ServerErrorsInterceptor', () => {
  const makeContext = (): ExecutionContext =>
    ({
      getType: () => 'http',
      getClass: () => ({ name: 'OrdersController' }),
      getHandler: () => ({ name: 'create' }),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/orders?branchId=b-1',
          route: { path: '/api/orders' },
          query: { branchId: 'b-1' },
          body: { pin: '9999' },
          headers: {},
          user: { sub: 'u-1', name: 'Ana', role: 'cashier' },
        }),
      }),
    }) as unknown as ExecutionContext;

  const run = (err: unknown) => {
    const logs = {
      record: jest.fn().mockResolvedValue(1),
    } as unknown as LogsService;
    const interceptor = new ServerErrorsInterceptor(logs);
    const handler: CallHandler = { handle: () => throwError(() => err) };
    const result = lastValueFrom(interceptor.intercept(makeContext(), handler));
    return { logs, result };
  };

  it('records 5xx errors with request context and rethrows the original error', async () => {
    const boom = new Error('relation "foo" does not exist');
    const { logs, result } = run(boom);
    await expect(result).rejects.toBe(boom);
    const [[entries]] = (logs.record as jest.Mock).mock.calls;
    expect(entries[0]).toMatchObject({
      source: 'sync_api',
      branchId: 'b-1',
      userName: 'Ana',
      httpStatus: 500,
      httpMethod: 'POST',
    });
    expect(JSON.stringify(entries[0])).not.toContain('9999');
  });

  it('records InternalServerErrorException', async () => {
    const { logs, result } = run(new InternalServerErrorException('db down'));
    await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(logs.record).toHaveBeenCalledTimes(1);
  });

  it('ignores 4xx business errors', async () => {
    const { logs, result } = run(new BadRequestException('bad'));
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    expect(logs.record).not.toHaveBeenCalled();
  });
});
