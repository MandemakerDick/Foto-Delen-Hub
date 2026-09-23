import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export default function SignIn() {
  const c = useColors(); const { t } = useLocale(); const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>(); const returnTo = params.returnTo ?? '/';
  const { signIn } = useSignIn(); const { signUp } = useSignUp(); const { setActive } = useClerk();
  const ready = !!signIn && !!signUp && !!setActive;
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [create, setCreate] = useState(false); const [verify, setVerify] = useState(false); const [busy, setBusy] = useState(false);
  const errorText = (error: any, fallback: string) => error?.errors?.[0]?.message ?? error?.message ?? fallback;
  const submit = async () => {
    if (!ready || !email.trim() || !password) return; setBusy(true);
    try {
      if (create) { await signUp!.create({ emailAddress: email.trim(), password }); await signUp!.verifications.sendEmailCode(); setVerify(true); }
      else { const result: any = await signIn!.create({ identifier: email.trim(), password }); if (result.status === 'complete' && result.createdSessionId) { await setActive!({ session: result.createdSessionId }); router.replace(returnTo as any); } }
    } catch (error) { Alert.alert(t('signInFailed'), errorText(error, t('tryAgain'))); } finally { setBusy(false); }
  };
  const verifyEmail = async () => {
    if (!ready || !code.trim()) return; setBusy(true);
    try { await signUp!.verifications.verifyEmailCode({ code: code.trim() }); if (signUp!.status === 'complete' && signUp!.createdSessionId) { await setActive!({ session: signUp!.createdSessionId }); router.replace(returnTo as any); } else Alert.alert(t('verificationIncomplete'), t('tryAgain')); }
    catch (error) { Alert.alert(t('verificationFailed'), errorText(error, t('invalidCode'))); } finally { setBusy(false); }
  };
  if (!ready) return <View style={[styles.center, { backgroundColor: c.background }]}><Text style={{ color: c.mutedForeground }}>{t('authLoading')}</Text></View>;
  return <View style={[styles.root, { backgroundColor: c.background }]}><Stack.Screen options={{ title: create ? t('createAccount') : t('signIn') }}/><Text style={[styles.title, { color: c.foreground }]}>{verify ? t('checkEmail') : create ? t('joinDarkroom') : t('welcomeBack')}</Text>{verify ? <><Text style={{ color: c.mutedForeground }}>{t('emailSent')} {email}</Text><TextInput keyboardType="number-pad" value={code} onChangeText={setCode} placeholder={t('verificationCode')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} /><Pressable onPress={verifyEmail} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground }}>{t('verifyEmail')}</Text></Pressable></> : <><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} /><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder={t('password')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} /><Pressable onPress={submit} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground }}>{busy ? t('sending') : create ? t('createAccount') : t('signIn')}</Text></Pressable><Pressable onPress={() => setCreate(!create)}><Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 20 }}>{create ? t('existingMember') : t('newMember')}</Text></Pressable></>}</View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 22, justifyContent: 'center' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, title: { fontSize: 31, fontWeight: '700', marginBottom: 22 }, input: { borderWidth: 1, borderRadius: 7, padding: 14, marginBottom: 12 }, button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 7 } });