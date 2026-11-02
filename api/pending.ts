import { acknowledgeMovements, isAuthorized, listPendingMovements } from '../server/queue';
declare const process: { env: Record<string, string | undefined> };
declare const console: { error(...args: unknown[]): void };
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void };
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'GET') { response.status(405).json({ error: 'method_not_allowed' }); return; }
  if (!isAuthorized(request, process.env.DELTA_API_SECRET)) { response.status(401).json({ error: 'unauthorized' }); return; }
  try {
    const raw = request.query?.ack, value = Array.isArray(raw) ? raw[0] : raw;
    const ids = typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(v => /^[A-Za-z0-9._:@-]{1,200}$/.test(v)).slice(0, 100) : [];
    // Acknowledge only IDs explicitly returned by the client after local persistence.
    const acknowledged = await acknowledgeMovements(ids);
    const movements = await listPendingMovements();
    response.status(200).json({ movements, acknowledged });
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'UnknownError';
    console.error('[whatsapp:pending] queue_operation_failed', detail);
    response.status(503).json({ error: 'queue_unavailable' });
  }
}
