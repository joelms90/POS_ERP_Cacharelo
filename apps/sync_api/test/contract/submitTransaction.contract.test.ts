import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../src/handlers/submitTransaction.js';

test('submit transaction requires idempotency key', async () => {
  const response = await handler({ body: '{}' });
  assert.equal(response.statusCode, 422);
});

