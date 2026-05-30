import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictService } from '../../src/services/conflictService.js';

test('inventory conflict creates auditable record', async () => {
  const conflict = await new ConflictService().inventoryConflict(
    '00000000-0000-4000-8000-000000000001'
  );

  assert.equal(conflict.reason, 'inventory_conflict');
});

