import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { C } from '../../components/ui';

const items = [
  { name: 'index', title: 'Voz', icon: 'triangle-outline' as const },
  { name: 'movements', title: 'Registros', icon: 'layers-outline' as const },
  { name: 'stats', title: 'Mês', icon: 'bar-chart-outline' as const },
  { name: 'settings', title: 'Perfil', icon: 'person-outline' as const },
];
export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    sceneStyle: { backgroundColor: C.bg },
    tabBarShowLabel: false,
    tabBarActiveTintColor: C.green,
    tabBarInactiveTintColor: C.muted,
    tabBarStyle: {
      position: 'absolute', left: '13%', width: '74%', bottom: 28,
      height: 62, paddingTop: 6, paddingBottom: 6,
      backgroundColor: '#0C1411', borderRadius: 32,
      borderWidth: 1, borderColor: 'rgba(61,220,132,0.14)',
      elevation: 0,
    },
    tabBarItemStyle: { paddingVertical: 0 },
  }}>
    {items.map(item => <Tabs.Screen key={item.name} name={item.name} options={{
      title: item.title,
      tabBarIcon: ({ color, focused }) => <View style={{
        width: 56, height: 48, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: focused ? '#123221' : 'transparent',
      }}>
        <Ionicons name={item.icon} color={color} size={24} />
        {focused ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginTop: 2 }} /> : null}
      </View>,
    }} />)}
  </Tabs>;
}
