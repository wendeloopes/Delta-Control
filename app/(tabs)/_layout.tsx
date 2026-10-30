import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../components/ui';

const items = [
  { name: 'index', title: 'Início', icon: 'home-outline' as const },
  { name: 'movements', title: 'Movimentações', icon: 'swap-horizontal-outline' as const },
  { name: 'stats', title: 'Estatísticas', icon: 'stats-chart-outline' as const },
  { name: 'settings', title: 'Configurações', icon: 'settings-outline' as const }
];
export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false, sceneStyle: { backgroundColor: C.bg },
    tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.border, height: 65, paddingTop: 8, paddingBottom: 8 },
    tabBarActiveTintColor: C.green, tabBarInactiveTintColor: C.muted,
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' }
  }}>
    {items.map(item => <Tabs.Screen key={item.name} name={item.name} options={{
      title: item.title, tabBarIcon: ({ color, size }) => <Ionicons name={item.icon} color={color} size={size} />
    }} />)}
  </Tabs>;
}