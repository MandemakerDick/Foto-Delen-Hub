import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Link, Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useClerk } from '@clerk/expo';
import { useAccountGuard } from '@/context/account-epoch';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyProfileQueryKey, getGetPhotographerQueryKey, getListGalleryPhotosQueryKey,
  getListClubsQueryKey, getListPhotographersQueryKey, requestUploadUrl, useCreateMyProfile, useGetMyProfile, useListClubs, useListThemes, useUpdatePhotographer,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl, storageMediaPath } from '@/utils/media';

export default function Profile() {
  const c = useColors();
  const { t } = useLocale();
  const { isSignedIn } = useAuth();
  const isCurrentAccount = useAccountGuard();
  const { signOut } = useClerk();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const closeEditor = (id: number) => {
    if (router.canGoBack()) router.back();
    else router.replace(`/gallery/directory/photographers/${id}` as never);
  };
  const queryClient = useQueryClient();
  const current = useGetMyProfile({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMyProfileQueryKey(),
      retry: (failures, error) => error.status !== 404 && failures < 2,
    },
  });
  const themes = useListThemes();
  const clubs = useListClubs();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [themeIds, setThemeIds] = useState<number[]>([]);
  const [themesChanged, setThemesChanged] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [clubIds, setClubIds] = useState<number[]>([]);
  const [clubsChanged, setClubsChanged] = useState(false);
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (edit !== '1' || !current.data) return;
    setName(current.data.name);
    setBio(current.data.bio ?? '');
    setThemeIds(current.data.themes?.map(theme => theme.id) ?? []);
    setClubIds(current.data.clubs.map(club => club.id));
    setThemesChanged(false);
    setClubsChanged(false);
    setSelectedAvatar(null);
  }, [edit, current.data?.id]);
  const create = useCreateMyProfile({
    mutation: {
      onSuccess: () => { if (isCurrentAccount()) return current.refetch(); },
      onError: error => { if (isCurrentAccount()) Alert.alert(t('createFailed'), error?.message ?? t('tryAgain')); },
    },
  });
  const update = useUpdatePhotographer({
    mutation: {
      onSuccess: updated => {
        if (!isCurrentAccount()) return;
        queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
        queryClient.invalidateQueries({ queryKey: getGetPhotographerQueryKey(updated.id) });
        queryClient.invalidateQueries({ queryKey: ['directory-photographer', updated.id] });
        queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ['directory-club'] });
        queryClient.invalidateQueries({ queryKey: ['directory-club-members'] });
        queryClient.invalidateQueries({ queryKey: getListGalleryPhotosQueryKey() });
        setSelectedAvatar(null);
        setThemePickerOpen(false);
        setClubPickerOpen(false);
        closeEditor(updated.id);
      },
      onError: error => { if (isCurrentAccount()) Alert.alert(t('saveFailed'), error?.message ?? t('tryAgain')); },
    },
  });
  const selectAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert(t('permissionDenied'), t('permissionSettings')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
      if (!isCurrentAccount() || result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 25 * 1024 * 1024) { Alert.alert(t('fileTooLarge'), t('fileTooLargeBody')); return; }
      if (asset.mimeType && !asset.mimeType.startsWith('image/')) { Alert.alert(t('imagesOnly')); return; }
      setSelectedAvatar(asset);
    } catch (error: any) {
      if (isCurrentAccount()) Alert.alert(t('uploadFailed'), error?.message ?? t('tryAgain'));
    }
  };
  const save = async () => {
    const profile = current.data;
    if (!profile || !name.trim() || saving || update.isPending) return;
    setSaving(true);
    let avatarUrl: string | undefined;
    if (selectedAvatar) {
      const controller = new AbortController();
      const withDeadline = async <T,>(request: Promise<T>, duration: number) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([request, new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error(t('uploadTimedOut'))); }, duration);
          })]);
        } finally { if (timer) clearTimeout(timer); }
      };
      try {
        const type = selectedAvatar.mimeType ?? 'image/jpeg';
        const signed = await withDeadline(requestUploadUrl({
          name: selectedAvatar.fileName ?? `profile-${Date.now()}.jpg`,
          size: selectedAvatar.fileSize ?? 1, contentType: type,
        }, { signal: controller.signal }), 20_000);
        const response = await withDeadline(expoFetch(signed.uploadURL, {
          method: 'PUT', body: new File(selectedAvatar.uri),
          headers: { 'Content-Type': type }, signal: controller.signal,
        }), 120_000);
        if (!response.ok) throw new Error(t('storageFailed'));
        avatarUrl = storageMediaPath(signed.objectPath);
      } catch (error: any) {
        Alert.alert(t('uploadFailed'), error?.message ?? t('tryAgain'));
        setSaving(false);
        return;
      }
    }
    try {
      if (!isCurrentAccount()) return;
      await update.mutateAsync({ id: profile.id, data: {
        name: name.trim(), bio: bio.trim(),
        ...(themesChanged ? { themeIds } : {}),
        ...(clubsChanged ? { clubs: clubIds.map(id => ({ id })) } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      } });
    } catch {
      // The mutation displays the server error and keeps this form open for retry.
    } finally {
      setSaving(false);
    }
  };

  if (!isSignedIn) return <View style={[styles.center, { backgroundColor: c.background }]}>
    <Text style={[styles.title, { color: c.foreground }]}>{t('profile')}</Text>
    <Text style={{ color: c.mutedForeground, marginTop: 10 }}>{t('signedOutProfile')}</Text>
  </View>;
  if (current.isLoading) return <View style={[styles.center, { backgroundColor: c.background }]}>
    <Text style={{ color: c.mutedForeground }}>{t('loadingProfile')}</Text>
  </View>;
  // A 404 means this account has not claimed or created a photographer profile yet.
  if (current.isError && current.error.status !== 404) return <View style={[styles.center, { backgroundColor: c.background }]}>
    <Text style={{ color: c.mutedForeground }}>{t('profileUnavailable')}</Text>
    <Pressable accessibilityRole="button" onPress={() => current.refetch()}><Text style={{ color: c.primary, marginTop: 14 }}>{t('retry')}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => signOut()}><Text style={{ color: c.primary, marginTop: 25 }}>{t('signOut')}</Text></Pressable>
  </View>;

  const profile = current.data;
  if (profile && edit !== '1') return <Redirect href={`/gallery/directory/photographers/${profile.id}` as never} />;
  const image = selectedAvatar?.uri ?? (profile?.avatarUrl ? resolveMediaUrl(profile.avatarUrl) : null);
  const currentThemeNames = themeIds.map(id => themes.data?.find(theme => theme.id === id)?.name ?? profile?.themes?.find(theme => theme.id === id)?.name).filter(Boolean);
  const currentClubNames = clubIds.map(id => clubs.data?.find(club => club.id === id)?.name ?? profile?.clubs.find(club => club.id === id)?.name).filter(Boolean);
  return <KeyboardAwareScrollViewCompat
    style={{ backgroundColor: c.background }}
    contentContainerStyle={styles.root}
    bottomOffset={20}
    keyboardShouldPersistTaps="handled"
  >
    <Stack.Screen options={{ title: t('profile') }} />
    {profile ? <>
      <Text style={[styles.title, { color: c.foreground }]}>{t('editProfile')}</Text>
      {image ? <Image source={image} style={styles.avatar} contentFit="cover" /> :
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: c.card }]}>
          <Text style={{ color: c.foreground, fontSize: 28 }}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>}
      <Pressable accessibilityRole="button" disabled={saving} onPress={selectAvatar}
        style={[styles.choice, { borderColor: c.border }]}>
        <Text style={{ color: c.primary }}>{t(profile.avatarUrl || selectedAvatar ? 'changeProfilePhoto' : 'addProfilePhoto')}</Text>
      </Pressable>
      <Text style={[styles.label, { color: c.foreground }]}>{t('name')}</Text>
      <TextInput value={name} onChangeText={setName} accessibilityLabel={t('name')}
        style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
      <Text style={[styles.label, { color: c.foreground }]}>{t('profileBio')}</Text>
      <TextInput value={bio} onChangeText={setBio} multiline accessibilityLabel={t('profileBio')}
        placeholder={t('profileBio')} placeholderTextColor={c.mutedForeground}
        style={[styles.input, styles.bio, { color: c.foreground, borderColor: c.border }]} />
      <Text style={[styles.label, { color: c.foreground }]}>{t('themes')}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: themePickerOpen }}
        onPress={() => setThemePickerOpen(open => !open)}
        style={[styles.choice, { borderColor: c.border }]}>
        <Text style={{ color: c.foreground }}>{currentThemeNames.join(', ') || t('noThemesAvailable')}</Text>
        <Text style={{ color: c.primary }}>{themePickerOpen ? '−' : '+'}</Text>
      </Pressable>
      {themePickerOpen && <View style={[styles.options, { borderColor: c.border }]}>
        {themes.isLoading ? <ActivityIndicator color={c.primary} /> :
          themes.isError ? <Pressable accessibilityRole="button" onPress={() => { void themes.refetch(); }}>
            <Text style={{ color: c.primary }}>{t('retry')}</Text>
          </Pressable> :
          (themes.data ?? []).map(theme => <Pressable key={theme.id} accessibilityRole="checkbox"
            accessibilityState={{ checked: themeIds.includes(theme.id) }}
            onPress={() => { setThemeIds(ids => ids.includes(theme.id) ? ids.filter(id => id !== theme.id) : [...ids, theme.id]); setThemesChanged(true); }}
            style={styles.option}><Text style={{ color: c.foreground }}>{themeIds.includes(theme.id) ? '✓ ' : '○ '}{theme.name}</Text></Pressable>)}
      </View>}
      <Link href={{ pathname: '/feedback', params: { themeProposal: '1' } }} asChild>
        <Pressable accessibilityRole="link" testID="propose-theme-from-profile-edit" style={styles.proposalLink}>
          <Text style={{ color: c.primary }}>{t('proposeTheme')}</Text>
        </Pressable>
      </Link>
      <Text style={[styles.label, { color: c.foreground }]}>{t('clubs')}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: clubPickerOpen }}
        onPress={() => setClubPickerOpen(open => !open)}
        style={[styles.choice, { borderColor: c.border }]}>
        <Text style={{ color: c.foreground, flex: 1 }}>{currentClubNames.join(', ') || t('noClub')}</Text>
        <Text style={{ color: c.primary }}>{clubPickerOpen ? '−' : '+'}</Text>
      </Pressable>
      {clubPickerOpen && <View style={[styles.options, { borderColor: c.border }]}>
        {clubs.isLoading ? <ActivityIndicator color={c.primary} /> :
          clubs.isError ? <Pressable accessibilityRole="button" onPress={() => { void clubs.refetch(); }}>
            <Text style={{ color: c.primary }}>{t('retry')}</Text>
          </Pressable> :
          clubs.data?.length ? clubs.data.map(club => <Pressable key={club.id} accessibilityRole="checkbox"
            accessibilityState={{ checked: clubIds.includes(club.id) }}
            onPress={() => { setClubIds(ids => ids.includes(club.id) ? ids.filter(id => id !== club.id) : [...ids, club.id]); setClubsChanged(true); }}
            style={styles.option}><Text style={{ color: c.foreground }}>{clubIds.includes(club.id) ? '✓ ' : '○ '}{club.name}</Text></Pressable>)
            : <Text style={{ color: c.mutedForeground, paddingVertical: 12 }}>{t('noClubsAvailable')}</Text>}
      </View>}
      <Text style={{ color: c.mutedForeground, marginTop: 12 }}>{t('missingClub')}</Text>
      <Link href={{ pathname: '/feedback', params: { clubProposal: '1' } }} asChild>
        <Pressable accessibilityRole="link" testID="propose-club-from-profile-edit" style={styles.proposalLink}>
          <Text style={{ color: c.primary }}>{t('proposeClub')}</Text>
        </Pressable>
      </Link>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={!name.trim() || saving || update.isPending}
          onPress={() => { void save(); }}
          style={[styles.button, { backgroundColor: c.primary, opacity: !name.trim() || saving || update.isPending ? 0.5 : 1 }]}>
          <Text style={{ color: c.primaryForeground }}>{saving ? t('sending') : t('save')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving || update.isPending}
          onPress={() => closeEditor(profile.id)} style={[styles.button, { borderColor: c.border, borderWidth: 1 }]}>
          <Text style={{ color: c.foreground }}>{t('cancel')}</Text>
        </Pressable>
      </View>
      <Link href="/feedback" asChild>
        <Pressable accessibilityRole="link" testID="send-feedback-from-profile-edit" style={styles.feedbackLink}>
          <Text style={{ color: c.primary }}>{t('sendClubFeedback')}</Text>
        </Pressable>
      </Link>
    </> : <>
      <Text style={[styles.title, { color: c.foreground }]}>{t('createProfile')}</Text>
      <Text style={{ color: c.mutedForeground, marginTop: 10 }}>{t('inviteBeforeProfile')}</Text>
      <Link href="/invite" asChild><Pressable accessibilityRole="button">
        <Text style={{ color: c.primary, marginTop: 12 }}>{t('redeem')}</Text>
      </Pressable></Link>
      <TextInput value={name} onChangeText={setName} placeholder={t('name')}
        placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
      <Pressable accessibilityRole="button" disabled={!name.trim() || create.isPending}
        onPress={() => create.mutate({ data: { name: name.trim() } })}
        style={[styles.button, { backgroundColor: c.primary }]}>
        <Text style={{ color: c.primaryForeground }}>{t('createProfile')}</Text>
      </Pressable>
    </>}
    {!profile && <Pressable accessibilityRole="button" onPress={() => signOut()} style={styles.signOut}>
      <Text style={{ color: c.primary }}>{t('signOut')}</Text>
    </Pressable>}
  </KeyboardAwareScrollViewCompat>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, padding: 22, paddingBottom: 80, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22 },
  title: { fontSize: 30, fontWeight: '700' },
  label: { fontWeight: '600', marginTop: 20 },
  input: { borderWidth: 1, padding: 14, borderRadius: 7, marginTop: 8 },
  bio: { minHeight: 100, textAlignVertical: 'top' },
  avatar: { width: 96, height: 96, borderRadius: 48, marginTop: 20 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 7, padding: 14, marginTop: 10 },
  options: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, marginTop: 6 },
  option: { paddingVertical: 12 },
  proposalLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  feedbackLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 18 },
  button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 15 },
  actions: { flexDirection: 'row', gap: 12 },
  signOut: { marginTop: 25, alignSelf: 'flex-start' },
});