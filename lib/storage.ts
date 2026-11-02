import AsyncStorage from '@react-native-async-storage/async-storage';
declare const require: (moduleName: string) => any;

export type Movement = {
  id: string;
  type: 'entrada' | 'saida' | 'investimento';
  amount: number;
  description: string;
  createdAt: string;
  paid?: boolean;
  installment?: string;
  demo?: boolean;
  fixed?: boolean;
  note?: string;
  category?: string;
  source?: 'voz' | 'texto' | 'manual' | 'external' | 'whatsapp';
};

export type AppData = {
  openingBalance: number;
  movements: Movement[];
  profileName?: string;
};

const STORAGE_KEY = '@delta-control:data:v1';
const DEVICE_TOKEN_KEY = 'delta-control:device-token:v1';
const emptyData: AppData = { openingBalance: 0, movements: [], profileName: '' };
const initialData: AppData = {
  openingBalance: 1250,
  profileName: '',
  movements: [
    { id: 'demo-1', type: 'entrada', amount: 2500, description: 'Salário', createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), paid: true, demo: true },
    { id: 'demo-2', type: 'saida', amount: 85.9, description: 'Mercado', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), paid: true, demo: true },
    { id: 'demo-3', type: 'saida', amount: 42, description: 'Transporte', createdAt: new Date(Date.now() - 86400000).toISOString(), paid: false, demo: true },
    { id: 'demo-4', type: 'investimento', amount: 200, description: 'Reserva financeira', createdAt: new Date().toISOString(), paid: true, demo: true },
  ],
};
type StorageAdapter = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type SecureStorageAdapter = Pick<typeof import('expo-secure-store'), 'getItemAsync' | 'setItemAsync'>;
let storageAdapter: StorageAdapter = AsyncStorage;
let secureStorageAdapter: SecureStorageAdapter | null = null;
let testRandomBytes: ((length: number) => Promise<Uint8Array>) | null = null;
function secureStore(): SecureStorageAdapter { return secureStorageAdapter ?? require('expo-secure-store') as SecureStorageAdapter; }
function secureRandomBytes(length: number): Promise<Uint8Array> { return testRandomBytes ? testRandomBytes(length) : require('expo-crypto').getRandomBytesAsync(length) as Promise<Uint8Array>; }
function toHex(bytes: Uint8Array): string { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
/** 256-bit device credential stored only in Android Keystore/iOS Keychain through SecureStore. */
export async function getOrCreateDeviceToken(): Promise<string> {
  const store = secureStore();
  const existing = await store.getItemAsync(DEVICE_TOKEN_KEY);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) return existing;
  const token = toHex(await secureRandomBytes(32));
  await store.setItemAsync(DEVICE_TOKEN_KEY, token);
  return token;
}
/** Public display identifier only; never use this value for authorization. */
export async function getOrCreateDeviceId(): Promise<string> { return (await getOrCreateDeviceToken()).slice(0, 8).toUpperCase(); }
export async function getDevicePublicId(): Promise<string> { return getOrCreateDeviceId(); }
export function __setStorageAdapterForTests(adapter: StorageAdapter | null): void { storageAdapter = adapter ?? AsyncStorage; }
export function __setSecureStoreAdapterForTests(adapter: SecureStorageAdapter | null, random?: ((length: number) => Promise<Uint8Array>) | null): void {
  secureStorageAdapter = adapter;
  testRandomBytes = random ?? null;
}
export async function loadAppData(): Promise<AppData> {
  const raw = await storageAdapter.getItem(STORAGE_KEY);
  if (!raw) {
    await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(parsed.movements) || typeof parsed.openingBalance !== 'number') throw new Error('Formato inválido');
    const migrated: AppData = {
      openingBalance: parsed.openingBalance,
      profileName: typeof parsed.profileName === 'string' ? parsed.profileName : '',
      movements: parsed.movements.map((movement) => ({
        ...movement,
        demo: typeof movement.demo === 'boolean' ? movement.demo : String(movement.id).startsWith('demo-'),
      })),
    };
    if (JSON.stringify(migrated) !== raw) await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return emptyData;
  }
}
export async function saveAppData(data: AppData): Promise<void> {
  await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(data));
}
type ExternalMovementInput = Omit<Movement, 'id'> & { id?: string };
let externalSyncQueue: Promise<void> = Promise.resolve();
function movementFingerprint(movement: Movement | ExternalMovementInput): string {
  const canonical = [
    movement.type,
    Number(movement.amount).toFixed(2),
    movement.description.trim().toLocaleLowerCase('pt-BR'),
    Number.isFinite(Date.parse(movement.createdAt)) ? new Date(movement.createdAt).toISOString() : String(movement.createdAt),
    (movement.category ?? '').trim().toLocaleLowerCase('pt-BR'),
    (movement.installment ?? '').trim().toLocaleLowerCase('pt-BR'),
  ].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
/** Adds external movements without replacing local data; repeated IDs and financial fingerprints are ignored. */
export async function syncExternalMovements(newMovements: ExternalMovementInput[]): Promise<AppData> {
  if (!Array.isArray(newMovements) || newMovements.length === 0) return loadAppData();
  const operation = externalSyncQueue.then(async () => {
    const currentData = await loadAppData();
    const knownIds = new Set(currentData.movements.map((movement) => movement.id));
    const knownFingerprints = new Set(currentData.movements.map(movementFingerprint));
    const additions: Movement[] = [];
    for (const incoming of newMovements) {
      if (!incoming || !['entrada', 'saida', 'investimento'].includes(incoming.type) || !Number.isFinite(incoming.amount) || incoming.amount <= 0 || typeof incoming.description !== 'string' || !incoming.description.trim() || typeof incoming.createdAt !== 'string' || !Number.isFinite(Date.parse(incoming.createdAt))) continue;
      const normalized: Movement = {
        ...incoming,
        id: typeof incoming.id === 'string' && incoming.id.trim() ? incoming.id.trim() : 'external-' + movementFingerprint(incoming),
        description: incoming.description.trim(),
        amount: Math.round(incoming.amount * 100) / 100,
        source: 'external',
        demo: false,
      };
      const fingerprint = movementFingerprint(normalized);
      if (knownIds.has(normalized.id) || knownFingerprints.has(fingerprint)) continue;
      knownIds.add(normalized.id);
      knownFingerprints.add(fingerprint);
      additions.push(normalized);
    }
    if (additions.length === 0) return currentData;
    const nextData: AppData = { ...currentData, movements: [...additions, ...currentData.movements] };
    await saveAppData(nextData);
    return nextData;
  });
  externalSyncQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
export async function resetAppData(): Promise<void> {
  await saveAppData({ ...emptyData });
}
export async function clearDemoData(): Promise<AppData> {
  const current = await loadAppData();
  const next = { ...current, movements: current.movements.filter((movement) => !movement.demo) };
  await saveAppData(next);
  return next;
}
