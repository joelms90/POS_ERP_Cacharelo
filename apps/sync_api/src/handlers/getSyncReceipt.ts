import { InMemoryTransactionRepository } from '../persistence/transactionRepository.js';

const repository = new InMemoryTransactionRepository();

export async function handler(event: { pathParameters?: Record<string, string | undefined> }) {
  const transactionId = event.pathParameters?.transactionId;
  if (!transactionId) {
    return response(422, { code: 'missing_transaction_id', message: 'transactionId is required' });
  }
  const receipt = await repository.receipt(transactionId);
  if (!receipt) {
    return response(404, { code: 'not_found', message: 'Receipt not found' });
  }
  return response(200, receipt);
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

