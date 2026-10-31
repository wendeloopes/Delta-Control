declare const process: { env: Record<string, string | undefined> };

export type QueuedMovement = {
  id: string;
  type: 'entrada' | 'saida' | 'investimento';
  amount: number;
  description: string;
  category: string;
  createdAt: string;
  installment?: string;
  paid: boolean;
  demo: false;
  source: 'whatsapp';
};

const QUEUE_KEY = 'delta-control:pending-movements';

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN precisam estar configurados.');
  return { url, token };
}

async function redisPipeline(commands: string[][]): Promise<unknown[]> {
  const { url, token } = redisConfig();
  const response = await fetch(url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error('Falha ao acessar o armazenamento da fila.');
  const payload = await response.json() as Array<{ result?: unknown; error?: string }>;
  const failed = payload.find(item => item.error);
  if (failed?.error) throw new Error('Falha em uma operação da fila Redis.');
  return payload.map(item => item.result);
}

export function isAuthorized(request: { headers: Record<string, string | string[] | undefined> }, expected?: string): boolean {
  if (!expected) return false;
  const raw = request.headers['x-api-key'];
  const headerKey = Array.isArray(raw) ? raw[0] : raw;
  const authorization = request.headers.authorization;
  const bearer = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  return headerKey === expected || bearer === expected;
}

export async function enqueueMovement(movement: QueuedMovement, messageId: string): Promise<boolean> {
  const script = [
    "local inserted = redis.call('SET', KEYS[1], '1', 'EX', ARGV[2], 'NX')",
    "if not inserted then return 0 end",
    "redis.call('LPUSH', KEYS[2], ARGV[1])",
    "return 1",
  ].join('\n');
  const results = await redisPipeline([[
    'EVAL', script, '2', 'delta-control:processed:' + messageId,
    QUEUE_KEY, JSON.stringify(movement), '604800',
  ]]);
  return Number(results[0]) === 1;
}

export async function listPendingMovements(): Promise<QueuedMovement[]> {
  const results = await redisPipeline([['LRANGE', QUEUE_KEY, '0', '-1']]);
  const rows = Array.isArray(results[0]) ? results[0] as string[] : [];
  const movements: QueuedMovement[] = [];
  for (const row of rows) {
    try {
      const value = JSON.parse(row) as QueuedMovement;
      if (value && typeof value.id === 'string') movements.push(value);
    } catch {
      // Ignore malformed queue entries without interrupting other deliveries.
    }
  }
  return movements;
}

export async function acknowledgeMovements(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { url, token } = redisConfig();
  const current = await listPendingMovements();
  const wanted = new Set(ids);
  const commands: string[][] = [];
  for (const movement of current) {
    if (wanted.has(movement.id)) {
      commands.push(['LREM', QUEUE_KEY, '1', JSON.stringify(movement)]);
    }
  }
  if (!commands.length) return 0;
  const response = await fetch(url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error('Não foi possível confirmar a sincronização da fila.');
  const results = await response.json() as Array<{ result?: unknown; error?: string }>;
  if (results.some(item => item.error)) throw new Error('Falha ao confirmar lançamentos na fila.');
  return results.reduce((total, item) => total + Number(item.result || 0), 0);
}
