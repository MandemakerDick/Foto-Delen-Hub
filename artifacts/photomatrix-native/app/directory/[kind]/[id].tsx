import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGetClub, useGetTheme, useGetPhotographer, useListPhotos } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl } from '@/utils/media';

type Kind = 'clubs' | 'themes' | 'photographers';
export default function DirectoryDetail() {
  const c = useColors(); const { t } = useLocale(); const router = useRouter();
  const p = useLocalSearchParams<{ kind?: string; id?: string }>(); const kind = p.kind as Kind; const id = Number(p.id);
  const valid = ['clubs', 'themes', 'photographers'].includes(kind) && Number.isInteger(id) && id > 0;
  const club = useGetClub(id, { query: { enabled: valid && kind === 'clubs', queryKey: ['directory-club', id] } });
  const theme = useGetTheme(id, { query: { enabled: valid && kind === 'themes', queryKey: ['directory-theme', id] } });
  const photographer = useGetPhotographer(id, { query: { enabled: valid && kind === 'photographers', queryKey: ['directory-photographer', id] } });
  const photos = useListPhotos(valid ? kind === 'clubs' ? { clubId: id } : kind === 'themes' ? { themeId: id } : { photographerId: id } : {}, { query: { enabled: valid, queryKey: ['directory-photos', kind, id] } });
  if (!valid) return <State text={t('unknownDirectory')} colors={c} />;
  const detail = kind === 'clubs' ? club : kind === 'themes' ? theme : photographer;
  if (detail.isLoading) return <View style={[styles.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.primary} /></View>;
  if (detail.isError || !detail.data) return <State text={t('directoryUnavailable')} colors={c} />;
  const item = detail.data; const description = 'description' in item && typeof item.description === 'string' ? item.description : '';
  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.root}><Stack.Screen options={{ title: item.name }} /><Text style={[styles.kicker, { color: c.primary }]}>{t('discover')}</Text><Text style={[styles.title, { color: c.foreground }]}>{item.name}</Text>{description ? <Text style={[styles.description, { color: c.mutedForeground }]}>{description}</Text> : null}<Text style={[styles.section, { color: c.foreground }]}>{t('linkedPhotos')}</Text>{photos.isLoading ? <ActivityIndicator color={c.primary} /> : photos.isError ? <Text style={{ color: c.mutedForeground }}>{t('photosUnavailable')}</Text> : photos.data?.length ? <View style={styles.grid}>{photos.data.map(photo => <Pressable key={photo.id} style={styles.photo} onPress={() => router.push(`/photo/${photo.id}`)}><Image source={resolveMediaUrl(photo.imageUrl)} style={styles.image} contentFit="cover" /><Text numberOfLines={1} style={{ color: c.foreground, marginTop: 6 }}>{photo.title}</Text></Pressable>)}</View> : <Text style={{ color: c.mutedForeground }}>{t('noLinkedPhotos')}</Text>}</ScrollView>;
}
function State({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.mutedForeground }}>{text}</Text></View>; }
const styles = StyleSheet.create({ root: { padding: 20, paddingBottom: 100 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, kicker: { letterSpacing: 2, fontSize: 10, fontWeight: '700' }, title: { fontSize: 32, fontWeight: '700', marginTop: 8 }, description: { fontSize: 16, lineHeight: 24, marginTop: 14 }, section: { fontSize: 21, fontWeight: '700', marginTop: 32, marginBottom: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, photo: { width: '48%', marginBottom: 14 }, image: { width: '100%', aspectRatio: 1, borderRadius: 5 } });