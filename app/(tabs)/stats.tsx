import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Card, Page } from '../../components/ui';
import { AppData, Movement, loadAppData } from '../../lib/storage';

const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percentWidth = (part: number, total: number): `${number}%` => `${total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0}%`;
const palette = ['#9EA0A6', '#FF9A3D', C.blue, C.mint, C.green, C.purple];
export default function StatsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [offset, setOffset] = useState(0);
  const refresh = useCallback(() => { loadAppData().then(setData).catch(() => Alert.alert('Erro', 'Não foi possível carregar a análise.')); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const month = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
  const now = new Date();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
  const movements = useMemo(() => (data?.movements ?? []).filter(x => { const d = new Date(x.createdAt); return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth(); }), [data, offset]);
  const totals = useMemo(() => {
    const income = movements.filter(x => x.type === 'entrada').reduce((a, x) => a + x.amount, 0);
    const expense = movements.filter(x => x.type === 'saida').reduce((a, x) => a + x.amount, 0);
    const invested = movements.filter(x => x.type === 'investimento').reduce((a, x) => a + x.amount, 0);
    return { income, expense, invested, balance: income - expense };
  }, [movements]);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    movements.filter(x => x.type === 'saida').forEach(x => {
      const text = x.description.toLocaleLowerCase('pt-BR');
      const key = /almo[cç]|comida|restaurante|lanche|mercado|supermercado/.test(text) ? 'Alimentação' : 'Outros';
      map.set(key, (map.get(key) ?? 0) + x.amount);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [movements]);
  const expenses = movements.filter(x => x.type === 'saida').sort((a, b) => b.amount - a.amount);
  const daily = Array.from({ length: daysInMonth }, (_, i) => movements.filter(m => m.type === 'saida' && new Date(m.createdAt).getDate() === i + 1).reduce((a, m) => a + m.amount, 0));
  const maxDay = Math.max(1, ...daily);
  const totalCat = categories.reduce((a, x) => a + x[1], 0);
  const circumference = 2 * Math.PI * 48;
  let accumulated = 0;
  const elapsed = isCurrentMonth ? Math.max(1, now.getDate()) : month.getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime() ? daysInMonth : 1;
  const remaining = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : 0;
  const average = totals.expense / elapsed;
  const forecast = totals.balance - average * remaining;
  const daysLabel = !isCurrentMonth ? (month.getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime() ? 'Mês fechado' : 'Mês futuro') : remaining === 0 ? 'Último dia' : `Faltam ${remaining} dias`;
  const installments = movements.filter(x => x.type === 'saida' && !!x.installment);
  const savings = totals.income > 0 ? percentWidth(Math.max(0, totals.income - totals.expense - totals.invested), totals.income) : '—';
  const investedPercent = totals.income > 0 ? percentWidth(totals.invested, totals.income) : '—';
  if (!data) return <Page><Text style={{ color: C.muted }}>Carregando análise…</Text></Page>;
  return <Page>
    <View style={s.header}><Text style={s.title}>Mês</Text><View style={s.monthPicker}>
      <Pressable onPress={() => setOffset(v => v - 1)}><Ionicons name="chevron-back" color={C.green} size={18}/></Pressable>
      <Text style={s.month}>{month.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</Text>
      <Pressable disabled={offset >= 0} onPress={() => setOffset(v => v + 1)}><Ionicons name="chevron-forward" color={offset >= 0 ? C.tertiary : C.green} size={18}/></Pressable>
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
      <Card style={s.hero}>
        <Text style={s.label}>SALDO ATÉ AGORA EM {month.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[s.balance, { color: totals.balance < 0 ? C.red : C.mint }]}>{money(totals.balance)}</Text>
        <Text style={s.explain}>o que entrou menos o que foi gasto (o que você investiu continua seu)</Text>
        <View style={s.daysPill}><Ionicons name="calendar-outline" color={C.muted} size={14}/><Text style={s.daysText}>{daysLabel}</Text></View>
        <View style={s.divider}/>
        <View style={s.forecastRow}><Text style={s.forecastLabel}>Saldo previsto no fim do mês</Text><Text style={[s.forecastValue, { color: forecast < 0 ? C.red : C.mint }]}>{money(forecast)}</Text></View>
      </Card>
      <Card>
        <View style={s.cardHeading}><Text style={s.cardTitle}>Como o dinheiro se dividiu</Text><Text style={s.cardMeta}>{movements.length} lançamentos</Text></View>
        <StatRow icon="add" title="Entrou" detail="—" value={money(totals.income)} color={C.mint}/>
        <StatRow icon="remove" title="Gastou" detail="—" value={money(totals.expense)} color={C.red}/>
        <StatRow icon="reorder-two" title="Saldo do mês" detail="" value={money(totals.balance)} color={totals.balance < 0 ? C.red : C.mint} last/>
      </Card>
      <View style={s.miniRow}>
        <Mini icon="wallet-outline" value={savings} caption="do que entrou foi guardado"/>
        <Mini icon="trending-up-outline" value={investedPercent} caption="do que entrou foi investido"/>
        <Mini icon="speedometer-outline" value={money(average)} caption="gasto médio por dia"/>
      </View>
      {installments.length > 0 && <Card><View style={s.cardHeading}><Text style={s.cardTitle}>Parcelamentos</Text><Text style={s.cardMeta}>{money(installments.reduce((a, x) => a + x.amount, 0))} neste mês</Text></View>
        {installments.map(m => <View key={m.id} style={s.installmentRow}><Ionicons name="layers-outline" color={C.green} size={20}/><View style={{ flex: 1 }}><Text style={s.rowTitle}>{m.description}</Text><Text style={s.rowSub}>{m.installment}</Text></View><Text style={s.installmentValue}>{money(m.amount)}</Text></View>)}
      </Card>}
      <Card>
        <View style={s.cardHeading}><Text style={s.cardTitle}>Gastos por categoria</Text><Text style={s.cardMeta}>{categories.length} categorias</Text></View>
        {totalCat === 0 ? <Text style={s.empty}>Sem gastos neste mês.</Text> : <View style={s.categoryLayout}>
          <View style={s.donutWrap}><Svg width={158} height={158} viewBox="0 0 120 120"><Circle cx="60" cy="60" r="48" stroke={C.track} strokeWidth="13" fill="none"/>{categories.map((item, i) => { const length = item[1] / totalCat * circumference; const element = <Circle key={item[0]} cx="60" cy="60" r="48" stroke={item[0] === 'Alimentação' ? '#FF9A3D' : palette[i % palette.length]} strokeWidth="13" fill="none" strokeDasharray={length + ' ' + (circumference - length)} strokeDashoffset={-accumulated} strokeLinecap="round" transform="rotate(-90 60 60)"/>; accumulated += length; return element; })}</Svg><View style={s.donutCenter}><Text style={s.donutTotal}>{money(totalCat)}</Text><Text style={s.donutSub}>em gastos</Text></View></View>
          <View style={{ flex: 1 }}>{categories.map((item, i) => <View key={item[0]} style={s.legend}><View style={[s.legendDot, { backgroundColor: item[0] === 'Alimentação' ? '#FF9A3D' : palette[i % palette.length] }]}/><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.legendName}>{item[0]}</Text><Text style={s.legendPercent}>{Math.round(item[1] / totalCat * 100)}%</Text></View><Text style={s.legendValue}>{money(item[1])}</Text></View>)}</View>
        </View>}
      </Card>
      <Card><View style={s.cardHeading}><Text style={s.cardTitle}>Gastos por dia</Text><Text style={s.cardMeta}>média diária: {money(average)}</Text></View>
        <View style={s.chart}>{daily.map((value, i) => <View key={i} style={s.barGroup}><View style={s.barTrack}><View style={[s.bar, { height: value > 0 ? (Math.max(4, value / maxDay * 100) + '%') as `${number}%` : 0 }]}/></View>{(i === 0 || i === 15 || i === daysInMonth - 1) ? <Text style={s.barLabel}>{i + 1}</Text> : null}</View>)}</View>
      </Card>
      <Card><Text style={s.cardTitle}>Maiores gastos</Text>{expenses.length === 0 ? <Text style={s.empty}>Nenhum gasto registrado.</Text> : expenses.slice(0, 5).map((m, i) => <View key={m.id} style={[s.topExpense, i > 0 && s.topDivider]}><View style={s.categoryIcon}><Ionicons name="ellipse-outline" color={C.yellow} size={18}/></View><View style={{ flex: 1 }}><Text style={s.rowTitle}>{m.description}</Text><Text style={s.rowSub}>{/almo[cç]|comida|restaurante|lanche|mercado/i.test(m.description) ? 'Alimentação' : 'Outros'} · {new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text></View><Text style={s.topValue}>{money(m.amount)}</Text></View>)}</Card>
      <Card style={s.deltaCard}><View style={s.deltaHeader}><Ionicons name="sparkles" color={C.green} size={19}/><Text style={s.deltaTitle}>Análise Delta</Text></View>
        <Text style={s.deltaText}>A análise completa aparece quando o mês fechar. Quer uma prévia com o que já tem?</Text>
        <Pressable onPress={() => Alert.alert('Prévia local', totals.expense === 0 ? 'Ainda não há gastos registrados neste mês.' : totals.balance >= 0 ? 'Seu saldo está positivo com base nos lançamentos locais.' : 'Os gastos superam as entradas registradas neste mês. Revise seus lançamentos.')} style={s.generate}><Ionicons name="refresh" color={C.text} size={16}/><Text style={s.generateText}>Gerar análise agora</Text></Pressable>
        <Text style={s.disclaimer}>Orientação geral gerada localmente, com base nos seus lançamentos. Não é recomendação de investimento personalizada.</Text>
      </Card>
    </ScrollView>
  </Page>;
}
function StatRow({ icon, title, detail, value, color, last }: { icon: any; title: string; detail: string; value: string; color: string; last?: boolean }) {
  return <View style={[s.statRow, !last && s.statDivider]}><View style={[s.statIcon, { backgroundColor: color === C.red ? '#2A1517' : color === C.mint ? '#10281F' : '#202422' }]}><Ionicons name={icon} color={color} size={17}/></View><View style={{ flex: 1 }}><Text style={s.statTitle}>{title}</Text>{detail ? <Text style={s.rowSub}>{detail}</Text> : null}</View><Text style={[s.statValue, { color }]}>{value}</Text></View>;
}
function Mini({ icon, value, caption }: { icon: any; value: string; caption: string }) {
  return <View style={s.mini}><Ionicons name={icon} color={C.muted} size={19}/><Text adjustsFontSizeToFit numberOfLines={1} style={s.miniValue}>{value}</Text><Text style={s.miniCaption}>{caption}</Text></View>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, title: { color: C.text, fontSize: 28, fontWeight: '700' },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.panel, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17, borderWidth: 1, borderColor: C.border },
  month: { color: C.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  hero: { backgroundColor: '#0D1712', borderColor: 'rgba(61,220,132,0.13)', padding: 19, alignItems: 'center' },
  label: { color: C.muted, fontSize: 10, letterSpacing: 2.2, textAlign: 'center' }, balance: { fontSize: 43, fontWeight: '700', letterSpacing: -1.5, marginTop: 10, fontVariant: ['tabular-nums'] },
  explain: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 9 }, daysPill: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: C.panel2, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 8, marginTop: 14 },
  daysText: { color: C.muted, fontSize: 11 }, divider: { height: 1, backgroundColor: C.border, alignSelf: 'stretch', marginVertical: 15 },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', alignItems: 'center' }, forecastLabel: { color: C.text, fontSize: 11 }, forecastValue: { fontSize: 13, fontWeight: '800' },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13, gap: 8 }, cardTitle: { color: C.text, fontSize: 16, fontWeight: '700', flexShrink: 1 }, cardMeta: { color: C.muted, fontSize: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }, statDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, statTitle: { color: C.text, fontSize: 12, fontWeight: '600' }, statValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }, rowSub: { color: C.muted, fontSize: 10, marginTop: 4 },
  miniRow: { flexDirection: 'row', gap: 7, marginBottom: 12 }, mini: { flex: 1, minHeight: 117, borderRadius: 17, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, padding: 10, justifyContent: 'space-between' },
  miniValue: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 8 }, miniCaption: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 5 },
  installmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, rowTitle: { color: C.text, fontSize: 12, fontWeight: '600' }, track: { height: 6, backgroundColor: C.track, borderRadius: 5, marginTop: 8, overflow: 'hidden' }, fill: { height: 6, width: '50%', backgroundColor: C.green, borderRadius: 5 }, installmentValue: { color: C.red, fontSize: 12, fontWeight: '700' },
  categoryLayout: { flexDirection: 'row', alignItems: 'center', gap: 10 }, donutWrap: { width: 158, height: 158, alignItems: 'center', justifyContent: 'center' }, donutCenter: { position: 'absolute', alignItems: 'center' }, donutTotal: { color: C.text, fontSize: 12, fontWeight: '800' }, donutSub: { color: C.muted, fontSize: 10, marginTop: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendName: { color: C.text, fontSize: 10 }, legendPercent: { color: C.muted, fontSize: 9, marginTop: 2 }, legendValue: { color: C.text, fontSize: 10, fontWeight: '600' },
  chart: { height: 145, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: 8 }, barGroup: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }, barTrack: { width: '70%', height: 105, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 4 }, bar: { width: '100%', backgroundColor: C.red, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, barLabel: { color: C.muted, fontSize: 8, marginTop: 5 },
  topExpense: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, topDivider: { borderTopWidth: 1, borderTopColor: C.border }, categoryIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#2A1A0F', alignItems: 'center', justifyContent: 'center' }, topValue: { color: C.text, fontSize: 12, fontWeight: '700' },
  deltaCard: { backgroundColor: '#0C1A13', borderColor: '#2E8B57' }, deltaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, deltaTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  deltaText: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 12 }, generate: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#131A17', borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 13, marginTop: 14 }, generateText: { color: C.text, fontSize: 12, fontWeight: '600' }, disclaimer: { color: C.tertiary, fontSize: 9, lineHeight: 14, marginTop: 12 },
  empty: { color: C.muted, fontSize: 11 },
});
