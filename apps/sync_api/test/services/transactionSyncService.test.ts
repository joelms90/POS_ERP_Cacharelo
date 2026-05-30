import test from 'node:test';
import assert from 'node:assert/strict';
import { TransactionSyncService } from '../../src/services/transactionSyncService.js';

test('duplicate replay returns one accepted transaction receipt', async () => {
  const service = new TransactionSyncService();
  const request = {
    transactionId: '00000000-0000-4000-8000-000000000001',
    deviceId: '00000000-0000-4000-8000-000000000002',
    branchId: 'branch-1',
    transactionType: 'sale',
    localVersion: 1,
    createdAtLocal: new Date().toISOString(),
    payloadHash: 'hash-1',
    payload: { total: 100 }
  };

  const first = await service.submit(request, request.transactionId);
  const second = await service.submit(request, request.transactionId);

  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 202);
  assert.equal(second.body.status, 'duplicate');
});

