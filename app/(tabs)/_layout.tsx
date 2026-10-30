import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../components/ui';

const items = [
  { name: 'index', title: 'Voz', icon: 'triangle-outline' as const },
  { name: 'movements', title: 'Registros', icon: 'layers-outline' as const },
  { name: 'stats', title: 'Mês', icon: 'bar-chart-outline' as const },
  { name: 'settings', title: 'Perfil', icon: 'person-outline' as const },
];

function DeltaDock({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dockWidth = Math.min(width - 152, 360);

  return (
    <View pointerEvents="box-none" style={[styles.outer, { bottom: insets.bottom + 12 }]}>
      <View style={[styles.pill, { width: dockWidth }]}>
        {state.routes.map((route: any, index: number) => {
          const item = items.find(entry => entry.name === route.name);
          if (!item) return null;
          const focused = state.index === index;
          const color = focused ? C.green : C.muted;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options?.tabBarAccessibilityLabel ?? item.title}
              testID={descriptors[route.key]?.options?.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.slot}
            >
              <View style={[styles.activeSlot, focused && styles.activeSlotSelected]}>
                <Ionicons name={item.icon} color={color} size={24} />
                {focused ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <DeltaDock {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarShowLabel: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
      }}
    >
      {items.map(item => (
        <Tabs.Screen key={item.name} name={item.name} options={{ title: item.title }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    height: 52,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(61,220,132,0.14)',
    backgroundColor: '#0C1411',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSlot: {
    width: 62,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSlotSelected: {
    backgroundColor: '#123221',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.green,
    marginTop: 2,
  },
});
