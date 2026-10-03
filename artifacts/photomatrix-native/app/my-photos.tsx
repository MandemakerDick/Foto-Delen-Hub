import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { useAccountGuard } from '@/context/account-epoch';
import { invalidatePhotoCaches } from '@/utils/photoCache';
import {
  getGetMyProfileQueryKey, getGetPhotoQueryKey, getListGalleryPhotosQueryKey,
  getListLikedPhotosQueryKey, getListPhotosQueryKey, createPhoto, requestUploadUrl, useDeletePhoto,
  useGetMyProfile, useListPhotos, useListThemes, useReorderPhotos,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl, storageMediaPath } from '@/utils/media';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { AccountControl } from '@/components/AccountControl';
import { useTabBarVisibility } from '@/context/tab-bar';
import { UploadChoicePicker } from '@/components/UploadChoicePicker';
import { useTabPressReset } from '@/context/tab-reset';

export default function MyPhotos() {
  const c = useColors();
  const { t } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const isCurrentAccount = useAccountGuard();
  const router = useRouter();
  const { reorder: requestedReorder } = useLocalSearchParams<{ reorder?: string }>();
  const qc = useQueryClient();
  const profile = useGetMyProfile({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMyProfileQueryKey(),
      retry: (failures, error) => error.status !== 404 && failures < 2,
    },
  });
  const id = profile.data?.id;
  const themes = useListThemes();
  const mine = useListPhotos({ photographerId: id }, { query: { enabled: !!id, queryKey: ['my-photos', id] } });
  const remove = useDeletePhoto();
  const reorder = useReorderPhotos();
  const [isReordering, setIsReordering] = useState(false);
  const [localOrder, setLocalOrder] = useState<NonNullable<typeof mine.data>>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const savingOrderRef = useRef(false);

  const [view, setView] = useState<'photos' | 'upload'>('photos');
  const setTabBarHidden = useTabBarVisibility();
  useFocusEffect(useCallback(() => {
    setTabBarHidden(view === 'upload');
    return () => setTabBarHidden(false);
  }, [setTabBarHidden, view]));
  const [uploadStage, setUploadStage] = useState<'idle' | 'picking' | 'transferring' | 'saving'>('idle');
  const uploadController = useRef<AbortController | null>(null);
  const uploadScroll = useRef<ScrollView>(null);
  const photoList = useRef<FlatList>(null);
  useTabPressReset('my-photos', () => photoList.current?.scrollToOffset({ offset: 0, animated: false }));
  const savingUpload = useRef(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [clubId, setClubId] = useState<number | undefined>();
  const [themeId, setThemeId] = useState<number | undefined>();
  const [openPicker, setOpenPicker] = useState<'club' | 'theme' | null>(null);

  const refresh = (_photoId?: number) => isCurrentAccount() ? invalidatePhotoCaches(qc) : Promise.resolve();
  const cancelUpload = () => {
    if (savingUpload.current) return;
    uploadController.current?.abort();
    uploadController.current = null;
    setSelectedAsset(null);
    setUploadTitle('');
    setUploadDescription('');
    setClubId(undefined);
    setThemeId(undefined);
    setOpenPicker(null);
    setView('photos');
  };
  const selectPhoto = async (camera: boolean) => {
    if (uploadStage !== 'idle') return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploadStage('picking');
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (controller.signal.aborted) return;
      if (!permission.granted) {
        Alert.alert(t('permissionDenied'), t('permissionSettings'));
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ quality: .9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9 });
      if (controller.signal.aborted) return;
      if (result.canceled || !result.assets[0] || !id) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 25 * 1024 * 1024) {
        Alert.alert(t('fileTooLarge'), t('fileTooLargeBody'));
        return;
      }
      const type = asset.mimeType ?? 'image/jpeg';
      if (!type.startsWith('image/')) throw new Error(t('imagesOnly'));
      setSelectedAsset(asset);
      requestAnimationFrame(() => uploadScroll.current?.scrollTo({ y: 0, animated: true }));
    } catch (error: any) {
      if (!controller.signal.aborted) Alert.alert(t('uploadFailed'), error?.message ?? t('tryAgain'));
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
      setUploadStage('idle');
    }
  };
  const upload = async () => {
    if (uploadStage !== 'idle' || !selectedAsset || !id) return;
    if (!uploadTitle.trim()) {
      Alert.alert(t('titleRequired'), t('titleRequiredBody'));
      return;
    }
    if (clubId !== undefined && !profile.data?.clubs.some(club => club.id === clubId)) {
      Alert.alert(t('uploadFailed'), t('clubMembershipRequired'));
      return;
    }
    const controller = new AbortController();
    uploadController.current = controller;
    setUploadStage('transferring');
    let timedOut = false;
    const withDeadline = async <T,>(request: Promise<T>, milliseconds: number): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        return await Promise.race([
          request,
          new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error('Upload cancelled'));
            controller.signal.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => {
              timedOut = true;
              reject(new Error(t('uploadTimedOut')));
              controller.abort();
            }, milliseconds);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) controller.signal.removeEventListener('abort', onAbort);
      }
    };
    try {
      const name = selectedAsset.fileName ?? `photo-${Date.now()}.jpg`;
      const type = selectedAsset.mimeType ?? 'image/jpeg';
      const signed = await withDeadline(requestUploadUrl({ name, size: selectedAsset.fileSize ?? 1, contentType: type }, { signal: controller.signal }), 20_000);
      if (controller.signal.aborted || !isCurrentAccount()) return;
      const put = await withDeadline(expoFetch(signed.uploadURL, {
        method: 'PUT', body: new File(selectedAsset.uri), headers: { 'Content-Type': type }, signal: controller.signal,
      }), 120_000);
      if (controller.signal.aborted || !isCurrentAccount()) return;
      if (!put.ok) throw new Error(t('storageFailed'));
      savingUpload.current = true;
      setUploadStage('saving');
      const created = await createPhoto({
        title: uploadTitle.trim(), description: uploadDescription.trim() || undefined,
        imageUrl: storageMediaPath(signed.objectPath), photographerId: id, clubId, themeId,
      });
      if (!isCurrentAccount()) return;
      setSelectedAsset(null);
      setUploadTitle('');
      setUploadDescription('');
      setClubId(undefined);
      setThemeId(undefined);
      setOpenPicker(null);
      await refresh(created.id);
      if (isCurrentAccount()) setView('photos');
    } catch (error: any) {
      if (isCurrentAccount() && (!controller.signal.aborted || timedOut)) Alert.alert(t('uploadFailed'), error?.message ?? t('tryAgain'));
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
      savingUpload.current = false;
      setUploadStage('idle');
    }
  };

  const deletePhoto = (photoId: number) => Alert.alert(t('deleteConfirm'), '', [
    { text: t('cancel') },
    {
      text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          await remove.mutateAsync({ id: photoId });
          await refresh(photoId);
        } catch (error: any) {
          if (isCurrentAccount()) Alert.alert(t('deleteFailed'), error?.status === 409 ? t('photoInReview') : error?.message ?? t('tryAgain'));
        }
      },
    },
  ]);
  const startReordering = useCallback(() => {
    if (!mine.data || mine.data.length < 2) return;
    setLocalOrder([...mine.data]);
    setSelectedPhotoId(null);
    setIsReordering(true);
  }, [mine.data]);
  useEffect(() => {
    if (requestedReorder !== '1' || !id || mine.isLoading || mine.isError) return;
    router.setParams({ reorder: undefined });
    if (uploadStage !== 'idle' || selectedAsset) {
      Alert.alert(t('reorderAction'), t('finishUploadBeforeReorder'));
      return;
    }
    setView('photos');
    if (isReordering) return; // Keep an existing unsaved draft.
    if (!mine.data || mine.data.length < 2) {
      Alert.alert(t('reorderAction'), t('reorderNeedsPhotos'));
      return;
    }
    startReordering();
  }, [requestedReorder, id, mine.isLoading, mine.isError, mine.data, uploadStage, selectedAsset, isReordering, router, t, startReordering]);
  const cancelReordering = () => {
    if (savingOrderRef.current) return;
    setIsReordering(false);
    setLocalOrder([]);
    setSelectedPhotoId(null);
  };
  const placePhoto = (photoId: number) => {
    if (reorder.isPending) return;
    if (selectedPhotoId === null) {
      setSelectedPhotoId(photoId);
      return;
    }
    if (selectedPhotoId !== photoId) {
      setLocalOrder(current => {
        const from = current.findIndex(photo => photo.id === selectedPhotoId);
        const to = current.findIndex(photo => photo.id === photoId);
        if (from < 0 || to < 0) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    setSelectedPhotoId(null);
  };
  const saveOrder = async () => {
    if (savingOrderRef.current || !isReordering) return;
    savingOrderRef.current = true;
    try {
      await reorder.mutateAsync({ data: { photoIds: localOrder.map(photo => photo.id) } });
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['directory-photos', 'photographers', id] })]);
      if (!isCurrentAccount()) return;
      setIsReordering(false);
      setLocalOrder([]);
      setSelectedPhotoId(null);
    } catch (error: any) {
      if (isCurrentAccount()) Alert.alert(t('reorderFailed'), error?.message ?? t('tryAgain'));
    } finally {
      savingOrderRef.current = false;
    }
  };

  if (!isLoaded || (isSignedIn && profile.isLoading)) {
    return <View style={[styles.center, { backgroundColor: c.background }]}><Text style={{ color: c.mutedForeground }}>{t('loadingProfile')}</Text></View>;
  }
  if (isSignedIn && profile.isError && profile.error.status !== 404) {
    return <View style={[styles.center, { backgroundColor: c.background }]}>
      <View style={styles.accountCorner}><AccountControl /></View>
      <Text style={{ color: c.foreground }}>{t('profileUnavailable')}</Text>
      <Pressable accessibilityRole="button" onPress={() => profile.refetch()}><Text style={{ color: c.primary, marginTop: 16 }}>{t('retry')}</Text></Pressable>
    </View>;
  }
  if (!id) {
    return <View style={[styles.center, { backgroundColor: c.background }]}>
      <View style={styles.accountCorner}><AccountControl /></View>
       <Text style={[styles.kicker, { color: c.primary }]}>{t('myDarkroom')}</Text>
      <Text style={[styles.title, { color: c.foreground }]}>{t('myPhotos')}</Text>
      <Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 10 }}>{isSignedIn ? t('noPhotographerProfile') : t('signInManage')}</Text>
      {!isSignedIn ? <>
        <Link href={{ pathname: '/sign-in', params: { returnTo: '/(tabs)/my-photos' } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: c.primary }])}><Text style={{ color: c.primaryForeground }}>{t('signIn')}</Text></Pressable>
        </Link>
        <GoogleSignInButton />
      </> : <>
        <Link href="/invite" asChild><Pressable><Text style={{ color: c.primary, marginTop: 16 }}>{t('redeem')}</Text></Pressable></Link>
        <Link href="/profile" asChild><Pressable><Text style={{ color: c.primary, marginTop: 12 }}>{t('createProfile')}</Text></Pressable></Link>
      </>}
    </View>;
  }

  return <View style={[styles.root, { backgroundColor: c.background }]}>
    <Stack.Screen options={{ title: t('myPhotos') }} />
    <View style={styles.top}>
       <View>
          <Text style={[styles.kicker, { color: c.primary }]}>{t('myDarkroom')}</Text>
         <Text style={[styles.title, { color: c.foreground }]}>{t('myPhotos')}</Text>
         <Text style={{ color: c.mutedForeground }}>{profile.data?.name}</Text>
       </View>
      <AccountControl />
    </View>
      <Link href={`/(tabs)/my-photos/directory/photographers/${id}` as never} asChild><Pressable accessibilityRole="button"
       style={StyleSheet.flatten([styles.profileButton, { borderColor: c.border }])}>
       <Feather name="user" size={18} color={c.primary} />
        <Text style={{ color: c.primary, fontWeight: '700' }}>{t('viewProfile')}</Text>
     </Pressable></Link>
    <View style={styles.sections}>
      {(['photos', 'upload'] as const).map(section => <Pressable
        key={section} accessibilityRole="button" accessibilityState={{ selected: view === section }}
         disabled={uploadStage !== 'idle' || isReordering} onPress={() => setView(section)}
        style={[styles.section, { borderColor: view === section ? c.primary : c.border }]}
      ><Text style={{ color: view === section ? c.primary : c.foreground, fontWeight: '700' }}>{t(section === 'photos' ? 'yourPhotos' : 'uploadPhoto')}</Text></Pressable>)}
    </View>
    {view === 'photos' ? mine.isLoading ? <ActivityIndicator color={c.primary} /> : mine.isError
      ? <View style={styles.center}><Text style={{ color: c.mutedForeground }}>{t('loadPhotosError')}</Text><Pressable accessibilityRole="button" onPress={() => mine.refetch()}><Text style={{ color: c.primary, marginTop: 12 }}>{t('retry')}</Text></Pressable></View>
      : isReordering ? <View style={styles.reorderContainer}>
        <View style={styles.reorderHeader}>
          <Text style={[styles.reorderTitle, { color: c.mutedForeground }]}>{t('reorderPhotos')}</Text>
          <View style={styles.reorderActions}>
            <Pressable accessibilityRole="button" disabled={reorder.isPending} onPress={cancelReordering}
              style={styles.reorderAction}>
              <Feather name="x" size={16} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={reorder.isPending} onPress={() => void saveOrder()}
              style={[styles.saveOrder, { backgroundColor: c.primary, opacity: reorder.isPending ? 0.6 : 1 }]}>
              {reorder.isPending ? <ActivityIndicator size="small" color={c.primaryForeground} /> : <Feather name="check" size={16} color={c.primaryForeground} />}
              <Text style={{ color: c.primaryForeground }}>{t('saveOrder')}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.reorderHint, { color: c.mutedForeground }]}>{t('tapToReorder')}</Text>
        <FlatList
          ref={photoList} data={localOrder} keyExtractor={photo => String(photo.id)}
          numColumns={2} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.list}
          renderItem={({ item }) => <Pressable accessibilityRole="button"
            accessibilityLabel={item.title} accessibilityHint={t('tapToReorder')}
            accessibilityState={{ selected: selectedPhotoId === item.id }}
            disabled={reorder.isPending} onPress={() => placePhoto(item.id)} style={styles.gridPhoto}>
            <View style={[styles.gridImageFrame, { borderColor: selectedPhotoId === item.id ? c.primary : c.border }]}>
              <Image source={resolveMediaUrl(item.imageUrl)} style={styles.gridImage} contentFit="cover" />
              <View style={[styles.gridHandle, { backgroundColor: c.card }]}>
                <Feather name="move" size={14} color={c.foreground} />
              </View>
            </View>
            <Text style={[styles.gridTitle, { color: c.foreground }]} numberOfLines={1}>{item.title}</Text>
          </Pressable>}
        />
      </View> : <FlatList
         ref={photoList}
        data={mine.data ?? []} keyExtractor={photo => String(photo.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={{ color: c.mutedForeground }}>{t('noPhotos')}</Text>}
        renderItem={({ item }) => <View style={[styles.card, { borderColor: c.border }]}>
          <View style={styles.photoRow}>
             <Pressable accessibilityRole="button" accessibilityLabel={`${t('viewPhoto')}: ${item.title}`}
               onPress={() => router.push({ pathname: '/(tabs)/my-photos/photo/[id]', params: { id: String(item.id) } })}>
               <Image source={resolveMediaUrl(item.imageUrl)} style={styles.thumb} contentFit="cover" />
             </Pressable>
            <View style={styles.photoInfo}>
              <Text style={{ color: c.foreground, fontWeight: '700' }} numberOfLines={2}>{item.title}</Text>
               <Text style={{ color: c.mutedForeground }}>{item.themeName ?? t('noTheme')}</Text>
               <Text numberOfLines={1} style={{ color: c.mutedForeground }}>{t('club')}: {item.clubName ?? t('noClub')}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable accessibilityRole="button"
                onPress={() => router.push({ pathname: '/photo/[id]', params: { id: String(item.id), edit: '1' } })}
                style={styles.cardAction}><Text style={{ color: c.primary }}>{t('edit')}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={(mine.data?.length ?? 0) < 2}
                onPress={startReordering}
                style={styles.cardAction}><Text style={{ color: (mine.data?.length ?? 0) < 2 ? c.mutedForeground : c.primary }}>{t('move')}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => deletePhoto(item.id)}
                style={styles.cardAction}><Text style={{ color: c.primary }}>{t('delete')}</Text></Pressable>
            </View>
          </View>
        </View>}
      />
      : <ScrollView ref={uploadScroll} contentContainerStyle={styles.uploadForm} keyboardShouldPersistTaps="handled">
        {selectedAsset ? <View style={styles.selection}>
          <Image source={selectedAsset.uri} contentFit="contain" style={[styles.preview, { backgroundColor: c.card }]} />
          <Text style={{ color: c.mutedForeground }}>{selectedAsset.fileName ?? t('selectedPhoto')}</Text>
          <Text style={{ color: c.mutedForeground }}>{t('reviewPhoto')}</Text>
        </View> : null}
        <TextInput value={uploadTitle} onChangeText={setUploadTitle} placeholder={t('photoTitle')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
        <TextInput value={uploadDescription} onChangeText={setUploadDescription} placeholder={t('photoDescription')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
          <UploadChoicePicker label={t('club')} noneLabel={t('noClub')} emptyLabel={t('noMemberClubs')}
            choices={profile.data?.clubs ?? []} value={clubId} onChange={setClubId}
           open={openPicker === 'club'} onToggle={() => setOpenPicker(openPicker === 'club' ? null : 'club')}
            onClose={() => setOpenPicker(null)} loading={false} error={false}
            onRetry={() => { void profile.refetch(); }} disabled={uploadStage !== 'idle'} />
          <Link href={{ pathname: '/feedback', params: { clubProposal: '1' } }} asChild>
            <Pressable accessibilityRole="link" style={styles.proposeClub}>
              <Text style={{ color: c.primary }}>{t('proposeClub')}</Text>
            </Pressable>
          </Link>
          <UploadChoicePicker label={t('theme')} noneLabel={t('noTheme')} emptyLabel={t('noThemesAvailable')}
            choices={themes.data ?? []} value={themeId} onChange={setThemeId}
            open={openPicker === 'theme'} onToggle={() => setOpenPicker(openPicker === 'theme' ? null : 'theme')}
            onClose={() => setOpenPicker(null)}
            loading={themes.isLoading} error={themes.isError}
            onRetry={() => { void themes.refetch(); }} disabled={uploadStage !== 'idle'} />
          <Link href={{ pathname: '/feedback', params: { themeProposal: '1' } }} asChild>
            <Pressable accessibilityRole="link" style={styles.proposeClub}>
              <Text style={{ color: c.primary }}>{t('proposeTheme')}</Text>
            </Pressable>
          </Link>
        <View style={styles.uploadRow}>
          <Pressable accessibilityRole="button" onPress={() => selectPhoto(false)} disabled={uploadStage !== 'idle'}
            style={[styles.sourceButton, { borderColor: c.border, opacity: uploadStage !== 'idle' ? 0.5 : 1 }]}>
            <Feather name="image" size={18} color={c.primary} /><Text style={[styles.sourceButtonLabel, { color: c.foreground }]}>{t('library')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => selectPhoto(true)} disabled={uploadStage !== 'idle'}
            style={[styles.sourceButton, { borderColor: c.border, opacity: uploadStage !== 'idle' ? 0.5 : 1 }]}>
            <Feather name="camera" size={18} color={c.primary} /><Text style={[styles.sourceButtonLabel, { color: c.foreground }]}>{t('camera')}</Text>
          </Pressable>
        </View>
        {selectedAsset ? <Pressable accessibilityRole="button" disabled={uploadStage !== 'idle'} onPress={upload} style={[styles.button, { backgroundColor: c.primary }]}>
            <Text style={{ color: c.primaryForeground }}>{uploadStage === 'transferring' ? t('uploadingPhoto') : t('uploadPhoto')}</Text>
          </Pressable> : null}
        <Pressable accessibilityRole="button" disabled={uploadStage === 'saving'} onPress={cancelUpload} style={[styles.cancelUpload, { borderColor: c.border }]}>
          <Text style={{ color: uploadStage === 'saving' ? c.mutedForeground : c.foreground }}>{uploadStage === 'saving' ? t('finishingUpload') : t('cancel')}</Text>
        </Pressable>
      </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 },
  accountCorner: { position: 'absolute', top: 12, right: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   kicker: { fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700' },
  profileButton: { borderWidth: 1, borderRadius: 7, marginTop: 16, padding: 12, minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  sections: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  section: { flex: 1, borderWidth: 1, borderRadius: 7, padding: 12, alignItems: 'center' },
  list: { paddingBottom: 30, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 7, padding: 12, marginBottom: 12 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 4 },
  photoInfo: { flex: 1, gap: 4 },
  input: { borderWidth: 1, borderRadius: 6, padding: 11, marginTop: 10 },
  cardActions: { alignItems: 'flex-end', minWidth: 72 },
  cardAction: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 4 },
  reorderContainer: { flex: 1 },
  reorderHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  reorderTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  reorderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reorderAction: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 4 },
  saveOrder: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 6, paddingHorizontal: 12 },
  reorderHint: { fontSize: 13, marginBottom: 12 },
  gridRow: { justifyContent: 'space-between' },
  gridPhoto: { width: '48%', marginBottom: 16 },
  gridImageFrame: { borderWidth: 2, borderRadius: 5, overflow: 'hidden' },
  gridImage: { width: '100%', aspectRatio: 4 / 5 },
  gridHandle: { position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  gridTitle: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  uploadForm: { paddingBottom: 40 },
  uploadRow: { flexDirection: 'row', gap: 10 },
  sourceButton: { flex: 1, minWidth: 0, marginTop: 15, minHeight: 64, paddingHorizontal: 8, borderWidth: 1, borderRadius: 7, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  sourceButtonLabel: { flexShrink: 1, textAlign: 'center' },
  proposeClub: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  selection: { marginTop: 15, gap: 8 },
  preview: { width: '100%', height: 180, borderRadius: 6 },
  button: { marginTop: 15, padding: 14, alignItems: 'center', borderRadius: 6 },
  cancelUpload: { alignItems: 'center', marginTop: 15, borderWidth: 1, borderRadius: 6, padding: 14 },
});