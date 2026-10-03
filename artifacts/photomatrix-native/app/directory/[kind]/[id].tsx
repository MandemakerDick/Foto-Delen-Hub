import { Link, Redirect, Stack, useLocalSearchParams, useNavigation, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetClubMembershipStatusQueryKey, getGetMyProfileQueryKey, getGetPhotographerFollowStatusQueryKey, getListClubsQueryKey, getListFollowingPhotographersQueryKey, getListPhotographersQueryKey, useGetClub, useGetClubMembershipStatus, useGetTheme, useGetPhotographer, useGetMyProfile, useGetPhotographerFollowStatus, useListPhotos, useListPhotographers, useToggleClubMembership, useTogglePhotographerFollow } from '@workspace/api-client-react';
import type { Club, Photographer, Theme } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { useAuth } from '@clerk/expo';
import { useAccountGuard } from '@/context/account-epoch';
import { resolveMediaUrl } from '@/utils/media';
import { serializeGalleryQuery } from '@/app/gallery';
import { detailBasePath } from '@/utils/detail-routes';

type Kind = 'clubs' | 'themes' | 'photographers';
export function DirectoryDetail() {
  const c = useColors(); const { t } = useLocale(); const router = useRouter();
  const detailBase = detailBasePath(usePathname());
  const navigation = useNavigation();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const isCurrentAccount = useAccountGuard();
  const queryClient = useQueryClient();
  const p = useLocalSearchParams<{ kind?: string; id?: string; fromList?: string; fromHome?: string }>(); const kind = p.kind as Kind; const id = Number(p.id);
  const valid = ['clubs', 'themes', 'photographers'].includes(kind) && Number.isInteger(id) && id > 0;
  const fromGalleryList = valid && detailBase === '/gallery' && (p.fromList === '1' || p.fromList === 'following');
  const returnToList = () => router.dismissTo(`/gallery/${p.fromList === 'following' ? 'following' : kind}${p.fromHome === '1' ? '?fromHome=1' : ''}` as never);
  const returnAfterSignIn = `${detailBase}/directory/${kind}/${id}${p.fromList ? `?fromList=${p.fromList}${p.fromHome === '1' ? '&fromHome=1' : ''}` : ''}`;
  useEffect(() => {
    if (!fromGalleryList || Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      returnToList();
      return true;
    });
    return () => listener.remove();
  }, [fromGalleryList, kind, navigation, router]);
  const header = (title: string) => <Stack.Screen options={{
    title,
    ...(fromGalleryList ? {
      headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t(p.fromList === 'following' ? 'following' : kind)} onPress={returnToList} style={styles.listBack}>
        <Feather name="chevron-left" size={24} color={c.primary} />
      </Pressable>,
      gestureEnabled: false,
    } : {}),
  }} />;
  const mine = useGetMyProfile({ query: { enabled: !!isSignedIn && (kind === 'photographers' || kind === 'clubs'), queryKey: getGetMyProfileQueryKey(), retry: (failures, error) => error.status !== 404 && failures < 2 } });
  const followKey = [...getGetPhotographerFollowStatusQueryKey(id), userId] as const;
  const followStatus = useGetPhotographerFollowStatus(id, { query: { enabled: valid && kind === 'photographers' && isLoaded && !!isSignedIn, queryKey: followKey } });
  const toggleFollow = useTogglePhotographerFollow({ mutation: {
    onSuccess: ({ following }) => {
      if (!isCurrentAccount()) return;
      queryClient.setQueryData(followKey, { following });
      void queryClient.invalidateQueries({ queryKey: getListFollowingPhotographersQueryKey() });
    },
    onError: () => { if (isCurrentAccount()) Alert.alert(t('followFailed'), t('tryAgain')); },
  } });
  const club = useGetClub(id, { query: { enabled: valid && kind === 'clubs', queryKey: ['directory-club', id] } });
  const theme = useGetTheme(id, { query: { enabled: valid && kind === 'themes', queryKey: ['directory-theme', id] } });
  const photographer = useGetPhotographer(id, { query: { enabled: valid && kind === 'photographers', queryKey: ['directory-photographer', id] } });
  const photos = useListPhotos(valid ? kind === 'clubs' ? { clubId: id } : kind === 'themes' ? { themeId: id } : { photographerId: id } : {}, { query: { enabled: valid, queryKey: ['directory-photos', kind, id] } });
  const members = useListPhotographers(kind === 'clubs' && valid ? { clubId: id } : undefined, { query: { enabled: valid && kind === 'clubs', queryKey: ['directory-club-members', id] } });
  const themePhotographers = useListPhotographers(kind === 'themes' && valid ? { themeId: id } : undefined, { query: { enabled: valid && kind === 'themes', queryKey: ['directory-theme-photographers', id] } });
  const membership = useGetClubMembershipStatus(id, { query: { enabled: !!isSignedIn && valid && kind === 'clubs' && !!mine.data, queryKey: getGetClubMembershipStatusQueryKey(id), retry: false } });
  const toggleMembership = useToggleClubMembership({
    mutation: {
      onSuccess: async status => {
        if (!isCurrentAccount()) return;
        queryClient.setQueryData(getGetClubMembershipStatusQueryKey(id), status);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['directory-club', id] }),
          queryClient.invalidateQueries({ queryKey: ['directory-club-members', id] }),
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
          ...(mine.data ? [queryClient.invalidateQueries({ queryKey: ['directory-photographer', mine.data.id] })] : []),
        ]);
      },
      onError: () => { if (isCurrentAccount()) Alert.alert(t('membershipFailed'), t('tryAgain')); },
    },
  });
  if (!valid) return <>{header(t('unknownDirectory'))}<State text={t('unknownDirectory')} colors={c} /></>;
  const detail = kind === 'clubs' ? club : kind === 'themes' ? theme : photographer;
  if (detail.isLoading) return <>{header(t(kind))}<View style={[styles.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.primary} /></View></>;
  if (detail.isError || !detail.data) return <>{header(t(kind))}<State text={t('directoryUnavailable')} colors={c} /></>;
  const item = detail.data; const description = 'description' in item && typeof item.description === 'string' ? item.description : '';
  const gallery = serializeGalleryQuery(kind === 'clubs' ? { clubs: [id] } : kind === 'themes' ? { themes: [id] } : { photographer: id });
  const clubItem = kind === 'clubs' ? item as Club : null;
  const themeItem = kind === 'themes' ? item as Theme : null;
  const photographerItem = kind === 'photographers' ? item as Photographer : null;
  const isOwnPhotographer = !!isSignedIn && !!photographerItem && mine.data?.id === photographerItem.id;
  const website = clubItem?.websiteUrl?.trim();
  const safeWebsite = website && /^https?:\/\/\S+$/i.test(website) ? website : null;
   return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.root}>{header(item.name)}<Text style={[styles.kicker, { color: c.primary }]}>{t('discover')}</Text>{photographerItem?.avatarUrl ? <Image source={resolveMediaUrl(photographerItem.avatarUrl)} style={styles.avatar} contentFit="cover" /> : null}<Text style={[styles.title, { color: c.foreground }]}>{item.name}</Text>{description ? <Text style={[styles.description, { color: c.mutedForeground }]}>{description}</Text> : null}
    {clubItem ? <View style={styles.metadata}>
      <View style={styles.metadataRow}>
        <View style={[styles.metadataCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.metadataLabel, { color: c.mutedForeground }]}>{t('location')}</Text>
          <Text style={[styles.metadataValue, { color: c.foreground }]}>{clubItem.location?.trim() || t('notRecorded')}</Text>
        </View>
        <View style={[styles.metadataCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.metadataLabel, { color: c.mutedForeground }]}>{t('yearEstablished')}</Text>
          <Text style={[styles.metadataValue, { color: c.foreground }]}>{clubItem.yearEstablished ?? t('notRecorded')}</Text>
        </View>
      </View>
      <View style={styles.metadataRow}>
        <Text style={[styles.metadataColumn, { color: c.mutedForeground }]}>{t('members')}: {clubItem.memberCount ?? t('countUnavailable')}</Text>
        <Text style={[styles.metadataColumn, { color: c.mutedForeground }]}>{t('memberPhotos')}: {clubItem.memberPhotoCount ?? t('countUnavailable')}</Text>
      </View>
      <Text style={{ color: c.mutedForeground }}>{t('clubPhotos')}: {clubItem.photoCount ?? t('countUnavailable')}</Text>
      {safeWebsite && <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(safeWebsite); }}><Text style={{ color: c.primary }}>{t('website')}: {safeWebsite}</Text></Pressable>}
      {!isSignedIn ? <Pressable accessibilityRole="button" testID="sign-in-to-join-club" onPress={() => router.push('/sign-in')} style={[styles.membershipButton, { borderColor: c.primary }]}>
        <Text style={{ color: c.primary, fontWeight: '700' }}>{t('signInToJoinClub')}</Text>
      </Pressable> : mine.isLoading ? <ActivityIndicator color={c.primary} /> : mine.isError ? (
        mine.error.status === 404 ? <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={[styles.membershipButton, { borderColor: c.primary }]}>
          <Text style={{ color: c.primary }}>{t('joinNeedsProfile')}</Text>
        </Pressable> : <Pressable accessibilityRole="button" onPress={() => { void mine.refetch(); }} style={styles.membershipButton}>
          <Text style={{ color: c.primary }}>{t('retry')}</Text>
        </Pressable>
      ) : membership.isError ? <Pressable accessibilityRole="button" onPress={() => { void membership.refetch(); }} style={styles.membershipButton}>
        <Text style={{ color: c.primary }}>{t('retry')}</Text>
      </Pressable> : <Pressable accessibilityRole="button" testID="toggle-club-membership" disabled={membership.isLoading || toggleMembership.isPending}
        onPress={() => toggleMembership.mutate({ id })}
        style={[styles.membershipButton, { borderColor: c.primary, backgroundColor: membership.data?.member ? c.background : c.primary, opacity: membership.isLoading || toggleMembership.isPending ? 0.5 : 1 }]}>
        <Text style={{ color: membership.data?.member ? c.primary : c.primaryForeground, fontWeight: '700' }}>{membership.data?.member ? t('leaveClub') : t('joinClub')}</Text>
      </Pressable>}
      <Text style={[styles.section, { color: c.foreground }]}>{t('members')}</Text>
      {members.isLoading ? <ActivityIndicator color={c.primary} /> : members.isError ? <View><Text style={{ color: c.mutedForeground }}>{t('membersUnavailable')}</Text><Pressable accessibilityRole="button" onPress={() => { void members.refetch(); }}><Text style={{ color: c.primary, marginTop: 8 }}>{t('retry')}</Text></Pressable></View> : members.data?.length ? members.data.map(member => <Pressable key={member.id} accessibilityRole="link" onPress={() => router.push(`${detailBase}/directory/photographers/${member.id}` as never)} style={styles.member}><Text style={{ color: c.primary }}>{member.name} ›</Text></Pressable>) : <Text style={{ color: c.mutedForeground }}>{t('noMembers')}</Text>}
    </View> : null}
     {themeItem ? <View style={styles.metadata}>
       <View style={styles.metadataRow}>
         <Text style={[styles.metadataColumn, { color: c.mutedForeground }]}>{t('linkedPhotos')}: {themeItem.photoCount ?? 0}</Text>
         <Text style={[styles.metadataColumn, { color: c.mutedForeground }]}>{t('photographers')}: {themeItem.photographerCount ?? t('countUnavailable')}</Text>
       </View>
        <Text style={[styles.section, { color: c.foreground }]}>{t('photographers')}</Text>
        {themePhotographers.isLoading ? <ActivityIndicator color={c.primary} /> : themePhotographers.isError ? <View>
          <Text style={{ color: c.mutedForeground }}>{t('photographersUnavailable')}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void themePhotographers.refetch(); }} style={styles.member}><Text style={{ color: c.primary }}>{t('retry')}</Text></Pressable>
        </View> : themePhotographers.data?.length ? themePhotographers.data.map(person =>
           <Pressable key={person.id} accessibilityRole="link" testID={`theme-photographer-${person.id}`} onPress={() => router.push(`${detailBase}/directory/photographers/${person.id}` as never)} style={styles.member}>
            <Text style={{ color: c.primary }}>{person.name} ›</Text>
          </Pressable>
        ) : <Text style={{ color: c.mutedForeground }}>{t('noThemePhotographers')}</Text>}
     </View> : null}
     {photographerItem ? <>
         {isOwnPhotographer && <Pressable accessibilityRole="button" testID="edit-own-photographer"
          onPress={() => router.push('/profile?edit=1')} style={[styles.editButton, { borderColor: c.border }]}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>{t('editProfile')}</Text>
        </Pressable>}
         {!isOwnPhotographer && (!isLoaded ? <ActivityIndicator color={c.primary} style={styles.followLoading} />
           : !isSignedIn ? <Pressable accessibilityRole="button" testID="sign-in-to-follow" onPress={() => router.push({ pathname: '/sign-in', params: { returnTo: returnAfterSignIn } })} style={[styles.followButton, { backgroundColor: c.primary, borderColor: c.primary }]}>
           <Feather name="user-plus" size={18} color={c.primaryForeground} />
           <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{t('signInToFollow')}</Text>
         </Pressable> : mine.isLoading || followStatus.isLoading ? <ActivityIndicator color={c.primary} style={styles.followLoading} />
           : mine.isError && mine.error.status !== 404 ? <Pressable accessibilityRole="button" onPress={() => { void mine.refetch(); }} style={styles.followLoading}><Text style={{ color: c.primary }}>{t('retry')}</Text></Pressable>
           : followStatus.isError || !followStatus.data ? <Pressable accessibilityRole="button" onPress={() => { void followStatus.refetch(); }} style={styles.followLoading}><Text style={{ color: c.primary }}>{t('followStatusUnavailable')} {t('retry')}</Text></Pressable>
           : <Pressable accessibilityRole="button" accessibilityState={{ selected: followStatus.data.following, disabled: toggleFollow.isPending }} testID="toggle-photographer-follow"
               disabled={toggleFollow.isPending} onPress={() => toggleFollow.mutate({ id })}
               style={[styles.followButton, { borderColor: c.primary, backgroundColor: followStatus.data.following ? c.background : c.primary, opacity: toggleFollow.isPending ? 0.5 : 1 }]}>
               <Feather name={followStatus.data.following ? 'user-check' : 'user-plus'} size={18} color={followStatus.data.following ? c.primary : c.primaryForeground} />
               <Text style={{ color: followStatus.data.following ? c.primary : c.primaryForeground, fontWeight: '700' }}>{t(followStatus.data.following ? 'unfollow' : 'follow')}</Text>
             </Pressable>)}
       <View style={[styles.metadata, styles.photographerMetrics]}>
         <Text style={[styles.metricColumn, { color: c.mutedForeground }]}>{t('linkedPhotos')}: {photographerItem.photoCount ?? 0}</Text>
         <Text style={[styles.metricColumn, { color: c.mutedForeground }]}>{t('themes')}: {photographerItem.themes?.length ?? 0}</Text>
         <Text style={[styles.metricColumn, { color: c.mutedForeground }]}>{t('clubs')}: {photographerItem.clubs.length}</Text>
       </View>
      {!!photographerItem.bio && <><Text style={[styles.section, { color: c.foreground }]}>{t('profileBio')}</Text><Text style={[styles.description, { color: c.mutedForeground, marginTop: 0 }]}>{photographerItem.bio}</Text></>}
      <Text style={[styles.section, { color: c.foreground }]}>{t('themes')}</Text>
       {photographerItem.themes?.length ? photographerItem.themes.map(theme =>
          <Pressable key={theme.id} accessibilityRole="link" onPress={() => router.push(`${detailBase}/directory/themes/${theme.id}` as never)} style={styles.member}><Text style={{ color: c.primary }}>{theme.name} ›</Text></Pressable>
       ) : <Text style={{ color: c.mutedForeground }}>{t('noThemesAvailable')}</Text>}
      <Text style={[styles.section, { color: c.foreground }]}>{t('clubs')}</Text>
       {photographerItem.clubs.length ? photographerItem.clubs.map(club =>
          <Pressable key={club.id} accessibilityRole="link" onPress={() => router.push(`${detailBase}/directory/clubs/${club.id}` as never)} style={styles.member}><Text style={{ color: c.primary }}>{club.name} ›</Text></Pressable>
       ) : <Text style={{ color: c.mutedForeground }}>{t('noClub')}</Text>}
    </> : null}
     <View style={styles.photoHeading}>
       <Text style={[styles.section, styles.photoHeadingTitle, { color: c.foreground }]}>{t(clubItem ? 'clubPhotos' : 'linkedPhotos')}</Text>
       {isOwnPhotographer && <Link href={{ pathname: '/(tabs)/my-photos', params: { reorder: '1' } }} asChild>
         <Pressable accessibilityRole="button" testID="reorder-own-photographs" style={styles.reorderLink}>
           <Feather name="move" size={16} color={c.primary} />
           <Text style={{ color: c.primary, fontWeight: '700' }}>{t('reorderAction')}</Text>
         </Pressable>
       </Link>}
     </View>
      {photos.isLoading ? <ActivityIndicator color={c.primary} /> : photos.isError ? <Text style={{ color: c.mutedForeground }}>{t('photosUnavailable')}</Text> : photos.data?.length ? <View style={styles.grid}>{photos.data.map(photo => <Pressable key={photo.id} style={styles.photo} onPress={() => router.push({ pathname: `${detailBase}/photo/[id]` as never, params: { id: String(photo.id), gallery } })}><Image source={resolveMediaUrl(photo.imageUrl)} style={styles.image} contentFit="cover" /><Text numberOfLines={1} style={{ color: c.foreground, marginTop: 6 }}>{photo.title}</Text></Pressable>)}</View> : <Text style={{ color: c.mutedForeground }}>{t('noLinkedPhotos')}</Text>}</ScrollView>;
}

export default function LegacyDirectoryDetail() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  return <Redirect href={`/gallery/directory/${kind}/${id}` as never} />;
}
function State({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.mutedForeground }}>{text}</Text></View>; }
 const styles = StyleSheet.create({
   root: { padding: 20, paddingBottom: 100 },
    listBack: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
   center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
   kicker: { letterSpacing: 2, fontSize: 10, fontWeight: '700' },
   title: { fontSize: 32, fontWeight: '700', marginTop: 8 },
   avatar: { width: 96, height: 96, borderRadius: 48, marginTop: 18 },
   description: { fontSize: 16, lineHeight: 24, marginTop: 14 },
   section: { fontSize: 21, fontWeight: '700', marginTop: 32, marginBottom: 14 },
    photoHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32, marginBottom: 14 },
    photoHeadingTitle: { flex: 1, marginTop: 0, marginBottom: 0 },
    reorderLink: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 4 },
   metadata: { gap: 10, marginTop: 18 },
   metadataRow: { flexDirection: 'row', gap: 12 },
   metadataCard: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, padding: 12, gap: 6 },
   metadataLabel: { fontSize: 12 },
   metadataValue: { fontSize: 16, fontWeight: '600' },
   metadataColumn: { flex: 1, fontSize: 13, lineHeight: 19 },
   photographerMetrics: { flexDirection: 'row', gap: 8 },
   metricColumn: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
    member: { minHeight: 44, justifyContent: 'center' },
    membershipButton: { borderWidth: 1, borderRadius: 7, minHeight: 44, paddingHorizontal: 16, marginTop: 16, alignSelf: 'flex-start', justifyContent: 'center' },
    followButton: { borderWidth: 1, borderRadius: 7, minHeight: 44, paddingHorizontal: 16, marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9 },
    followLoading: { alignSelf: 'flex-start', marginTop: 16, minHeight: 44, justifyContent: 'center' },
    editButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 7, paddingVertical: 12, paddingHorizontal: 16, marginTop: 20 },
   grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
   photo: { width: '48%', marginBottom: 14 },
   image: { width: '100%', aspectRatio: 1, borderRadius: 5 },
 });