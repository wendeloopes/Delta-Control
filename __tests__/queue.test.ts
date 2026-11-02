import { acknowledgeMovements, enqueueMovement, isAuthorized, listPendingMovements, QueuedMovement } from '../server/queue';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export async function runQueueTests(): Promise<void> {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-test-token';
  const calls: string[][][] = [];
  let enqueueCount = 0;
  const movement: QueuedMovement = { id: 'whatsapp-msg-1', type: 'saida', amount: 12.5, description: 'Almoço', category: 'Alimentação', createdAt: '2026-11-02T12:00:00.000Z', paid: true, demo: false, source: 'whatsapp' };
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const commands = JSON.parse(String(init?.body ?? '[]')) as string[][];
    calls.push(commands);
    if (commands[0]?.[0] === 'EVAL') {
      enqueueCount += 1;
      return { ok: true, json: async () => [{ result: enqueueCount === 1 ? 1 : 0 }] } as Response;
    }
    if (commands[0]?.[0] === 'LRANGE') {
      return { ok: true, json: async () => [{ result: [JSON.stringify(movement)] }] } as Response;
    }
    if (commands[0]?.[0] === 'LREM') {
      return { ok: true, json: async () => [{ result: 1 }] } as Response;
    }
    throw new Error('Comando Redis inesperado');
  }) as typeof fetch;
  try {
    assert(await enqueueMovement(movement, 'msg-1'), 'A primeira mensagem deve entrar na fila');
    assert(!(await enqueueMovement(movement, 'msg-1')), 'A mesma mensagem deve ser deduplicada');
    assert(calls[0][0][0] === 'EVAL' && calls[0][0][1].includes("'NX'"), 'Deduplicação deve usar SET NX atômico');
    const pending = await listPendingMovements();
    assert(pending.length === 1 && pending[0].id === movement.id, 'A fila deve retornar o lançamento persistido');
    assert(await acknowledgeMovements([movement.id]) === 1, 'O ACK deve remover somente o item confirmado');
    assert(calls.some(batch => batch[0]?.[0] === 'LREM'), 'O ACK deve usar LREM, sem apagar a fila inteira');
    assert(isAuthorized({ headers: { Authorization: 'Bearer secret' } }, 'secret'), 'Bearer válido deve ser aceito');
    assert(!isAuthorized({ headers: { 'x-api-key': 'secret' } }, 'secret'), 'x-api-key legado deve ser rejeitado');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
}
