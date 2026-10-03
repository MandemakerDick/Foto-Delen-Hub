import { Link, Redirect, Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useAccountGuard } from '@/context/account-epoch';
import { invalidatePhotoCaches } from '@/utils/photoCache';
import { getGetMyProfileQueryKey, getGetPhotoQueryKey, getListClubsQueryKey, getListGalleryPhotosQueryKey, getListLikedPhotosQueryKey, getListPhotosQueryKey, getListThemesQueryKey, getPhoto, listGalleryPhotos, useCreateComment, useGetMyProfile, useGetPhoto, useListClubs, useListComments, useGetPhotoLikeStatus, useListThemes, useTogglePhotoLike, useUpdatePhoto } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl } from '@/utils/media';
import { detailBasePath } from '@/utils/detail-routes';
export function PhotoDetail() {
   const c=useColors(); const {t,locale}=useLocale(); const {isSignedIn}=useAuth(); const router=useRouter(); const queryClient=useQueryClient(); const {id,gallery,edit}=useLocalSearchParams<{id:string;gallery?:string;edit?:string}>(); const photoId=Number(id);
   const isCurrentAccount = useAccountGuard();
   const detailBase = detailBasePath(usePathname());
  const galleryQuery = useMemo<NonNullable<Parameters<typeof listGalleryPhotos>[0]>>(() => {
    const p = new URLSearchParams(gallery ?? '');
    const numbers = (value: string | null) => value?.split(',').filter(x => /^\d+$/.test(x)).join(',') || undefined;
    const photographerId = Number(p.get('photographer'));
    const seed = Number(p.get('seed'));
    const group = p.get('group');
    const sort = p.get('sort');
    return {
      search: p.get('search') || undefined, clubIds: numbers(p.get('clubs')), themeIds: numbers(p.get('themes')),
      photographerId: Number.isSafeInteger(photographerId) && photographerId > 0 ? photographerId : undefined,
      from: p.get('from') || undefined, to: p.get('to') || undefined,
      group: group === 'club' || group === 'theme' || group === 'photographer' ? group : 'none',
      sort: sort === 'oldest' || sort === 'photographer' || sort === 'likes' || sort === 'comments' || sort === 'random' ? sort : 'newest',
      seed: sort === 'random' && Number.isSafeInteger(seed) && seed > 0 ? seed : undefined, limit: 24 as const,
    };
  }, [gallery]);
  const browse = useInfiniteQuery({ queryKey: getListGalleryPhotosQueryKey(galleryQuery), enabled: gallery !== undefined, staleTime: 60_000, initialPageParam: undefined as string | undefined, queryFn: ({pageParam,signal}) => listGalleryPhotos({...galleryQuery,cursor:pageParam},{signal}), getNextPageParam: page => page.hasMore ? page.nextCursor ?? undefined : undefined });
  const galleryPhotos = browse.data?.pages.flatMap(page => page.items) ?? [];
  const currentIndex = galleryPhotos.findIndex(photo => photo.id === photoId);
  const [navigating, setNavigating] = useState(false);
  const navigate = async (direction: -1 | 1) => {
    if (navigating || currentIndex < 0) return;
    setNavigating(true);
    try {
      let next: (typeof galleryPhotos)[number] | undefined = galleryPhotos[currentIndex + direction];
      if (!next && direction === 1 && browse.hasNextPage) {
        const result = await browse.fetchNextPage();
        next = result.data?.pages.flatMap(page => page.items)[currentIndex + 1];
      }
       if (next) {
         await queryClient.ensureQueryData({ queryKey: getGetPhotoQueryKey(next.id), queryFn: () => getPhoto(next.id) });
         await Image.prefetch(resolveMediaUrl(next.imageUrl)).catch(() => false);
         router.setParams({ id: String(next.id) });
       }
    } catch { Alert.alert(t('error'), t('tryAgain')); } finally { setNavigating(false); }
  };
   const q=useGetPhoto(photoId); const likes=useGetPhotoLikeStatus(photoId,{query:{enabled:!!isSignedIn,queryKey:['photo-like',photoId]}}); const comments=useListComments(photoId); const toggle=useTogglePhotoLike({mutation:{onSuccess:()=>{if (!isCurrentAccount()) return; likes.refetch();void invalidatePhotoCaches(queryClient);},onError:()=>{if (isCurrentAccount()) Alert.alert(t('likeFailed'),t('signInLike'));}}}); const add=useCreateComment({mutation:{onSuccess:()=>{if (!isCurrentAccount()) return; setBody('');comments.refetch();void invalidatePhotoCaches(queryClient);},onError:()=>{if (isCurrentAccount()) Alert.alert(t('commentFailed'),t('tryAgain'));}}}); const [body,setBody]=useState('');
   const profile = useGetMyProfile({ query: { enabled: !!isSignedIn, queryKey: getGetMyProfileQueryKey(), retry: (failures, error) => error.status !== 404 && failures < 2 } });
    const [editingPhotoId, setEditingPhotoId] = useState<number | null>(() => edit === '1' ? photoId : null);
    const initializedEditId = useRef<number | null>(null);
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
    const [clubId, setClubId] = useState<number | null>(null);
    const [themeId, setThemeId] = useState<number | null>(null);
     const [clubPickerOpen, setClubPickerOpen] = useState(false);
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    useEffect(() => {
      if (edit !== '1' || !q.data || editingPhotoId !== photoId || initializedEditId.current === photoId) return;
      initializedEditId.current = photoId;
      setTitle(q.data.title);
      setDescription(q.data.description ?? '');
       setClubId(q.data.clubId ?? null);
       setThemeId(q.data.themeId ?? null);
    }, [edit, q.data, editingPhotoId, photoId]);
    const clubs = useListClubs(undefined, { query: { enabled: editingPhotoId === photoId, queryKey: getListClubsQueryKey() } });
   const themes = useListThemes(undefined, { query: { enabled: editingPhotoId === photoId, queryKey: getListThemesQueryKey() } });
   const update = useUpdatePhoto();
   const save = async () => {
     if (!title.trim()) { Alert.alert(t('titleRequired'), t('titleRequiredBody')); return; }
     try {
        await update.mutateAsync({ id: photoId, data: {
           title: title.trim(), description, themeId,
          ...(clubId !== (q.data?.clubId ?? null) ? { clubId } : {}),
        } });
       if (!isCurrentAccount()) return;
       setEditingPhotoId(null);
         setClubPickerOpen(false);
        setThemePickerOpen(false);
       await invalidatePhotoCaches(queryClient);
       if (!isCurrentAccount()) return;
        if (edit === '1') {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/my-photos');
        }
     } catch (error: any) { if (isCurrentAccount()) Alert.alert(t('saveFailed'), error?.message ?? t('tryAgain')); }
   };
 if(q.isLoading)return <View style={[styles.center,{backgroundColor:c.background}]}><ActivityIndicator color={c.primary}/></View>;
 if(q.isError||!q.data)return <View style={[styles.center,{backgroundColor:c.background}]}><Text style={{color:c.mutedForeground}}>{t('photographUnavailable')}</Text></View>;
   const p=q.data; return <ScrollView style={{backgroundColor:c.background}} contentContainerStyle={styles.root}><Stack.Screen options={{title:p.title}}/><Image source={resolveMediaUrl(p.imageUrl)} contentFit="contain" style={[styles.image,{backgroundColor:c.card}]}/>
    {isSignedIn && profile.data?.id === p.photographerId ? <View style={styles.owner}>
      {editingPhotoId === photoId ? <View style={[styles.editor, { borderColor: c.border }]}>
        <Text style={[styles.label, { color: c.foreground }]}>{t('photoTitle')}</Text>
        <TextInput value={title} onChangeText={setTitle} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
        <Text style={[styles.label, { color: c.foreground }]}>{t('photoDescription')}</Text>
        <TextInput value={description} onChangeText={setDescription} multiline style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
         <Text style={[styles.label, { color: c.foreground }]}>{t('club')}</Text>
          {clubs.isError ? <Pressable accessibilityRole="button" onPress={() => clubs.refetch()}><Text style={{ color: c.primary }}>{t('retry')}</Text></Pressable> : <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: clubPickerOpen }} onPress={() => setClubPickerOpen(open => !open)} style={[styles.themePicker, { borderColor: c.border }]}>
              <Text style={{ color: c.foreground }}>{clubId === null ? t('noClub') : clubs.data?.find(club => club.id === clubId)?.name ?? (clubId === p.clubId ? p.clubName : undefined) ?? t('club')}</Text>
              <Feather name={clubPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.foreground} />
            </Pressable>
            {clubPickerOpen ? <ScrollView nestedScrollEnabled style={[styles.themeOptions, { borderColor: c.border }]}>
              {clubs.isLoading ? <ActivityIndicator color={c.primary} /> : <>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: clubId === null }} onPress={() => { setClubId(null); setClubPickerOpen(false); }} style={styles.themeOption}><Text style={{ color: c.foreground }}>{t('noClub')}</Text></Pressable>
                 {clubs.data?.length === 0 ? <Text style={[styles.themeOption, { color: c.mutedForeground }]}>{t('noClubsAvailable')}</Text> : null}
                 {(clubs.data ?? []).map(club =>
                  <Pressable key={club.id} accessibilityRole="button" accessibilityState={{ selected: clubId === club.id }} onPress={() => { setClubId(club.id); setClubPickerOpen(false); }} style={styles.themeOption}><Text style={{ color: c.foreground }}>{club.name}</Text></Pressable>
                )}
              </>}
            </ScrollView> : null}
          </>}
          <Link href={{ pathname: '/feedback', params: { clubProposal: '1' } }} asChild>
            <Pressable accessibilityRole="link" style={styles.themeOption}>
              <Text style={{ color: c.primary }}>{t('proposeClub')}</Text>
            </Pressable>
          </Link>
         <Text style={[styles.label, { color: c.foreground }]}>{t('theme')}</Text>
         {themes.isError ? <Pressable accessibilityRole="button" onPress={() => themes.refetch()}><Text style={{ color: c.primary }}>{t('retry')}</Text></Pressable> : <>
           <Pressable accessibilityRole="button" accessibilityState={{ expanded: themePickerOpen }} onPress={() => setThemePickerOpen(open => !open)} style={[styles.themePicker, { borderColor: c.border }]}>
             <Text style={{ color: c.foreground }}>{themeId === null ? t('noTheme') : themes.data?.find(theme => theme.id === themeId)?.name ?? t('theme')}</Text>
             <Feather name={themePickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.foreground} />
           </Pressable>
           {themePickerOpen ? <ScrollView nestedScrollEnabled style={[styles.themeOptions, { borderColor: c.border }]}>
             {themes.isLoading ? <ActivityIndicator color={c.primary} /> : <>
               <Pressable accessibilityRole="button" accessibilityState={{ selected: themeId === null }} onPress={() => { setThemeId(null); setThemePickerOpen(false); }} style={styles.themeOption}><Text style={{ color: c.foreground }}>{t('noTheme')}</Text></Pressable>
               {(themes.data ?? []).map(theme => <Pressable key={theme.id} accessibilityRole="button" accessibilityState={{ selected: themeId === theme.id }} onPress={() => { setThemeId(theme.id); setThemePickerOpen(false); }} style={styles.themeOption}><Text style={{ color: c.foreground }}>{theme.name}</Text></Pressable>)}
              </>}
            </ScrollView> : null}
          </>}
          <Link href={{ pathname: '/feedback', params: { themeProposal: '1' } }} asChild>
            <Pressable accessibilityRole="link" style={styles.themeOption}>
              <Text style={{ color: c.primary }}>{t('proposeTheme')}</Text>
            </Pressable>
          </Link>
          <View style={styles.actions}>
           <Pressable accessibilityRole="button" disabled={update.isPending} onPress={save}
             style={[styles.actionButton, { backgroundColor: c.primary, opacity: update.isPending ? 0.5 : 1 }]}>
             <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{t('save')}</Text>
           </Pressable>
           <Pressable accessibilityRole="button" disabled={update.isPending}
             onPress={() => {
               setEditingPhotoId(null); setClubPickerOpen(false); setThemePickerOpen(false);
               if (edit === '1') {
                 if (router.canGoBack()) router.back();
                 else router.replace('/(tabs)/my-photos');
               }
             }}
             style={[styles.actionButton, { borderColor: c.border, borderWidth: 1, opacity: update.isPending ? 0.5 : 1 }]}>
             <Text style={{ color: c.foreground, fontWeight: '700' }}>{t('cancel')}</Text>
           </Pressable>
         </View>
      </View> : <Pressable accessibilityRole="button" onPress={() => {
           router.push({ pathname: '/photo/[id]', params: { id: String(photoId), edit: '1', ...(gallery !== undefined ? { gallery } : {}) } });
      }} style={[styles.editButton, { borderColor: c.primary }]}>
        <Feather name="edit-2" size={16} color={c.primary} /><Text style={{ color: c.primary, fontWeight: '700' }}>{t('editPhoto')}</Text>
      </Pressable>}
    </View> : null}
   {gallery !== undefined && currentIndex >= 0 ? <View style={styles.navigation}>
     <Pressable accessibilityRole="button" accessibilityLabel={t('previousPhoto')} disabled={navigating || currentIndex === 0} onPress={() => navigate(-1)} style={styles.navButton}><Feather name="chevron-left" size={28} color={currentIndex === 0 ? c.mutedForeground : c.primary}/><Text style={{color:currentIndex === 0 ? c.mutedForeground : c.primary}}>{t('previousPhoto')}</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={t('nextPhoto')} disabled={navigating || (currentIndex === galleryPhotos.length - 1 && !browse.hasNextPage)} onPress={() => navigate(1)} style={styles.navButton}><Text style={{color:currentIndex === galleryPhotos.length - 1 && !browse.hasNextPage ? c.mutedForeground : c.primary}}>{t('nextPhoto')}</Text><Feather name="chevron-right" size={28} color={currentIndex === galleryPhotos.length - 1 && !browse.hasNextPage ? c.mutedForeground : c.primary}/></Pressable>
   </View> : null}
    <Text style={[styles.title,{color:c.foreground}]}>{p.title}</Text>
     <Pressable accessibilityRole="link" testID="photo-photographer-link" onPress={() => router.push(`${detailBase}/directory/photographers/${p.photographerId}` as never)} style={styles.metadataLink}>
      <Text style={{color:c.primary}}>{p.photographerName ?? t('unknown')} ›</Text>
    </Pressable>
     {p.clubId ? <Pressable accessibilityRole="link" testID="photo-club-link" onPress={() => router.push(`${detailBase}/directory/clubs/${p.clubId}` as never)} style={styles.metadataLink}>
      <Text style={{color:c.primary}}>{t('club')}: {p.clubName} ›</Text>
    </Pressable> : <Text style={[styles.metadataText,{color:c.mutedForeground}]}>{t('club')}: {t('noClub')}</Text>}
     {p.themeId ? <Pressable accessibilityRole="link" testID="photo-theme-link" onPress={() => router.push(`${detailBase}/directory/themes/${p.themeId}` as never)} style={styles.metadataLink}>
      <Text style={{color:c.primary}}>{t('theme')}: {p.themeName} ›</Text>
    </Pressable> : <Text style={[styles.metadataText,{color:c.mutedForeground}]}>{t('theme')}: {t('noTheme')}</Text>}
    {p.description ? <Text style={{color:c.foreground,lineHeight:24,marginTop:22,marginHorizontal:20}}>{p.description}</Text> : null}
    <View style={styles.meta}><Pressable disabled={toggle.isPending} onPress={()=>isSignedIn?toggle.mutate({id:photoId}):Alert.alert(t('signInLike'),t('signInLike'))}><Text style={{color:c.primary}}>♥ {p.likeCount??0} {likes.data?.liked?t('liked'):t('like')}</Text></Pressable><Text style={{color:c.mutedForeground}}>◌ {p.commentCount??0} {t('comments')}</Text></View>
    <Text style={{color:c.foreground,fontWeight:'700',margin:20}}>{t('conversation')}</Text>
    {comments.data?.map(comment => <View key={comment.id} style={styles.commentItem}>
      <Text style={{color:c.foreground,fontWeight:'600'}}>{comment.photographerName ?? t('unknown')}</Text>
      <Text style={{color:c.mutedForeground,fontSize:12,marginTop:2}}>{new Date(comment.createdAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { day:'numeric',month:'short',year:'numeric' })}</Text>
      <Text style={{color:c.mutedForeground,marginTop:6}}>{comment.body}</Text>
    </View>)}
    {isSignedIn?<View style={[styles.comment,{borderColor:c.border}]}><TextInput value={body} onChangeText={setBody} placeholder={t('addComment')} placeholderTextColor={c.mutedForeground} style={{color:c.foreground,flex:1}}/><Pressable disabled={add.isPending} onPress={()=>{if(body.trim())add.mutate({id:photoId,data:{body:body.trim()}})}}><Text style={{color:c.primary}}>{t('post')}</Text></Pressable></View>:<Text style={{color:c.mutedForeground,margin:20}}>{t('signInComment')}</Text>}
  </ScrollView>;
}

export default function PhotoRoute() {
  const { id, gallery, edit } = useLocalSearchParams<{ id: string; gallery?: string; edit?: string }>();
  if (edit === '1') return <PhotoDetail />;
  return <Redirect href={{ pathname: '/(tabs)/gallery/photo/[id]', params: { id, ...(gallery !== undefined ? { gallery } : {}) } }} />;
}
  const styles=StyleSheet.create({root:{paddingBottom:80},image:{width:'100%',aspectRatio:1},owner:{marginHorizontal:20,marginTop:14},editButton:{borderWidth:1,borderRadius:7,padding:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,minHeight:44},editor:{borderWidth:1,borderRadius:7,padding:14},label:{fontWeight:'700',marginTop:10},input:{borderWidth:1,borderRadius:6,padding:11,marginTop:8},themePicker:{borderWidth:1,borderRadius:6,padding:12,marginTop:8,minHeight:44,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},themeOptions:{borderWidth:1,borderRadius:6,maxHeight:220,marginTop:4},themeOption:{padding:12,minHeight:44,justifyContent:'center'},actions:{flexDirection:'row',gap:10,marginTop:20,marginBottom:6},actionButton:{flex:1,minHeight:44,padding:12,borderRadius:7,alignItems:'center',justifyContent:'center'},navigation:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:16,paddingTop:12},navButton:{flexDirection:'row',alignItems:'center',minHeight:44},title:{fontSize:28,fontWeight:'700',marginHorizontal:20,marginTop:22},metadataLink:{marginHorizontal:20,minHeight:44,justifyContent:'center'},metadataText:{marginHorizontal:20,minHeight:36,textAlignVertical:'center'},meta:{flexDirection:'row',gap:24,margin:20,marginTop:28},commentItem:{marginHorizontal:20,marginBottom:16},comment:{margin:20,padding:12,borderWidth:1,borderRadius:7,flexDirection:'row',alignItems:'center'},center:{flex:1,alignItems:'center',justifyContent:'center'}});