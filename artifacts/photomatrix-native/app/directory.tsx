import { Link, Redirect, Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getListFollowingPhotographersQueryKey, useListClubs, useListThemes, useListPhotographers, useListFollowingPhotographers } from '@workspace/api-client-react';
import type { Club, Photographer, Theme } from '@workspace/api-client-react';
import { useAuth } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export function surnameSort(a: string, b: string) {
  const last = (name: string) => name.trim().split(/\s+/).at(-1)?.toLocaleLowerCase() ?? '';
  return last(a).localeCompare(last(b), 'nl', { sensitivity: 'base' }) || a.localeCompare(b, 'nl', { sensitivity: 'base' });
}
export function Directory({ kind = 'photographers' }: { kind?: 'clubs' | 'themes' | 'photographers' | 'following' }) {
  const colors = useColors(); const insets = useSafeAreaInsets(); const { t } = useLocale(); const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const navigation = useNavigation();
  const fromHome = useLocalSearchParams<{ fromHome?: string }>().fromHome === '1';
  const returnToParent = () => fromHome ? router.replace('/(tabs)') : router.dismissTo('/(tabs)/gallery');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      returnToParent();
      return true;
    });
    return () => listener.remove();
  }, [fromHome, navigation, router]);
  const clubs = useListClubs(); const themes = useListThemes(); const photographers = useListPhotographers();
  const following = useListFollowingPhotographers({ query: { enabled: kind === 'following' && isLoaded && !!isSignedIn, queryKey: [...getListFollowingPhotographersQueryKey(), userId] as const } });
  const source = kind === 'clubs' ? clubs.data : kind === 'themes' ? themes.data : kind === 'following' ? isSignedIn ? following.data : [] : photographers.data;
  const items = Array.isArray(source) ? source : [];
  const sorted = kind === 'photographers' || kind === 'following' ? [...items].sort((a, b) => surnameSort(a.name, b.name) || a.id - b.id) : items;
  const label = t(kind);
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.root, { paddingTop: insets.top + 18, paddingBottom: 100 }]}><Stack.Screen options={{
    title: label,
    gestureEnabled: !fromHome,
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t(fromHome ? 'home' : 'gallery')} onPress={returnToParent} style={styles.headerBack}>
      <Feather name="chevron-left" size={24} color={colors.primary} />
    </Pressable>,
  }} /><Text style={[styles.kicker, { color: colors.primary }]}>{t('discover')}</Text><Text style={[styles.title, { color: colors.foreground }]}>{label}</Text><Text style={{ color: colors.mutedForeground, marginTop: 8 }}>{t(kind === 'following' ? 'followingIntro' : 'community')}</Text>
  {kind === 'following' && (!isLoaded || following.isLoading ? <ActivityIndicator color={colors.primary} style={styles.followingState} />
    : !isSignedIn ? <Link href={{ pathname: '/sign-in', params: { returnTo: `/gallery/following${fromHome ? '?fromHome=1' : ''}` } }} asChild><Pressable accessibilityRole="button" style={styles.followingState}><Text style={{ color: colors.primary }}>{t('signInToFollow')}</Text></Pressable></Link>
    : following.isError ? <Pressable accessibilityRole="button" onPress={() => { void following.refetch(); }} style={styles.followingState}><Text style={{ color: colors.primary }}>{t('followingUnavailable')} {t('retry')}</Text></Pressable>
    : !sorted.length ? <Text style={[styles.followingState, { color: colors.mutedForeground }]}>{t('noFollowing')}</Text> : null)}
  <View style={{ marginTop: 26 }}>{sorted.map(item => {
    const club = kind === 'clubs' ? item as Club : null;
    const theme = kind === 'themes' ? item as Theme : null;
    const photographer = kind === 'photographers' || kind === 'following' ? item as Photographer : null;
    const subline = club
      ? `${club.location ? `${club.location} · ` : ''}${club.memberCount ?? 0} ${t('members')} · ${club.photoCount ?? 0} ${t('clubPhotos')}\n${club.memberPhotoCount ?? t('countUnavailable')} ${t('memberPhotos')}`
      : theme
        ? `${theme.photoCount ?? 0} ${t('photographs')} · ${theme.photographerCount ?? t('countUnavailable')} ${t('photographers')}`
        : photographer
          ? `${photographer.photoCount ?? 0} ${t('photographs')} · ${photographer.themes?.length ?? 0} ${t('themes')} · ${photographer.clubs.length} ${t('clubs')}`
          : '';
    return <Link key={item.id} href={`/gallery/directory/${kind === 'following' ? 'photographers' : kind}/${item.id}?fromList=${kind === 'following' ? 'following' : '1'}${fromHome ? '&fromHome=1' : ''}` as never} push asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([styles.row, { borderColor: colors.border }])}>
        <View style={styles.rowContent}>
          <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{subline}</Text>
        </View>
        <Text style={[styles.chevron, { color: colors.primary }]}>›</Text>
      </Pressable>
    </Link>;
  })}</View></ScrollView>;
}

export default function LegacyDirectory() {
  return <Redirect href="/gallery/photographers" />;
}
const styles = StyleSheet.create({ root: { paddingHorizontal: 20 }, headerBack: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, kicker: { fontSize: 10, letterSpacing: 2, fontWeight: '700' }, title: { fontSize: 34, fontWeight: '700', marginTop: 6 }, followingState: { marginTop: 26, minHeight: 44, justifyContent: 'center' }, row: { borderBottomWidth: 1, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowContent: { flex: 1, minWidth: 0 }, chevron: { width: 20, flexShrink: 0, textAlign: 'right', fontSize: 20 }, name: { fontSize: 17, fontWeight: '600' } });