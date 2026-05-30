import {
  InMemoryTransactionRepository,
  SyncReceipt,
  TransactionSyncRequest
} from '../persistence/transactionRepository.js';
import { audit } from './auditLogger.js';
import { ConflictService } from './conflictService.js';

export type SyncResult =
  | { statusCode: 202; body: SyncReceipt }
  | { statusCode: 409; body: Awaited<ReturnType<ConflictService['payloadHashMismatch']>> };

export class TransactionSyncService {
  constructor(
    private readonly transactions = new InMemoryTransactionRepository(),
    private readonly conflicts = new ConflictService()
  ) {}

  async submit(request: TransactionSyncRequest, idempotencyKey: string): Promise<SyncResult> {
    if (idempotencyKey !== request.transactionId) {
      const conflict = await this.conflicts.payloadHashMismatch(request.transactionId);
      audit({ event: 'sync.conflict', transactionId: request.transactionId, reason: conflict.reason });
      return { statusCode: 409, body: conflict };
    }

    try {
      const receipt = await this.transactions.accept(request);
      audit({
        event: receipt.status === 'duplicate' ? 'sync.duplicate' : 'sync.accepted',
        transactionId: request.transactionId,
        deviceId: request.deviceId
      });
      return { statusCode: 202, body: receipt };
    } catch {
      const conflict = await this.conflicts.payloadHashMismatch(request.transactionId);
      audit({ event: 'sync.conflict', transactionId: request.transactionId, reason: conflict.reason });
      return { statusCode: 409, body: conflict };
    }
  }
}

