import { Link, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListClubs, useListThemes, useListPhotographers } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export function surnameSort(a: string, b: string) {
  const last = (name: string) => name.trim().split(/\s+/).at(-1)?.toLocaleLowerCase() ?? '';
  return last(a).localeCompare(last(b), 'nl', { sensitivity: 'base' }) || a.localeCompare(b, 'nl', { sensitivity: 'base' });
}
export default function Directory({ kind = 'photographers' }: { kind?: 'clubs' | 'themes' | 'photographers' }) {
  const colors = useColors(); const insets = useSafeAreaInsets(); const { t } = useLocale();
  const clubs = useListClubs(); const themes = useListThemes(); const photographers = useListPhotographers();
  const source = kind === 'clubs' ? clubs.data : kind === 'themes' ? themes.data : photographers.data;
  const items = Array.isArray(source) ? source : [];
  const sorted = kind === 'photographers' ? [...items].sort((a, b) => surnameSort(a.name, b.name) || a.id - b.id) : items;
  const label = t(kind);
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.root, { paddingTop: insets.top + 18, paddingBottom: 100 }]}><Stack.Screen options={{ title: label }} /><Text style={[styles.kicker, { color: colors.primary }]}>{t('discover')}</Text><Text style={[styles.title, { color: colors.foreground }]}>{label}</Text><Text style={{ color: colors.mutedForeground, marginTop: 8 }}>{t('community')}</Text><View style={{ marginTop: 26 }}>{sorted.map(item => <Link key={item.id} href={`/directory/${kind}/${item.id}` as never} style={[styles.row, { borderColor: colors.border }]}><View><Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text><Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{'photoCount' in item ? `${item.photoCount ?? 0} ${t('photographs')}` : t('viewProfile')}</Text></View><Text style={{ color: colors.primary, fontSize: 20 }}>›</Text></Link>)}</View></ScrollView>;
}
const styles = StyleSheet.create({ root: { paddingHorizontal: 20 }, kicker: { fontSize: 10, letterSpacing: 2, fontWeight: '700' }, title: { fontSize: 34, fontWeight: '700', marginTop: 6 }, row: { borderBottomWidth: 1, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { fontSize: 17, fontWeight: '600' } });