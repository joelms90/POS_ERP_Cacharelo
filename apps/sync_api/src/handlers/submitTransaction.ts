import { TransactionSyncService } from '../services/transactionSyncService.js';

const service = new TransactionSyncService();

export async function handler(event: {
  headers?: Record<string, string | undefined>;
  body?: string | null;
}) {
  const idempotencyKey = event.headers?.['Idempotency-Key'] ?? event.headers?.['idempotency-key'];
  if (!idempotencyKey) {
    return response(422, { code: 'missing_idempotency_key', message: 'Idempotency-Key is required' });
  }
  if (!event.body) {
    return response(422, { code: 'missing_body', message: 'Request body is required' });
  }
  const result = await service.submit(JSON.parse(event.body), idempotencyKey);
  return response(result.statusCode, result.body);
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

