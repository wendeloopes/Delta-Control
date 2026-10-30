import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Card, Page, Title } from '../../components/ui';
import { AppData, loadAppData } from '../../lib/storage';
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function StatsScreen(){
 const [data,setData]=useState<AppData|null>(null);
 useFocusEffect(useCallback(()=>{loadAppData().then(setData).catch(()=>Alert.alert('Erro','Não foi possível carregar os dados.'));},[]));
 const totals=useMemo(()=>{const ms=data?.movements??[];const income=ms.filter(m=>m.type==='entrada').reduce((a,m)=>a+m.amount,0);const expenses=ms.filter(m=>m.type==='saida').reduce((a,m)=>a+m.amount,0);return {income,expenses,balance:(data?.openingBalance??0)+income-expenses,count:ms.length};},[data]);
 return <Page><Title subtitle="Visão geral das suas movimentações">Estatísticas</Title><ScrollView showsVerticalScrollIndicator={false}>
 <Card><Text style={s.label}>SALDO CALCULADO</Text><Text style={s.balance}>{money(totals.balance)}</Text><Text style={s.caption}>Saldo inicial + entradas − saídas</Text></Card>
 <Card><View style={s.row}><Ionicons name="trending-up" color={C.green} size={22}/><Text style={s.label}>TOTAL DE ENTRADAS</Text></View><Text style={[s.value,{color:C.green}]}>{money(totals.income)}</Text></Card>
 <Card><View style={s.row}><Ionicons name="trending-down" color={C.red} size={22}/><Text style={s.label}>TOTAL DE SAÍDAS</Text></View><Text style={s.value}>{money(totals.expenses)}</Text></Card>
 <Card><Text style={s.label}>MOVIMENTAÇÕES REGISTRADAS</Text><Text style={s.value}>{totals.count}</Text></Card>
 </ScrollView></Page>;
}
const s=StyleSheet.create({label:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:1},balance:{color:C.text,fontSize:30,fontWeight:'900',marginTop:12},caption:{color:C.muted,fontSize:11,marginTop:7},row:{flexDirection:'row',alignItems:'center',gap:10},value:{color:C.text,fontSize:23,fontWeight:'900',marginTop:12}});