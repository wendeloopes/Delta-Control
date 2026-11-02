import { __setStorageAdapterForTests, loadAppData, syncExternalMovements } from '../lib/storage';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export async function runSyncClientTests(): Promise<void> {
  const memory = new Map<string, string>();
  __setStorageAdapterForTests({
    getItem: async key => memory.get(key) ?? null,
    setItem: async (key, value) => { memory.set(key, value); },
  });
  const original = await loadAppData();
  await syncExternalMovements([{ id: 'external-1', type: 'entrada', amount: 125.5, description: '  Serviço  ', category: 'Renda', createdAt: '2026-11-02T10:00:00.000Z', paid: true }]);
  const afterFirst = await loadAppData();
  assert(afterFirst.movements.some(item => item.id === 'external-1' && item.description === 'Serviço' && item.source === 'external'), 'A sincronização deve persistir e normalizar o lançamento no AsyncStorage');
  await syncExternalMovements([{ id: 'external-1', type: 'entrada', amount: 125.5, description: 'Serviço', category: 'Renda', createdAt: '2026-11-02T10:00:00.000Z' }]);
  const afterDuplicate = await loadAppData();
  assert(afterDuplicate.movements.filter(item => item.id === 'external-1').length === 1, 'IDs repetidos não devem duplicar lançamentos');
  await syncExternalMovements([{ id: 'external-invalid', type: 'saida', amount: -10, description: 'Inválido', createdAt: '2026-11-02T10:00:00.000Z' }]);
  const afterInvalid = await loadAppData();
  assert(!afterInvalid.movements.some(item => item.id === 'external-invalid'), 'Lançamentos inválidos devem ser ignorados');
  assert(afterFirst.movements.length >= original.movements.length + 1, 'Os dados locais existentes devem ser preservados');

  const previousUrl = process.env.EXPO_PUBLIC_DELTA_API_URL;
  const previousToken = process.env.EXPO_PUBLIC_DELTA_API_TOKEN;
  process.env.EXPO_PUBLIC_DELTA_API_URL = 'https://delta.example.test';
  process.env.EXPO_PUBLIC_DELTA_API_TOKEN = 'sync-test-token';
  const originalFetch = globalThis.fetch;
  const fetchedHeaders: HeadersInit[] = [];
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    fetchedHeaders.push(init?.headers ?? {});
    if (calls === 1) return { ok: true, json: async () => ({ movements: [{ id: 'external-2', type: 'investimento', amount: 50, description: 'Reserva', createdAt: '2026-11-02T11:00:00.000Z' }] }) } as Response;
    return { ok: true, json: async () => ({ acknowledged: 1 }) } as Response;
  }) as typeof fetch;
  try {
    const { syncPendingMovements } = await import('../lib/syncClient');
    assert(await syncPendingMovements() === 1, 'A sincronização remota deve retornar a quantidade confirmada');
    assert(calls === 2, 'O cliente deve buscar a fila e depois enviar ACK');
    const auth = (fetchedHeaders[0] as Record<string, string>).Authorization;
    assert(auth === 'Bearer sync-test-token', 'O cliente deve autenticar com Authorization Bearer');
    assert((await loadAppData()).movements.some(item => item.id === 'external-2'), 'O item remoto deve ser salvo localmente antes do ACK');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_DELTA_API_URL; else process.env.EXPO_PUBLIC_DELTA_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.EXPO_PUBLIC_DELTA_API_TOKEN; else process.env.EXPO_PUBLIC_DELTA_API_TOKEN = previousToken;
    __setStorageAdapterForTests(null);
  }
}
