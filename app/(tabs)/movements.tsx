import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Page, Title } from '../../components/ui';
import { AppData, loadAppData, Movement } from '../../lib/storage';
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function MovementsScreen(){
 const [data,setData]=useState<AppData|null>(null);
 useFocusEffect(useCallback(()=>{loadAppData().then(setData).catch(()=>Alert.alert('Erro','Não foi possível carregar os dados.'));},[]));
 return <Page><Title subtitle="Histórico salvo neste dispositivo">Movimentações</Title><ScrollView showsVerticalScrollIndicator={false}>
 {(data?.movements??[]).map((m:Movement)=><View key={m.id} style={s.row}><View style={[s.icon,{backgroundColor:m.type==='entrada'?'#193427':'#351F26'}]}><Ionicons name={m.type==='entrada'?'arrow-down':'arrow-up'} size={18} color={m.type==='entrada'?C.green:C.red}/></View><View style={{flex:1}}><Text style={s.name}>{m.description}</Text><Text style={s.date}>{new Date(m.createdAt).toLocaleString('pt-BR')}</Text></View><Text style={[s.amount,{color:m.type==='entrada'?C.green:C.text}]}>{m.type==='entrada'?'+':'−'} {money(m.amount)}</Text></View>)}
 {data&&data.movements.length===0&&<Text style={s.empty}>Nenhuma movimentação por enquanto.</Text>}
 </ScrollView></Page>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:15,borderBottomWidth:1,borderBottomColor:C.border},icon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},name:{color:C.text,fontSize:14,fontWeight:'700'},date:{color:C.muted,fontSize:10,marginTop:5},amount:{fontSize:12,fontWeight:'800'},empty:{color:C.muted,padding:24,textAlign:'center'}});