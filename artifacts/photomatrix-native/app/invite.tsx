import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useRedeemInvite } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export default function Invite() {
  const c = useColors(); const { t } = useLocale(); const router = useRouter(); const { isSignedIn } = useAuth(); const qc = useQueryClient();
  const params = useLocalSearchParams<{ token?: string }>(); const [token, setToken] = useState(params.token ?? '');
  const redeem = useRedeemInvite({ mutation: { onSuccess: result => { qc.invalidateQueries({ queryKey: ['/api/me'] }); if (result.photographerId) router.replace('/profile'); else router.replace('/profile'); }, onError: (e: any) => Alert.alert(t('inviteUnavailable'), e?.message ?? t('tryAgain')) } });
  const submit = () => { if (!isSignedIn) { router.push({ pathname: '/sign-in', params: { returnTo: `/invite?token=${encodeURIComponent(token.trim())}` } }); return; } if (token.trim()) redeem.mutate({ data: { token: token.trim() } }); };
  return <View style={[styles.root, { backgroundColor: c.background }]}><Stack.Screen options={{ title: t('invite') }}/><Text style={[styles.title, { color: c.foreground }]}>{t('inviteTitle')}</Text><Text style={{ color: c.mutedForeground, marginTop: 8 }}>{t('inviteIntro')}</Text><TextInput autoCapitalize="none" value={token} onChangeText={setToken} placeholder={t('inviteToken')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} /><Pressable disabled={!token.trim() || redeem.isPending} onPress={submit} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{!isSignedIn ? t('signIn') : redeem.isPending ? t('sending') : t('redeem')}</Text></Pressable></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 22, justifyContent: 'center' }, title: { fontSize: 31, fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 7, padding: 14, marginTop: 22 }, button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 15 } });