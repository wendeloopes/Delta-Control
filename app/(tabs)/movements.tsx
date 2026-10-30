import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Card, Page } from '../../components/ui';
import { AppData, loadAppData, Movement, saveAppData } from '../../lib/storage';

const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
type Filter = 'Tudo' | 'Gastos' | 'Ganhos' | 'Investimentos';
export default function MovementsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [filter, setFilter] = useState<Filter>('Tudo');
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<'entrada' | 'saida' | 'investimento'>('saida');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [dateText, setDateText] = useState('');
  const [fixed, setFixed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [offset, setOffset] = useState(0);
  const refresh = useCallback(() => { loadAppData().then(setData).catch(() => Alert.alert('Erro', 'Não foi possível carregar os registros.')); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const month = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
  const list = useMemo(() => (data?.movements ?? []).filter(m => {
    const d = new Date(m.createdAt);
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, offset]);
  const expenses = list.filter(m => m.type === 'saida');
  const incomes = list.filter(m => m.type === 'entrada');
  const investments = list.filter(m => m.type === 'investimento');
  const pending = expenses.filter(m => m.paid === false).length;
  const sum = (items: Movement[]) => items.reduce((a, m) => a + m.amount, 0);
  function openEditor(item?: Movement) {
    setEditing(item ?? null);
    setKind(item?.type ?? 'saida');
    setAmount(item ? String(item.amount).replace('.', ',') : '');
    setDescription(item?.description ?? '');
    setCategory(item?.category ?? ''); setNote(item?.note ?? '');
    setDateText(item ? new Date(item.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'));
    setFixed(item?.fixed ?? false); setPaid(item ? item.paid !== false : false);
    setVisible(true);
  }
  async function add() {
    const value = Number(amount.replace(/\\./g, '').replace(',', '.'));
    if (!description.trim() || !Number.isFinite(value) || value <= 0) { Alert.alert('Confira os dados', 'Informe descrição e valor maior que zero.'); return; }
    const parts = dateText.trim().split('/');
    if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }
    const parsedDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12);
    if (parsedDate.getDate() !== Number(parts[0]) || parsedDate.getMonth() !== Number(parts[1]) - 1) { Alert.alert('Data inválida', 'Confira a data informada.'); return; }
    try {
      const current = data ?? await loadAppData();
      const item: Movement = { ...(editing ?? {} as Movement), id: editing?.id ?? Date.now().toString(), type: kind, amount: value, description: description.trim(), createdAt: parsedDate.toISOString(), paid: kind !== 'saida' ? true : paid, fixed, category: category.trim() || undefined, note: note.trim() || undefined, installment: editing?.installment, demo: editing?.demo ?? false };
      const movements = editing ? current.movements.map(m => m.id === editing.id ? item : m) : [item, ...current.movements];
      const next = { ...current, movements };
      await saveAppData(next); setData(next); setVisible(false); setAmount(''); setDescription(''); setEditing(null);
    } catch { Alert.alert('Erro', 'Não foi possível salvar.'); }
  }
  async function togglePaid(item: Movement) {
    if (!data) return;
    const next = { ...data, movements: data.movements.map(m => m.id === item.id ? { ...m, paid: !m.paid } : m) };
    await saveAppData(next); setData(next);
  }
  const categoryIcon = (m: Movement) => /almo[cç]|comida|restaurante|lanche/i.test(m.description) ? 'restaurant-outline' : 'ellipse-outline';
  const show = (section: Filter) => filter === 'Tudo' || filter === section;
  const Section = ({ title, count, total, color, children, chip }: { title: string; count: number; total: number; color: string; children: React.ReactNode; chip?: string }) =>
    <View style={s.section}><View style={s.sectionHeader}><View style={s.sectionName}><View style={[s.dot, { backgroundColor: color }]} /><Text style={s.sectionTitle}>{title}</Text><Text style={s.count}>{count}</Text>{chip ? <Text style={s.pendingChip}>{chip}</Text> : null}</View><Text style={[s.sectionTotal, { color }]}>{money(total)}</Text></View>{children}</View>;
  const Empty = ({ title, hint }: { title: string; hint: string }) => <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyHint}>{hint}</Text></View>;
  if (!data) return <Page><Text style={{ color: C.muted }}>Carregando registros…</Text></Page>;
  return <Page>
    <View style={s.header}><Text style={s.title}>Registros</Text><View style={s.monthPicker}><Pressable onPress={() => setOffset(v => v - 1)}><Ionicons name="chevron-back" color={C.green} size={18}/></Pressable><Text style={s.month}>{month.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</Text><Pressable disabled={offset >= 0} onPress={() => setOffset(v => v + 1)}><Ionicons name="chevron-forward" color={offset >= 0 ? C.tertiary : C.green} size={18}/></Pressable></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters} contentContainerStyle={{ paddingBottom: 15 }}>
      {(['Tudo', 'Gastos', 'Ganhos', 'Investimentos'] as Filter[]).map(f => <Pressable key={f} onPress={() => setFilter(f)} style={[s.pill, filter === f && s.pillActive]}><Text style={[s.pillText, filter === f && s.pillTextActive]}>{f}</Text></Pressable>)}
    </ScrollView>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
      {show('Tudo') && <Section title="Fixos" count={0} total={0} color={C.green}><Empty title="Nenhum fixo ainda" hint="Ao lançar, ligue “Fixo” para repetir todo mês"/></Section>}
      {show('Gastos') && <Section title="Gastos" count={expenses.length} total={sum(expenses)} color={C.red} chip={pending ? pending + ' a confirmar' : undefined}>
        {expenses.length === 0 ? <Empty title="Nenhum gasto ainda" hint="Fale na aba Voz ou toque no +"/> :
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {expenses.map(m => <View key={m.id} style={s.expenseWrap}><Pressable onPress={() => openEditor(m)}><Card style={s.expenseCard}>
              <View style={s.expenseTop}><View style={s.categoryIcon}><Ionicons name={categoryIcon(m) as any} color={C.yellow} size={21}/></View>{m.installment ? <Text style={s.installment}><Ionicons name="layers-outline" color={C.green} size={11}/> {m.installment}</Text> : null}</View>
              <Text style={s.value}>{money(m.amount)}</Text><Text numberOfLines={2} style={s.description}>{m.description}</Text>
              <View style={s.cardFooter}><Text style={s.date}>{new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</Text><Ionicons name="chatbubble-outline" color={C.muted} size={15}/></View>
            </Card></Pressable>
            {m.paid === false ? <Pressable onPress={() => togglePaid(m)} style={s.payButton}><Ionicons name="radio-button-off" color={C.muted} size={15}/><Text style={s.payText}>Marcar pago</Text></Pressable> : <View style={[s.payButton, s.paidButton]}><Ionicons name="checkmark-circle" color={C.mint} size={15}/><Text style={[s.payText, { color: C.mint }]}>Pago</Text></View>}</View>)}
          </ScrollView>}
      </Section>}
      {show('Ganhos') && <Section title="Ganhos" count={incomes.length} total={sum(incomes)} color={C.mint}>{incomes.length ? incomes.map(m => <MovementRow key={m.id} item={m} color={C.mint} onPress={() => openEditor(m)}/>) : <Empty title="Nada em ganhos ainda" hint="Fale na aba Voz ou toque no +"/>}</Section>}
      {show('Investimentos') && <Section title="Investimentos" count={investments.length} total={sum(investments)} color={C.blue}>{investments.length ? investments.map(m => <MovementRow key={m.id} item={m} color={C.blue} onPress={() => openEditor(m)}/>) : <Empty title="Nada em investimentos ainda" hint="Fale na aba Voz ou toque no +"/>}</Section>}
    </ScrollView>
    <Pressable onPress={() => openEditor()} style={s.fab}><Ionicons name="add" color="#06130B" size={30}/></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.handle}/><Text style={s.modalTitle}>{editing ? 'Editar registro' : 'Novo registro'}</Text>
      <View style={s.kindRow}>{([{ v: 'saida', t: 'Gasto' }, { v: 'entrada', t: 'Ganho' }, { v: 'investimento', t: 'Investir' }] as const).map(k => <Pressable key={k.v} onPress={() => setKind(k.v)} style={[s.kind, kind === k.v && s.kindActive]}><Text style={[s.kindText, kind === k.v && { color: C.green }]}>{k.t}</Text></Pressable>)}</View>
      <TextInput value={description} onChangeText={setDescription} placeholder="Descrição" placeholderTextColor={C.tertiary} style={s.input}/><TextInput value={amount} onChangeText={setAmount} placeholder="Valor (ex.: 120,50)" placeholderTextColor={C.tertiary} keyboardType="decimal-pad" style={s.input}/><TextInput value={category} onChangeText={setCategory} placeholder="Categoria (opcional)" placeholderTextColor={C.tertiary} style={s.input}/><TextInput value={dateText} onChangeText={setDateText} placeholder="Data DD/MM/AAAA" placeholderTextColor={C.tertiary} keyboardType="numbers-and-punctuation" style={s.input}/><TextInput value={note} onChangeText={setNote} placeholder="Observação (opcional)" placeholderTextColor={C.tertiary} style={s.input}/><View style={s.kindRow}><Pressable onPress={() => setFixed(v => !v)} style={[s.kind, fixed && s.kindActive]}><Text style={[s.kindText, fixed && { color: C.green }]}>{fixed ? "✓ Fixo" : "Marcar fixo"}</Text></Pressable>{kind === "saida" ? <Pressable onPress={() => setPaid(v => !v)} style={[s.kind, paid && s.kindActive]}><Text style={[s.kindText, paid && { color: C.green }]}>{paid ? "✓ Pago" : "Pendente"}</Text></Pressable> : null}</View>
      <Pressable onPress={add} style={s.save}><Text style={s.saveText}>{editing ? 'Salvar alterações' : 'Salvar registro'}</Text></Pressable><Pressable onPress={() => setVisible(false)} style={{ padding: 13, alignItems: 'center' }}><Text style={{ color: C.muted }}>Cancelar</Text></Pressable>
    </View></View></Modal>
  </Page>;
}
function MovementRow({ item, color, onPress }: { item: Movement; color: string; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={s.row}><View style={s.categoryIcon}><Ionicons name="ellipse-outline" color={color} size={20}/></View><View style={{ flex: 1 }}><Text style={s.description}>{item.description}</Text><Text style={s.date}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text></View><Text style={[s.valueSmall, { color }]}>{money(item.amount)}</Text></Pressable>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: C.text, fontSize: 28, fontWeight: '700' },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.panel, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 17, borderWidth: 1, borderColor: C.border },
  month: { color: C.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  filters: { flexGrow: 0, marginBottom: 2 },
  pill: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 30, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  pillActive: { backgroundColor: C.green, borderColor: C.green }, pillText: { color: C.muted, fontSize: 12, fontWeight: '600' }, pillTextActive: { color: '#06130B' },
  section: { marginBottom: 19 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionName: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '700' }, count: { color: C.muted, fontSize: 12 },
  pendingChip: { color: C.red, borderColor: C.red, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, fontSize: 9 },
  sectionTotal: { fontSize: 13, fontWeight: '700' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 17, padding: 22, alignItems: 'center', backgroundColor: C.panel },
  emptyTitle: { color: C.text, fontSize: 13, fontWeight: '600' }, emptyHint: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 7 },
  expenseWrap: { width: 188 }, expenseCard: { marginBottom: 7, minHeight: 168, padding: 13 },
  expenseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, categoryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A1A0F', alignItems: 'center', justifyContent: 'center' },
  installment: { color: C.green, fontSize: 10, overflow: 'hidden' }, value: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 12, fontVariant: ['tabular-nums'] },
  description: { color: C.text, fontSize: 12, fontWeight: '500', marginTop: 6 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12 },
  date: { color: C.muted, fontSize: 10 }, payButton: { minHeight: 34, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  payText: { color: C.muted, fontSize: 11, fontWeight: '600' }, paidButton: { borderStyle: 'solid', borderColor: '#22583B' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  valueSmall: { fontSize: 13, fontWeight: '700' },
  fab: { position: 'absolute', right: 8, bottom: 112, width: 58, height: 58, borderRadius: 20, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: C.green, shadowOpacity: .25, shadowRadius: 12 },
  backdrop: { flex: 1, backgroundColor: '#000D', justifyContent: 'flex-end' }, modal: { backgroundColor: C.panel, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 21, paddingBottom: 30, borderWidth: 1, borderColor: C.border },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 }, modalTitle: { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 16 },
  kindRow: { flexDirection: 'row', gap: 8 }, kind: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: C.panel2, alignItems: 'center' }, kindActive: { borderWidth: 1, borderColor: C.green, backgroundColor: '#17271C' },
  kindText: { color: C.muted, fontSize: 11, fontWeight: '700' }, input: { backgroundColor: C.bg, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 14, fontSize: 14, marginTop: 13 },
  save: { backgroundColor: C.green, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 16 }, saveText: { color: '#06130B', fontWeight: '800' },
});
