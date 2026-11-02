import { authorizeDeviceTokenWithPairingCode } from '../server/queue';
declare const process: { env: Record<string, string | undefined> };
declare const console: { error(...args: unknown[]): void };
type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void };
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'POST') { response.status(405).json({ error: 'method_not_allowed' }); return; }
  const body = object(request.body), token = body.token, code = body.code;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) || typeof code !== 'string' || !/^[a-f0-9]{64}$/i.test(code)) {
    response.status(400).json({ error: 'invalid_pairing_request' }); return;
  }
  const configuredCode = process.env.DELTA_PAIRING_CODE;
  if (!configuredCode || !/^[a-f0-9]{64}$/i.test(configuredCode)) {
    response.status(503).json({ error: 'pairing_not_configured' }); return;
  }
  try {
    const paired = await authorizeDeviceTokenWithPairingCode(token, code, configuredCode);
    if (!paired) { response.status(409).json({ error: 'pairing_code_invalid_or_used' }); return; }
    response.status(200).json({ paired: true });
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'UnknownError';
    console.error('[device:pair] pairing_failed', detail);
    response.status(503).json({ error: 'pairing_unavailable' });
  }
}
