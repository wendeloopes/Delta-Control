import AsyncStorage from '@react-native-async-storage/async-storage';

export type Movement = {
  id: string;
  type: 'entrada' | 'saida';
  amount: number;
  description: string;
  createdAt: string;
};
export type AppData = { openingBalance: number; movements: Movement[] };
const STORAGE_KEY = '@delta-control:data:v1';
const initialData: AppData = {
  openingBalance: 1250,
  movements: [
    { id: 'demo-1', type: 'entrada', amount: 2500, description: 'Salário (demonstração)', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: 'demo-2', type: 'saida', amount: 85.9, description: 'Mercado (demonstração)', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'demo-3', type: 'saida', amount: 42, description: 'Transporte (demonstração)', createdAt: new Date(Date.now() - 86400000).toISOString() }
  ]
};
export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  try {
    const parsed = JSON.parse(raw) as AppData;
    if (!Array.isArray(parsed.movements) || typeof parsed.openingBalance !== 'number') throw new Error('Formato de dados inválido');
    return parsed;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
}
export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export async function resetAppData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}