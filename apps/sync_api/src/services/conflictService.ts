import { ConflictRecord, InMemoryConflictRepository } from '../persistence/conflictRepository.js';

export class ConflictService {
  constructor(private readonly conflicts = new InMemoryConflictRepository()) {}

  async payloadHashMismatch(transactionId: string): Promise<ConflictRecord> {
    return this.conflicts.create({
      transactionId,
      reason: 'payload_hash_mismatch',
      message: 'Transaction UUID was replayed with a different payload hash'
    });
  }

  async inventoryConflict(transactionId: string): Promise<ConflictRecord> {
    return this.conflicts.create({
      transactionId,
      reason: 'inventory_conflict',
      message: 'Cloud stock was insufficient for the offline sale'
    });
  }
}

