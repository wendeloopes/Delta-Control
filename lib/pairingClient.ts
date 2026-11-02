import { getOrCreateDeviceToken } from './storage';
declare const process: { env: Record<string, string | undefined> };
const configuredUrl = process.env.EXPO_PUBLIC_DELTA_API_URL?.trim() ?? '';
function pairingEndpoint(): string | null {
  if (!configuredUrl) return null;
  const base = configuredUrl.replace(/\/+$/, '');
  return base.endsWith('/api') ? base + '/pair' : base + '/api/pair';
}
/** Sends the one-time admin code only for pairing; it is never persisted or logged. */
export async function pairCurrentDevice(code: string): Promise<'paired' | 'invalid' | 'unavailable'> {
  const endpoint = pairingEndpoint();
  if (!endpoint || !/^[a-f0-9]{64}$/i.test(code.trim())) return 'invalid';
  try {
    const token = await getOrCreateDeviceToken();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: code.trim(), token }),
    });
    if (response.ok) return 'paired';
    if (response.status === 400 || response.status === 409 || response.status === 401) return 'invalid';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
