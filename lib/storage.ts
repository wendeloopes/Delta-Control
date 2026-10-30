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
  category?: string;\n  source?: 'voz' | 'texto' | 'manual';
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
