import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#070B09', panel: '#0E1311', panel2: '#151B18', border: 'rgba(255,255,255,0.07)',
  text: '#F5F7F6', muted: '#8C938F', tertiary: '#6B726E',
  green: '#3DDC84', mint: '#2ED39A', red: '#F26D6D', blue: '#7B8CF7',
  yellow: '#F59A3C', purple: '#B49AFF', track: '#1A1F1C',
};
export function Page({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.page} edges={['top','left','right']}>{children}</SafeAreaView>;
}
export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return <View style={{ marginBottom: 20 }}><Text style={styles.title}>{children}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function ActionButton({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary]}><Text style={[styles.buttonText, secondary && { color: C.text }]}>{title}</Text></Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 14, paddingTop: 8 },
  title: { color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: C.muted, fontSize: 14, marginTop: 5 },
  card: { backgroundColor: C.panel, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  button: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  buttonSecondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  buttonText: { color: '#06130B', fontSize: 14, fontWeight: '800' },
});
