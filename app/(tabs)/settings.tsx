import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, ActionButton, Card, Page } from '../../components/ui';
import { AppData, clearDemoData, loadAppData, saveAppData } from '../../lib/storage';

export default function SettingsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    loadAppData().then((value) => {
      setData(value);
      setName(value.profileName ?? '');
    }).catch(() => Alert.alert('Erro', 'Não foi possível carregar o perfil.'));
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function saveName() {
    try {
      setSaving(true);
      const current = data ?? await loadAppData();
      const next = { ...current, profileName: name.trim() };
      await saveAppData(next);
      setData(next);
      setName(next.profileName ?? '');
      Alert.alert('Perfil salvo', 'Seu nome será usado na saudação da aba Voz.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  function clearDemos() {
    Alert.alert('Limpar dados de demonstração?', 'Somente lançamentos marcados como demonstração serão removidos. Seus lançamentos pessoais serão preservados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: async () => {
        try {
          const next = await clearDemoData();
          setData(next);
          Alert.alert('Concluído', 'Dados de demonstração removidos. Eles não serão recriados automaticamente.');
        } catch {
          Alert.alert('Erro', 'Não foi possível limpar os dados de demonstração.');
        }
      } },
    ]);
  }

  if (!data) return <Page><Text style={{ color: C.muted }}>Carregando perfil…</Text></Page>;
  return <Page>
    <View style={s.header}><Text style={s.title}>Perfil</Text><Text style={s.sub}>Sua conta, do seu jeito</Text></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
      <Card>
        <View style={s.profile}>
          <View style={s.avatar}><Ionicons name="person" color={C.green} size={28}/></View>
          <View style={{ flex: 1 }}><Text style={s.name}>{name.trim() || 'Seu nome'}</Text><Text style={s.caption}>Perfil local · sem login</Text></View>
        </View>
        <Text style={s.label}>NOME PARA A SAUDAÇÃO</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Digite seu nome" placeholderTextColor={C.tertiary} autoCapitalize="words" maxLength={50} returnKeyType="done" onSubmitEditing={saveName} style={s.input}/>
        <View style={{ marginTop: 12 }}><ActionButton title={saving ? 'Salvando…' : 'Salvar nome'} onPress={saveName}/></View>
      </Card>
      <Text style={s.section}>PREFERÊNCIAS</Text>
      <Card><View style={s.row}><View style={s.icon}><Ionicons name="moon" size={20} color={C.green}/></View><View style={{ flex: 1 }}><Text style={s.heading}>Tema escuro</Text><Text style={s.caption}>Interface Delta em grafite e verde neon.</Text></View><Text style={s.on}>ATIVO</Text></View></Card>
      <Text style={s.section}>APLICATIVO</Text>
      <Card><View style={s.row}><View style={s.icon}><Ionicons name="phone-portrait" size={20} color={C.blue}/></View><View style={{ flex: 1 }}><Text style={s.heading}>Armazenamento local</Text><Text style={s.caption}>Seus registros ficam neste dispositivo via AsyncStorage.</Text></View></View></Card>
      <Card><View style={s.row}><View style={s.icon}><Ionicons name="shield-checkmark" size={20} color={C.green}/></View><View style={{ flex: 1 }}><Text style={s.heading}>Delta Control</Text><Text style={s.caption}>Versão MVP 1.0.0 · dados sem sincronização em nuvem.</Text></View></View></Card>
      <Text style={s.section}>GERENCIAR DADOS</Text>
      <Text style={s.caption}>Remova somente os lançamentos demonstrativos. Os registros pessoais não serão apagados.</Text>
      <View style={{ marginTop: 14 }}><ActionButton title="Limpar dados de demonstração" onPress={clearDemos} secondary/></View>
      <Text style={s.footer}>DELTA CONTROL · CONTROLE SIMPLES, VISÃO CLARA.</Text>
    </ScrollView>
  </Page>;
}

const s = StyleSheet.create({
  header: { marginBottom: 18 }, title: { color: C.text, fontSize: 28, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13, marginTop: 4 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 },
  avatar: { width: 55, height: 55, borderRadius: 19, backgroundColor: '#26351D', borderWidth: 1, borderColor: '#526E35', alignItems: 'center', justifyContent: 'center' },
  name: { color: C.text, fontSize: 16, fontWeight: '700' },
  caption: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  label: { color: C.muted, fontSize: 10, letterSpacing: 1.4, marginBottom: 8 },
  input: { backgroundColor: C.bg, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 13, fontSize: 15 },
  section: { color: C.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '700', marginTop: 9, marginBottom: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  heading: { color: C.text, fontSize: 14, fontWeight: '700' }, on: { color: C.green, fontSize: 10, fontWeight: '800' },
  footer: { color: C.muted, textAlign: 'center', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginVertical: 28 },
});
