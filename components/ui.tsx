import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const C = {
  bg: '#0B0D12', panel: '#12151D', panel2: '#191E28', border: '#272D39',
  text: '#F4F6FA', muted: '#8D95A5', green: '#71F0A2', red: '#FF7777',
  blue: '#8BAAFF', yellow: '#F4CE75'
};

export function Page({ children }: { children: React.ReactNode }) {
  return <View style={styles.page}>{children}</View>;
}
export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return <View style={{ marginBottom: 22 }}>
    <Text style={styles.title}>{children}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function ActionButton({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary]}>
    <Text style={[styles.buttonText, secondary && { color: C.text }]}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 22 },
  title: { color: C.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 5 },
  card: { backgroundColor: C.panel, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  button: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  buttonSecondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  buttonText: { color: '#08110C', fontSize: 14, fontWeight: '800' }
});