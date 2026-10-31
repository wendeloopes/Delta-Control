import { Movement, syncExternalMovements } from './storage';

declare const process: { env: Record<string, string | undefined> };

const configuredUrl = process.env.EXPO_PUBLIC_DELTA_API_URL?.trim() ?? '';
const configuredToken = process.env.EXPO_PUBLIC_DELTA_API_TOKEN?.trim() ?? '';

function pendingEndpoint(): string | null {
  if (!configuredUrl) return null;
  const base = configuredUrl.replace(/\/+$/, '');
  return base.endsWith('/api') ? base + '/pending' : base + '/api/pending';
}

function isMovement(value: unknown): value is Movement {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Movement>;
  return typeof item.id === 'string' && item.id.length > 0
    && ['entrada', 'saida', 'investimento'].includes(String(item.type))
    && typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0
    && typeof item.description === 'string' && item.description.trim().length > 0
    && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt));
}

let activeSync: Promise<number> | null = null;

/**
 * Fetches server-side pending movements, persists them locally, then acknowledges
 * their IDs. Any network/configuration error is intentionally non-fatal (offline-first).
 */
export function syncPendingMovements(): Promise<number> {
  if (activeSync) return activeSync;
  activeSync = performSync().finally(() => { activeSync = null; });
  return activeSync;
}

async function performSync(): Promise<number> {
  const endpoint = pendingEndpoint();
  if (!endpoint || !configuredToken) return 0;

  try {
    const headers = { 'x-api-key': configuredToken, Accept: 'application/json' };
    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) return 0;
    const payload = await response.json() as { movements?: unknown };
    const movements = Array.isArray(payload.movements) ? payload.movements.filter(isMovement) : [];
    if (!movements.length) return 0;

    await syncExternalMovements(movements);
    // Acknowledgement happens only after the local storage write has completed.
    const ids = movements.map(item => item.id);
    const ackUrl = endpoint + '?ack=' + encodeURIComponent(ids.join(','));
    const ackResponse = await fetch(ackUrl, { method: 'GET', headers });
    if (!ackResponse.ok) return 0;
    return movements.length;
  } catch {
    // No API configured, offline device, timeout, or server error must not break Home.
    return 0;
  }
}
