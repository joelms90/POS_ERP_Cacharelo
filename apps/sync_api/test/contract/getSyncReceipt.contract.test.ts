import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../src/handlers/getSyncReceipt.js';

test('get receipt requires transaction id', async () => {
  const response = await handler({ pathParameters: {} });
  assert.equal(response.statusCode, 422);
});

