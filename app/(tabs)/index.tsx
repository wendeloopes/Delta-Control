import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Card, Page } from '../../components/ui';
import { AppData, loadAppData, saveAppData } from '../../lib/storage';
import { parseCommand } from '../../lib/parseCommand';

const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

export default function HomeScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [visible, setVisible] = useState(false);
  const [command, setCommand] = useState('');
  const { width } = useWindowDimensions();
  const refresh = useCallback(() => { loadAppData().then(setData).catch(() => Alert.alert('Erro', 'Não foi possível carregar os dados.')); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const monthMovements = useMemo(() => (data?.movements ?? []).filter(m => {
    const d = new Date(m.createdAt); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }), [data]);
  const totals = useMemo(() => {
    const income = monthMovements.filter(m => m.type === 'entrada').reduce((a, m) => a + m.amount, 0);
    const expense = monthMovements.filter(m => m.type === 'saida').reduce((a, m) => a + m.amount, 0);
    const invested = monthMovements.filter(m => m.type === 'investimento').reduce((a, m) => a + m.amount, 0);
    return { income, expense, invested, balance: income - expense };
  }, [monthMovements]);
  const progress = totals.income > 0 ? Math.min(totals.expense / totals.income, 1) : totals.expense > 0 ? 1 : 0;
  const progressWidth: `${number}%` = `${progress * 100}%`;
  const today = new Date();
  const remainingDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  const dailyAverage = totals.expense / Math.max(1, today.getDate());
  const forecast = totals.balance - dailyAverage * remainingDays;
  async function addCommand() {
    const parsed = parseQuickCommand(command);
    if (!parsed) { Alert.alert('Comando não reconhecido', 'Ex.: entrada 150 venda, saída 29,90 almoço ou investi 100 reserva.'); return; }
    try {
      const current = data ?? await loadAppData();
      const next = { ...current, movements: [{
        id: Date.now().toString(),
        type: parsed.type === 'gasto' ? 'saida' as const : parsed.type === 'ganho' ? 'entrada' as const : 'investimento' as const,
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        installment: parsed.installments ? parsed.installments + 'x' : undefined,
        createdAt: parsed.date.toISOString(),
        paid: true,
        source: 'texto' as const,
      }, ...current.movements] };
      await saveAppData(next); setData(next); setCommand(''); setVisible(false);
      Alert.alert('Salvo', 'Registro adicionado ao dispositivo.');
    } catch { Alert.alert('Erro', 'Não foi possível salvar.'); }
  }
  if (!data) return <Page><Text style={{ color: C.muted }}>Carregando Delta Control…</Text></Page>;
  const balanceColor = totals.balance < 0 ? C.red : C.mint;
  const balanceText = money(totals.balance).replace('R$', 'R$ ');
  return <Page>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
      <View style={s.header}>
        <View><Text style={s.greeting}>{greeting()}{data.profileName?.trim() ? ", " + data.profileName.trim().toLocaleUpperCase("pt-BR") : ""}</Text><Text style={s.month}>{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir comando por texto" onPress={() => setVisible(true)} style={s.keyboard}><Ionicons name="keypad-outline" color={C.text} size={23} /></Pressable>
      </View>
      <View style={s.balanceBlock}>
        <Text style={s.label}>SALDO</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[s.balance, { color: balanceColor, fontSize: width < 350 ? 43 : 53 }]}>{balanceText}</Text>
        <View style={s.progress}><View style={[s.progressFill, { width: progressWidth, backgroundColor: balanceColor }]} /></View>
        <View style={s.metrics}>
          <View style={s.metric}><View style={s.metricLabelRow}><View style={[s.dot, { backgroundColor: C.mint }]} /><Text style={s.metricLabel}>Entrou</Text></View><Text style={s.metricValue}>{money(totals.income)}</Text></View>
          <View style={s.metric}><View style={s.metricLabelRow}><View style={[s.dot, { backgroundColor: C.red }]} /><Text style={s.metricLabel}>Gastou</Text></View><Text style={s.metricValue}>{money(totals.expense)}</Text></View>
          <View style={s.metric}><View style={s.metricLabelRow}><View style={[s.dot, { backgroundColor: C.blue }]} /><Text style={s.metricLabel}>Investiu</Text></View><Text style={s.metricValue}>{money(totals.invested)}</Text></View>
        </View>
        <View style={s.forecast}><Ionicons name="calendar-outline" color={C.muted} size={15}/><Text style={s.forecastLabel}>Saldo previsto no fim do mês:</Text><Text style={[s.forecastValue, { color: balanceColor }]}>{money(forecast)}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir comando textual" onPress={() => setVisible(true)} onLongPress={() => setVisible(true)} delayLongPress={250} style={({ pressed }) => [s.logoArea, pressed && { transform: [{ scale: 1.02 }] }]}>
        <View style={s.glow} /><View style={s.logoOuter}/><View style={s.logoInner}/>
      </Pressable>
      <Text style={s.voiceTitle}>Toque ou segure para falar</Text>
      <Text style={s.voiceHint}>Comando por texto disponível nesta versão</Text>
      <Text style={s.example}>experimente: “gastei 32 no uber”</Text>
    </ScrollView>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={s.backdrop}><View style={s.modal}><View style={s.handle}/><Text style={s.modalTitle}>Comando Delta</Text><Text style={s.modalHint}>Digite uma entrada, gasto ou investimento.</Text>
        <TextInput value={command} onChangeText={setCommand} placeholder="Ex.: gastei 32 no uber" placeholderTextColor={C.tertiary} autoCapitalize="sentences" style={s.input}/>
        <View style={s.chips}><Text onPress={() => setCommand('entrada 150 venda')} style={s.chip}>+ entrada 150</Text><Text onPress={() => setCommand('saída 29,90 almoço')} style={s.chip}>− saída 29,90</Text><Text onPress={() => setCommand('investi 100 reserva')} style={s.chip}>↗ investi 100</Text></View>
        <Pressable style={s.save} onPress={addCommand}><Text style={s.saveText}>Salvar registro</Text></Pressable><Pressable onPress={() => setVisible(false)} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: C.muted }}>Cancelar</Text></Pressable>
      </View></View>
    </Modal>
  </Page>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  greeting: { color: C.text, fontSize: 20, fontWeight: '700' }, month: { color: C.muted, fontSize: 14, marginTop: 5, textTransform: 'capitalize' },
  keyboard: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  balanceBlock: { alignItems: 'center', paddingTop: 7 },
  label: { color: C.muted, fontSize: 13, letterSpacing: 3, fontWeight: '500' },
  balance: { fontWeight: '700', letterSpacing: -2, marginTop: 6, marginBottom: 18, fontVariant: ['tabular-nums'] },
  progress: { width: '100%', height: 7, borderRadius: 9, backgroundColor: C.track, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 9 },
  metrics: { width: '100%', flexDirection: 'row', marginTop: 23, marginBottom: 18 },
  metric: { flex: 1, alignItems: 'center' }, metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 }, metricLabel: { color: C.muted, fontSize: 12 },
  metricValue: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] },
  forecast: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.panel2, borderRadius: 30, paddingHorizontal: 14, paddingVertical: 11, flexWrap: 'wrap', justifyContent: 'center' },
  forecastLabel: { color: C.muted, fontSize: 11 }, forecastValue: { fontSize: 12, fontWeight: '800' },
  logoArea: { height: 300, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  glow: { position: 'absolute', width: 245, height: 245, borderRadius: 125, backgroundColor: '#123D25', opacity: .42 },
  logoOuter: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 116, borderRightWidth: 116, borderBottomWidth: 204, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#F5F7F6' },
  logoInner: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 93, borderRightWidth: 93, borderBottomWidth: 164, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.bg, top: 72 },
  voiceTitle: { color: C.text, textAlign: 'center', fontSize: 17, fontWeight: '600', marginTop: 1 },
  voiceHint: { color: C.muted, textAlign: 'center', fontSize: 12, marginTop: 9 },
  example: { color: C.tertiary, textAlign: 'center', fontSize: 11, marginTop: 23 },
  backdrop: { flex: 1, backgroundColor: '#000D', justifyContent: 'flex-end' }, modal: { backgroundColor: C.panel, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 21, paddingBottom: 30, borderWidth: 1, borderColor: C.border },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: '800' }, modalHint: { color: C.muted, fontSize: 12, marginTop: 5 },
  input: { backgroundColor: C.bg, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 15, fontSize: 15, marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 }, chip: { color: C.green, fontSize: 10, fontWeight: '800', backgroundColor: '#17271C', padding: 9, borderRadius: 9, overflow: 'hidden' },
  save: { backgroundColor: C.green, borderRadius: 13, padding: 15, alignItems: 'center' }, saveText: { color: '#06130B', fontWeight: '900' },
});
