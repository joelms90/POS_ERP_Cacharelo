import { randomUUID } from 'node:crypto';

export interface ConflictRecord {
  conflictId: string;
  transactionId: string;
  reason: 'payload_hash_mismatch' | 'invalid_state' | 'inventory_conflict';
  message?: string;
}

export class InMemoryConflictRepository {
  private readonly conflicts: ConflictRecord[] = [];

  async create(input: Omit<ConflictRecord, 'conflictId'>): Promise<ConflictRecord> {
    const conflict = { conflictId: randomUUID(), ...input };
    this.conflicts.push(conflict);
    return conflict;
  }

  all(): ConflictRecord[] {
    return [...this.conflicts];
  }
}

