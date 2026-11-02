import webhook from '../api/webhook';
import pending from '../api/pending';
declare const process: { env: Record<string, string | undefined> };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function responseRecorder() {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { payload = value; },
  };
  return { response, status: () => statusCode, payload: () => payload };
}
export async function runApiTests(): Promise<void> {
  const previousSecret = process.env.DELTA_API_SECRET;
  process.env.DELTA_API_SECRET = 'unit-test-secret';
  try {
    const webhookResponse = responseRecorder();
    await webhook({ method: 'POST', headers: {}, body: { data: { message: { conversation: 'gastei 20 no mercado' }, key: { id: 'abc' } } } }, webhookResponse.response);
    assert(webhookResponse.status() === 401, 'Webhook deve rejeitar requisição sem Bearer Token');

    const pendingResponse = responseRecorder();
    await pending({ method: 'GET', headers: {} }, pendingResponse.response);
    assert(pendingResponse.status() === 401, 'Pending deve rejeitar requisição sem Bearer Token');

    const legacyResponse = responseRecorder();
    await pending({ method: 'GET', headers: { 'x-api-key': 'unit-test-secret' } }, legacyResponse.response);
    assert(legacyResponse.status() === 401, 'Pending não deve aceitar x-api-key legado');

    const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
    const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const originalFetch = globalThis.fetch;
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-test-token';
    let queued: unknown;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const commands = JSON.parse(String(init?.body ?? '[]')) as string[][];
      queued = JSON.parse(commands[0][4]);
      return { ok: true, json: async () => [{ result: 1 }] } as Response;
    }) as typeof fetch;
    try {
      const accepted = responseRecorder();
      await webhook({ method: 'POST', headers: { Authorization: 'Bearer unit-test-secret' }, body: { data: { key: { id: 'msg-123', fromMe: false }, message: { conversation: 'gastei 20 no mercado' + String.fromCharCode(10, 0) } } } }, accepted.response);
      assert(accepted.status() === 200, 'Webhook autenticado deve processar texto válido');
      assert((queued as { description: string }).description === 'Mercado', 'Texto recebido deve ser sanitizado antes do parser e da fila');
      const invalidId = responseRecorder();
      await webhook({ method: 'POST', headers: { Authorization: 'Bearer unit-test-secret' }, body: { data: { key: { id: 'msg/123' }, message: { conversation: 'gastei 20 no mercado' } } } }, invalidId.response);
      assert(invalidId.status() === 400, 'IDs com caracteres inesperados devem ser rejeitados');
    } finally {
      globalThis.fetch = originalFetch;
      if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
      if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    }
  } finally {
    if (previousSecret === undefined) delete process.env.DELTA_API_SECRET; else process.env.DELTA_API_SECRET = previousSecret;
  }
}
