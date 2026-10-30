import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Card, Page } from '../../components/ui';
import { AppData, loadAppData, saveAppData } from '../../lib/storage';
import { parseQuickCommand } from '../../lib/commands';

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function HomeScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [visible, setVisible] = useState(false);
  const [command, setCommand] = useState('');
  const refresh = useCallback(() => { loadAppData().then(setData).catch(() => Alert.alert('Erro', 'Não foi possível carregar os dados.')); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const totals = useMemo(() => {
    const ms = data?.movements ?? [];
    const income = ms.filter(m => m.type === 'entrada').reduce((s, m) => s + m.amount, 0);
    const expense = ms.filter(m => m.type === 'saida').reduce((s, m) => s + m.amount, 0);
    return { income, expense, balance: (data?.openingBalance ?? 0) + income - expense };
  }, [data]);
  async function addCommand() {
    const parsed = parseQuickCommand(command);
    if (!parsed) { Alert.alert('Comando não reconhecido', 'Exemplo: entrada 150 venda ou saída 29,90 almoço.'); return; }
    try {
      const current = data ?? await loadAppData();
      const next = { ...current, movements: [{ ...parsed, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...current.movements] };
      await saveAppData(next); setData(next); setCommand(''); setVisible(false);
      Alert.alert('Salvo', 'Movimentação adicionada com sucesso.');
    } catch { Alert.alert('Erro', 'Não foi possível salvar a movimentação.'); }
  }
  if (!data) return <Page><Text style={{ color: C.muted }}>Carregando Delta Control…</Text></Page>;
  return <Page><ScrollView showsVerticalScrollIndicator={false}>
    <View style={s.header}><View><Text style={s.eyebrow}>CONTROLE FINANCEIRO</Text><Text style={s.brand}>Delta Control</Text></View><View style={s.avatar}><Ionicons name="person-outline" color={C.green} size={23}/></View></View>
    <Card style={s.balanceCard}><View style={s.labelRow}><Text style={s.label}>SALDO ATUAL</Text><Ionicons name="eye-outline" color={C.green} size={19}/></View><Text style={s.balance}>{money(totals.balance)}</Text><View style={s.foot}><View style={s.dot}/><Text style={s.footText}>Atualizado neste dispositivo</Text></View></Card>
    <View style={s.summaryRow}><Card style={s.summaryCard}><View style={s.smallIcon}><Ionicons name="arrow-down" color={C.green} size={17}/></View><Text style={s.label}>ENTRADAS</Text><Text style={[s.summaryValue,{color:C.green}]}>{money(totals.income)}</Text></Card><Card style={s.summaryCard}><View style={[s.smallIcon,{backgroundColor:'#351F26'}]}><Ionicons name="arrow-up" color={C.red} size={17}/></View><Text style={s.label}>SAÍDAS</Text><Text style={[s.summaryValue,{color:C.text}]}>{money(totals.expense)}</Text></Card></View>
    <View style={s.commandSection}><Text style={s.sectionTitle}>Comando rápido</Text><Text style={s.hint}>Registre uma movimentação em segundos</Text><Pressable style={s.commandButton} onPress={()=>setVisible(true)}><View style={s.glow}><Ionicons name="add" size={34} color="#08110C"/></View><Text style={s.buttonTitle}>Adicionar registro</Text><Text style={s.buttonSub}>Toque para digitar um comando</Text></Pressable><Text style={s.example}>Ex.: “entrada 150 venda” · “saída 29,90 almoço”</Text></View>
    <Card><Text style={s.sectionTitle}>Movimentações recentes</Text>{data.movements.slice(0,4).map(m=><View key={m.id} style={s.movementRow}><View style={[s.movementIcon,{backgroundColor:m.type==='entrada'?'#193427':'#351F26'}]}><Ionicons name={m.type==='entrada'?'arrow-down':'arrow-up'} size={17} color={m.type==='entrada'?C.green:C.red}/></View><View style={{flex:1}}><Text style={s.name}>{m.description}</Text><Text style={s.date}>{new Date(m.createdAt).toLocaleDateString('pt-BR')}</Text></View><Text style={{color:m.type==='entrada'?C.green:C.text,fontWeight:'800',fontSize:12}}>{m.type==='entrada'?'+':'−'} {money(m.amount)}</Text></View>)}{data.movements.length===0&&<Text style={s.date}>Nenhuma movimentação ainda.</Text>}</Card>
  </ScrollView>
  <Modal visible={visible} transparent animationType="slide" onRequestClose={()=>setVisible(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.handle}/><Text style={s.modalTitle}>Comando rápido</Text><Text style={s.hint}>Digite a operação e o valor.</Text><TextInput value={command} onChangeText={setCommand} placeholder="Ex.: entrada 150 venda" placeholderTextColor={C.muted} autoCapitalize="sentences" style={s.input}/><View style={s.chips}><Text onPress={()=>setCommand('entrada 150 venda')} style={s.chip}>entrada 150 venda</Text><Text onPress={()=>setCommand('saída 29,90 almoço')} style={s.chip}>saída 29,90 almoço</Text></View><Pressable style={s.save} onPress={addCommand}><Text style={s.saveText}>Salvar movimentação</Text></Pressable><Pressable onPress={()=>setVisible(false)} style={{padding:14,alignItems:'center'}}><Text style={{color:C.muted}}>Cancelar</Text></Pressable></View></View></Modal>
  </Page>;
}
const s=StyleSheet.create({
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},eyebrow:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:2},brand:{color:C.text,fontSize:28,fontWeight:'900',marginTop:3},avatar:{width:45,height:45,borderRadius:16,backgroundColor:C.panel2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
 balanceCard:{backgroundColor:'#151C20',borderColor:'#2B493A',padding:22},labelRow:{flexDirection:'row',justifyContent:'space-between'},label:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:1.1},balance:{color:C.text,fontSize:34,fontWeight:'900',marginTop:12},foot:{flexDirection:'row',alignItems:'center',marginTop:14,gap:7},dot:{width:7,height:7,borderRadius:4,backgroundColor:C.green},footText:{color:C.muted,fontSize:11},
 summaryRow:{flexDirection:'row',gap:12},summaryCard:{flex:1,padding:15},smallIcon:{width:31,height:31,borderRadius:10,backgroundColor:'#193427',alignItems:'center',justifyContent:'center',marginBottom:12},summaryValue:{fontSize:14,fontWeight:'800',marginTop:8},
 commandSection:{alignItems:'center',marginVertical:18},sectionTitle:{color:C.text,fontSize:16,fontWeight:'800'},hint:{color:C.muted,fontSize:12,marginTop:5},commandButton:{marginTop:18,alignItems:'center',justifyContent:'center',width:180,height:180,borderRadius:90,borderWidth:1,borderColor:'#315B43',backgroundColor:'#14231B'},glow:{width:65,height:65,borderRadius:33,backgroundColor:C.green,alignItems:'center',justifyContent:'center',marginBottom:12},buttonTitle:{color:C.text,fontSize:14,fontWeight:'800'},buttonSub:{color:C.muted,fontSize:10,marginTop:5},example:{color:C.muted,fontSize:10,textAlign:'center',marginTop:12},
 movementRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border,gap:10},movementIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},name:{color:C.text,fontSize:12,fontWeight:'700'},date:{color:C.muted,fontSize:10,marginTop:4},backdrop:{flex:1,backgroundColor:'#000B',justifyContent:'flex-end'},modal:{backgroundColor:C.panel,borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:30,borderWidth:1,borderColor:C.border},handle:{width:42,height:4,borderRadius:3,backgroundColor:C.border,alignSelf:'center',marginBottom:20},modalTitle:{color:C.text,fontSize:23,fontWeight:'900'},input:{backgroundColor:C.bg,color:C.text,borderWidth:1,borderColor:C.border,borderRadius:14,padding:15,fontSize:15,marginTop:18},chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:14},chip:{color:C.green,fontSize:10,fontWeight:'700',backgroundColor:'#193427',padding:9,borderRadius:9,overflow:'hidden'},save:{backgroundColor:C.green,borderRadius:13,padding:15,alignItems:'center'},saveText:{color:'#08110C',fontWeight:'900'}
});