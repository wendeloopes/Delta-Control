declare const process: { env: Record<string, string | undefined> };
import { __setStorageAdapterForTests, getOrCreateDeviceId, loadAppData, syncExternalMovements } from '../lib/storage';

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
  const firstDeviceId = await getOrCreateDeviceId();
  const secondDeviceId = await getOrCreateDeviceId();
  assert(firstDeviceId === secondDeviceId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstDeviceId), 'Device ID deve ser UUID persistido e reutilizado no AsyncStorage');
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
  process.env.EXPO_PUBLIC_DELTA_API_URL = 'https://delta.example.test';
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
    const sentDeviceId = (fetchedHeaders[0] as Record<string, string>)['x-device-id'];
    assert(sentDeviceId === firstDeviceId, 'Cliente deve enviar x-device-id persistido ao endpoint pending');
    assert(!('Authorization' in (fetchedHeaders[0] as Record<string, string>)), 'Cliente não deve enviar segredo Bearer do servidor');
    assert((fetchedHeaders[1] as Record<string, string>)['x-device-id'] === firstDeviceId, 'ACK deve enviar o mesmo x-device-id');
    assert((await loadAppData()).movements.some(item => item.id === 'external-2'), 'O item remoto deve ser salvo localmente antes do ACK');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_DELTA_API_URL; else process.env.EXPO_PUBLIC_DELTA_API_URL = previousUrl;
    __setStorageAdapterForTests(null);
  }
}
