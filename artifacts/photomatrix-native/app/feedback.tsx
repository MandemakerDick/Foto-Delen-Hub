import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSubmitFeedback } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export default function Feedback() {
  const c = useColors(); const { t } = useLocale(); const { isSignedIn } = useAuth(); const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false); const [diagnostics, setDiagnostics] = useState(false);
  const submit = useSubmitFeedback({ mutation: { onSuccess: () => { setMessage(''); setConsent(false); setDiagnostics(false); Alert.alert(t('thankYou'), t('feedbackSent')); }, onError: (e: any) => Alert.alert(t('cannotSend'), e?.message ?? t('feedbackUnavailable')) } });
  const disabled = !message.trim() || !consent || submit.isPending;
  if (!isSignedIn) return <View style={[styles.root, { backgroundColor: c.background }]}><Stack.Screen options={{ title: t('feedback') }} /><Text style={[styles.title, { color: c.foreground }]}>{t('feedback')}</Text><Text style={{ color: c.mutedForeground, marginTop: 12 }}>{t('signInFeedback')}</Text><Link href={{ pathname: '/sign-in', params: { returnTo: '/feedback' } }} style={{ color: c.primary, marginTop: 22 }}>{t('signIn')}</Link></View>;
  return <View style={[styles.root, { backgroundColor: c.background }]}><Stack.Screen options={{ title: t('feedback') ?? 'Feedback' }} /><Text style={[styles.title, { color: c.foreground }]}>{t('tellUs')}</Text><Text style={{ color: c.mutedForeground, marginTop: 8 }}>{t('feedbackIntro')}</Text><TextInput multiline value={message} onChangeText={setMessage} placeholder={t('writeFeedback')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]} /><Pressable onPress={() => setConsent(x => !x)}><Text style={{ color: c.mutedForeground }}>{consent ? '☑' : '□'} {t('consent')}</Text></Pressable><Pressable onPress={() => setDiagnostics(x => !x)} style={styles.check}><Text style={{ color: c.mutedForeground }}>{diagnostics ? '☑' : '□'} {t('diagnosticsConsent')}</Text></Pressable><Pressable disabled={disabled} onPress={() => submit.mutate({ data: { message: message.trim(), consent: true, ...(diagnostics ? { diagnostics: { platform: Platform.OS, version: String(Platform.Version) } } : {}) } })} style={[styles.button, { backgroundColor: c.primary, opacity: disabled ? .45 : 1 }]}><Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{submit.isPending ? t('sending') : t('send')}</Text></Pressable></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 22 }, title: { fontSize: 30, fontWeight: '700', marginTop: 20 }, input: { minHeight: 150, borderWidth: 1, borderRadius: 7, padding: 14, marginVertical: 24, textAlignVertical: 'top' }, check: { marginTop: 14 }, button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 24 } });