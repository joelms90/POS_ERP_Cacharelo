import { randomUUID } from 'node:crypto';

export interface TransactionSyncRequest {
  transactionId: string;
  deviceId: string;
  branchId: string;
  transactionType: string;
  localVersion: number;
  createdAtLocal: string;
  payloadHash: string;
  payload: Record<string, unknown>;
}

export interface SyncReceipt {
  receiptId: string;
  transactionId: string;
  status: 'accepted' | 'duplicate';
  acceptedAt: string;
  cloudVersion: number;
}

export interface StoredTransaction {
  request: TransactionSyncRequest;
  receipt: SyncReceipt;
}

export class InMemoryTransactionRepository {
  private readonly transactions = new Map<string, StoredTransaction>();

  async accept(request: TransactionSyncRequest): Promise<SyncReceipt> {
    const existing = this.transactions.get(request.transactionId);
    if (existing) {
      if (existing.request.payloadHash !== request.payloadHash) {
        throw new Error('payload_hash_mismatch');
      }
      return { ...existing.receipt, status: 'duplicate' };
    }
    const receipt: SyncReceipt = {
      receiptId: randomUUID(),
      transactionId: request.transactionId,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      cloudVersion: 1
    };
    this.transactions.set(request.transactionId, { request, receipt });
    return receipt;
  }

  async receipt(transactionId: string): Promise<SyncReceipt | undefined> {
    return this.transactions.get(transactionId)?.receipt;
  }
}

