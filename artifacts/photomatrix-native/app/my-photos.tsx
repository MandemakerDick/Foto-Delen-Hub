import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useClerk } from '@clerk/expo';
import { getGetMyProfileQueryKey, useCreatePhoto, useDeletePhoto, useGetMyProfile, useListClubs, useListPhotos, useListThemes, useRequestUploadUrl, useUpdatePhoto } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl, storageMediaPath } from '@/utils/media';
import { invalidatePhotoCaches } from '@/utils/photoCache';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export default function MyPhotos() {
  const c = useColors(); const { t } = useLocale(); const { isSignedIn } = useAuth();
  const profile = useGetMyProfile({ query: { enabled: !!isSignedIn, queryKey: getGetMyProfileQueryKey() } }); const id = profile.data?.id;
  const clubs = useListClubs(); const themes = useListThemes(); const mine = useListPhotos({ photographerId: id }, { query: { enabled: !!id, queryKey: ['my-photos', id] } });
  const qc = useQueryClient(); const { signOut } = useClerk(); const request = useRequestUploadUrl(); const create = useCreatePhoto(); const update = useUpdatePhoto(); const remove = useDeletePhoto();
  const [busy, setBusy] = useState(false); const [editing, setEditing] = useState<number | null>(null); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [uploadTitle, setUploadTitle] = useState(''); const [uploadDescription, setUploadDescription] = useState(''); const [clubId, setClubId] = useState<number | undefined>(); const [themeId, setThemeId] = useState<number | undefined>();
  const refresh = () => invalidatePhotoCaches(qc);
  const upload = async (camera: boolean) => {
    if (!uploadTitle.trim()) { Alert.alert(t('titleRequired'), t('titleRequiredBody')); return; }
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('permissionDenied'), t('permissionSettings')); return; }
    const result = camera ? await ImagePicker.launchCameraAsync({ quality: .9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9 });
    if (result.canceled || !result.assets[0] || !id) return; const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 25 * 1024 * 1024) { Alert.alert(t('fileTooLarge'), t('fileTooLargeBody')); return; }
    setBusy(true);
    try {
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`; const type = asset.mimeType ?? 'image/jpeg';
      if (!type.startsWith('image/')) throw new Error(t('imagesOnly'));
      const signed = await request.mutateAsync({ data: { name, size: asset.fileSize ?? 1, contentType: type } });
      const put = await expoFetch(signed.uploadURL, { method: 'PUT', body: new File(asset.uri), headers: { 'Content-Type': type } });
      if (!put.ok) throw new Error(t('storageFailed'));
      await create.mutateAsync({ data: { title: uploadTitle.trim(), description: uploadDescription.trim() || undefined, imageUrl: storageMediaPath(signed.objectPath), photographerId: id, clubId, themeId } });
      setUploadTitle(''); setUploadDescription(''); void refresh();
    } catch (e: any) { Alert.alert(t('uploadFailed'), e?.message ?? t('tryAgain')); } finally { setBusy(false); }
  };
  if (profile.isLoading) return <View style={[styles.center, { backgroundColor: c.background }]}><Text style={{ color: c.mutedForeground }}>{t('loadingProfile')}</Text></View>;
  if (!id) return <View style={[styles.center, { backgroundColor: c.background }]}><Text style={[styles.title, { color: c.foreground }]}>{t('myPhotos')}</Text><Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 10 }}>{t('signInManage')}</Text><Link href="/sign-in" asChild><Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: c.primary }])}><Text style={{ color: c.primaryForeground }}>{t('signIn')}</Text></Pressable></Link><Link href="/profile" asChild><Pressable><Text style={{ color: c.primary, marginTop: 16 }}>{t('profile')}</Text></Pressable></Link><Link href="/invite" asChild><Pressable><Text style={{ color: c.primary, marginTop: 12 }}>{t('invite')}</Text></Pressable></Link></View>;
  return <View style={[styles.root, { backgroundColor: c.background }]}>
    <Stack.Screen options={{ title: t('myPhotos') }} />
    <View style={styles.top}>
      <View><Text style={[styles.title, { color: c.foreground }]}>{t('myPhotos')}</Text><Text style={{ color: c.mutedForeground }}>{profile.data?.name}</Text></View>
      <Pressable onPress={() => signOut()}><Text style={{ color: c.primary }}>{t('signOut')}</Text></Pressable>
    </View>
    <TextInput value={uploadTitle} onChangeText={setUploadTitle} placeholder={t('photoTitle')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
    <TextInput value={uploadDescription} onChangeText={setUploadDescription} placeholder={t('photoDescription')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
    <View style={styles.chips}>
      {(clubs.data ?? []).filter(club => (profile.data?.clubs ?? []).some(member => member.id === club.id)).map(club =>
        <Pressable key={club.id} onPress={() => setClubId(clubId === club.id ? undefined : club.id)} style={[styles.chip, { borderColor: clubId === club.id ? c.primary : c.border }]}>
          <Text style={{ color: c.mutedForeground }}>{club.name}</Text>
        </Pressable>
      )}
      {(themes.data ?? []).map(theme =>
        <Pressable key={theme.id} onPress={() => setThemeId(themeId === theme.id ? undefined : theme.id)} style={[styles.chip, { borderColor: themeId === theme.id ? c.primary : c.border }]}>
          <Text style={{ color: c.mutedForeground }}>#{theme.name}</Text>
        </Pressable>
      )}
    </View>
    <View style={styles.uploadRow}>
      <Pressable onPress={() => upload(false)} disabled={busy} style={[styles.button, { backgroundColor: c.primary, flex: 1 }]}><Text style={{ color: c.primaryForeground }}>{t('library')}</Text></Pressable>
      <Pressable onPress={() => upload(true)} disabled={busy} style={[styles.button, { backgroundColor: c.secondary, flex: 1 }]}><Text style={{ color: c.foreground }}>{t('camera')}</Text></Pressable>
    </View>
    {mine.isError
      ? <Text style={{ color: c.mutedForeground, padding: 20 }}>{t('loadPhotosError')} <Text onPress={() => mine.refetch()} style={{ color: c.primary }}>{t('retry')}</Text></Text>
      : <FlatList data={mine.data ?? []} keyExtractor={p => String(p.id)} contentContainerStyle={{ paddingVertical: 18 }} ListEmptyComponent={<Text style={{ color: c.mutedForeground }}>{t('noPhotos')}</Text>} renderItem={({ item }) =>
          <View style={[styles.card, { borderColor: c.border }]}>
            <Image source={resolveMediaUrl(item.imageUrl)} style={styles.thumb}/>
            {editing === item.id
              ? <TextInput value={title} onChangeText={setTitle} style={[styles.edit, { color: c.foreground, borderColor: c.border }]} />
              : <Text style={{ color: c.foreground, flex: 1 }}>{item.title}</Text>}
            <View style={styles.actions}>
              {editing === item.id
                ? <Pressable onPress={async () => {
                    if (!title.trim()) return Alert.alert(t('titleRequired'), t('titleRequiredBody'));
                    try {
                      await update.mutateAsync({ id: item.id, data: { title: title.trim(), description } });
                      setEditing(null);
                      void refresh();
                    } catch (e: any) { Alert.alert(t('saveFailed'), e?.message ?? t('tryAgain')); }
                  }}><Text style={{ color: c.primary }}>{t('save')}</Text></Pressable>
                : <Pressable onPress={() => { setEditing(item.id); setTitle(item.title); setDescription(item.description ?? ''); }}><Text style={{ color: c.mutedForeground }}>{t('edit')}</Text></Pressable>}
              <Pressable onPress={() => Alert.alert(t('deleteConfirm'), '', [
                { text: t('cancel') },
                { text: t('delete'), style: 'destructive', onPress: async () => {
                  try {
                    await remove.mutateAsync({ id: item.id });
                    void refresh();
                  } catch (e: any) { Alert.alert(t('deleteFailed'), e?.message ?? t('tryAgain')); }
                } },
              ])}><Text style={{ color: c.primary }}>{t('delete')}</Text></Pressable>
            </View>
          </View>
        } />}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 28, fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 6, padding: 11, marginTop: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }, chip: { borderWidth: 1, borderRadius: 14, padding: 7 }, uploadRow: { flexDirection: 'row', gap: 10 }, button: { marginTop: 15, padding: 14, alignItems: 'center', borderRadius: 6 }, card: { borderWidth: 1, borderRadius: 7, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, thumb: { width: 58, height: 58, borderRadius: 4 }, actions: { gap: 10 }, edit: { flex: 1, borderWidth: 1, padding: 8, borderRadius: 4 } });