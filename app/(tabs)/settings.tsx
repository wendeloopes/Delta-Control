import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, ActionButton, Card, Page, Title } from '../../components/ui';
import { resetAppData } from '../../lib/storage';
export default function SettingsScreen(){
 function clearData(){Alert.alert('Limpar dados?','Isso remove os registros locais. Na próxima abertura, os dados demonstrativos serão recriados.',[{text:'Cancelar',style:'cancel'},{text:'Limpar',style:'destructive',onPress:async()=>{try{await resetAppData();Alert.alert('Concluído','Dados locais removidos.');}catch{Alert.alert('Erro','Não foi possível limpar os dados.');}}}]);}
 return <Page><Title subtitle="Personalize sua experiência">Configurações</Title><ScrollView showsVerticalScrollIndicator={false}>
 <Card><View style={s.row}><View style={s.icon}><Ionicons name="shield-checkmark-outline" size={21} color={C.green}/></View><View style={{flex:1}}><Text style={s.heading}>Delta Control</Text><Text style={s.caption}>Versão MVP 1.0.0</Text></View><Text style={{color:C.green,fontWeight:'900'}}>ATIVO</Text></View></Card>
 <Card><View style={s.row}><View style={s.icon}><Ionicons name="moon-outline" size={21} color={C.blue}/></View><View style={{flex:1}}><Text style={s.heading}>Tema escuro</Text><Text style={s.caption}>Interface otimizada para ambientes com pouca luz.</Text></View><Text style={{color:C.green,fontWeight:'800'}}>ON</Text></View></Card>
 <Card><View style={s.row}><View style={s.icon}><Ionicons name="phone-portrait-outline" size={21} color={C.yellow}/></View><View style={{flex:1}}><Text style={s.heading}>Armazenamento local</Text><Text style={s.caption}>Os registros ficam salvos neste dispositivo via AsyncStorage.</Text></View></View></Card>
 <Text style={s.section}>DADOS DO MVP</Text><Text style={s.caption}>O projeto inicia com registros demonstrativos para facilitar a visualização. Você pode removê-los a qualquer momento.</Text><View style={{marginTop:16}}><ActionButton title="Limpar dados locais" onPress={clearData} secondary/></View>
 <Text style={s.footer}>Delta Control · Controle simples, visão clara.</Text>
 </ScrollView></Page>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:13},icon:{width:43,height:43,borderRadius:14,backgroundColor:C.panel2,alignItems:'center',justifyContent:'center'},heading:{color:C.text,fontSize:14,fontWeight:'800'},caption:{color:C.muted,fontSize:11,lineHeight:16,marginTop:5},section:{color:C.muted,fontSize:10,letterSpacing:1.3,fontWeight:'900',marginTop:15,marginBottom:8},footer:{color:C.muted,textAlign:'center',fontSize:11,marginVertical:28}});