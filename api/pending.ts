import { acknowledgeMovements, isAuthorized, listPendingMovements } from '../server/queue';

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(value: unknown): void;
};

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const token = process.env.DELTA_SYNC_TOKEN || process.env.DELTA_API_TOKEN;
  if (!isAuthorized(request, token)) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    // The client sends ack only after AsyncStorage has accepted the batch.
    const rawAck = request.query?.ack;
    const ackValue = Array.isArray(rawAck) ? rawAck[0] : rawAck;
    const acknowledgedIds = typeof ackValue === 'string'
      ? ackValue.split(',').map(value => value.trim()).filter(Boolean).slice(0, 100)
      : [];
    const acknowledged = await acknowledgeMovements(acknowledgedIds);
    const movements = await listPendingMovements();
    response.status(200).json({ movements, acknowledged });
  } catch {
    response.status(503).json({ error: 'queue_unavailable' });
  }
}
