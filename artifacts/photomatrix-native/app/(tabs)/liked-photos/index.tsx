import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { getListLikedPhotosQueryKey, useListLikedPhotos } from '@workspace/api-client-react';
import { Image } from 'expo-image';
import { Link, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef } from 'react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl } from '@/utils/media';
import { useTabPressReset } from '@/context/tab-reset';

export default function LikedPhotos() {
  const colors = useColors();
  const { t } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const list = useRef<FlatList>(null);
  useTabPressReset('liked-photos', () => list.current?.scrollToOffset({ offset: 0, animated: false }));
  const liked = useListLikedPhotos({ query: { enabled: !!isSignedIn, queryKey: getListLikedPhotosQueryKey() } });

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{
      title: t('likedPhotos'),
      headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('home')} onPress={() => router.replace('/(tabs)')} style={styles.headerBack}>
        <Feather name="chevron-left" size={24} color={colors.primary} />
      </Pressable>,
    }} />
    <Text style={[styles.kicker, { color: colors.primary }]}>{t('discover')}</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>{t('likedPhotos')}</Text>
    <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t('likedPhotosIntro')}</Text>
    {!isLoaded ? <ActivityIndicator color={colors.primary} /> : !isSignedIn ? <View style={styles.center}>
      <Text style={{ color: colors.mutedForeground }}>{t('signInSeeLikes')}</Text>
      <Link href={{ pathname: '/sign-in', params: { returnTo: '/(tabs)/liked-photos' } }} asChild>
        <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: colors.primary }])}><Text style={{ color: colors.primaryForeground }}>{t('signIn')}</Text></Pressable>
      </Link>
      <GoogleSignInButton />
    </View> : liked.isLoading ? <ActivityIndicator color={colors.primary} /> : liked.isError ? <View style={styles.center}>
      <Text style={{ color: colors.mutedForeground }}>{t('loadLikedPhotosError')}</Text>
      <Pressable onPress={() => liked.refetch()} style={styles.button}><Text style={{ color: colors.primary }}>{t('retry')}</Text></Pressable>
    </View> : <FlatList
       ref={list}
      data={liked.data ?? []}
      keyExtractor={photo => String(photo.id)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={{ color: colors.mutedForeground }}>{t('noLikedPhotos')}</Text>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/liked-photos/photo/[id]', params: { id: String(item.id) } })} style={[styles.card, { borderColor: colors.border }]}>
        <Image source={resolveMediaUrl(item.imageUrl)} style={styles.thumb} contentFit="cover" />
        <View style={styles.details}>
          <Text style={{ color: colors.foreground, fontWeight: '700' }} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: colors.mutedForeground }} numberOfLines={1}>{item.photographerName ?? t('unknown')}</Text>
        </View>
      </Pressable>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20 },
  headerBack: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 34, fontWeight: '700', marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 26 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: { marginTop: 16, borderRadius: 7, padding: 14, alignItems: 'center' },
  list: { paddingBottom: 30, flexGrow: 1 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  thumb: { width: 76, height: 76, borderRadius: 5 },
  details: { flex: 1, gap: 5 },
});