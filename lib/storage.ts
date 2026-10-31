import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(parsed.movements) || typeof parsed.openingBalance !== 'number') throw new Error('Formato inválido');
    // Safe in-place migration: preserve existing records and mark legacy demo IDs.
    const migrated: AppData = {
      openingBalance: parsed.openingBalance,
      profileName: typeof parsed.profileName === 'string' ? parsed.profileName : '',
      movements: parsed.movements.map((movement) => ({
        ...movement,
        demo: typeof movement.demo === 'boolean' ? movement.demo : String(movement.id).startsWith('demo-'),
      })),
    };
    if (JSON.stringify(migrated) !== raw) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    // Do not delete or overwrite malformed existing user data with demo data.
    return emptyData;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}


type ExternalMovementInput = Omit<Movement, 'id'> & { id?: string };

let externalSyncQueue: Promise<void> = Promise.resolve();

function movementFingerprint(movement: Movement | ExternalMovementInput): string {
  const canonical = [
    movement.type,
    Number(movement.amount).toFixed(2),
    movement.description.trim().toLocaleLowerCase('pt-BR'),
    new Date(movement.createdAt).toISOString(),
    (movement.category ?? '').trim().toLocaleLowerCase('pt-BR'),
    (movement.installment ?? '').trim().toLocaleLowerCase('pt-BR'),
  ].join('|');

  // Deterministic FNV-1a fingerprint; avoids adding a native crypto dependency.
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Adds movements received from an external integration without replacing
 * local data. Repeated IDs or identical financial records are ignored.
 * Calls are serialized so two webhook batches cannot overwrite each other.
 */
export async function syncExternalMovements(newMovements: ExternalMovementInput[]): Promise<AppData> {
  if (!Array.isArray(newMovements) || newMovements.length === 0) {
    return loadAppData();
  }

  const operation = externalSyncQueue.then(async () => {
    const currentData = await loadAppData();
    const knownIds = new Set(currentData.movements.map((movement) => movement.id));
    const knownFingerprints = new Set(currentData.movements.map(movementFingerprint));
    const additions: Movement[] = [];

    for (const incoming of newMovements) {
      if (
        !incoming ||
        !['entrada', 'saida', 'investimento'].includes(incoming.type) ||
        !Number.isFinite(incoming.amount) ||
        incoming.amount <= 0 ||
        typeof incoming.description !== 'string' ||
        !incoming.description.trim() ||
        typeof incoming.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(incoming.createdAt))
      ) continue;

      const normalized: Movement = {
        ...incoming,
        id: typeof incoming.id === 'string' && incoming.id.trim()
          ? incoming.id.trim()
          : `external-${movementFingerprint(incoming)}`,
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

    const nextData: AppData = {
      ...currentData,
      movements: [...additions, ...currentData.movements],
    };
    await saveAppData(nextData);
    return nextData;
  });

  externalSyncQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function resetAppData(): Promise<void> {
  // Persist an empty state so clearing demos never seeds them again on next launch.
  await saveAppData({ ...emptyData });
}

export async function clearDemoData(): Promise<AppData> {
  const current = await loadAppData();
  const next = { ...current, movements: current.movements.filter((movement) => !movement.demo) };
  await saveAppData(next);
  return next;
}
