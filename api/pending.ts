import { acknowledgeMovements, isAuthorizedDeviceToken, listPendingMovements } from '../server/queue';
declare const console: { error(...args: unknown[]): void };
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void };
function bearerToken(request: ApiRequest): string | null {
  const entry = Object.entries(request.headers ?? {}).find(([name]) => name.toLowerCase() === 'authorization')?.[1];
  const value = Array.isArray(entry) ? entry[0] : entry;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^Bearer\s+([A-Za-z0-9_-]{32,256})$/i);
  return match?.[1] ?? null;
}
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'GET') { response.status(405).json({ error: 'method_not_allowed' }); return; }
  const token = bearerToken(request);
  if (!token) { response.status(401).json({ error: 'unauthorized' }); return; }
  try {
    if (!(await isAuthorizedDeviceToken(token))) { response.status(401).json({ error: 'unauthorized' }); return; }
    const raw = request.query?.ack, value = Array.isArray(raw) ? raw[0] : raw;
    const ids = typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(v => /^[A-Za-z0-9._:@-]{1,200}$/.test(v)).slice(0, 100) : [];
    const acknowledged = await acknowledgeMovements(ids);
    const movements = await listPendingMovements();
    response.status(200).json({ movements, acknowledged });
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'UnknownError';
    console.error('[whatsapp:pending] queue_operation_failed', detail);
    response.status(503).json({ error: 'queue_unavailable' });
  }
}
