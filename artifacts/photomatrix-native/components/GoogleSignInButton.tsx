import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSSO } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

const PENDING_GOOGLE_SIGN_IN = 'photomatrix:google-sign-in-pending';

export function GoogleSignInButton({ onSuccess }: { onSuccess?: () => void }) {
  const colors = useColors();
  const { t } = useLocale();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [checkingRecovery, setCheckingRecovery] = useState(Platform.OS !== 'web');
  const [needsRecovery, setNeedsRecovery] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    AsyncStorage.getItem(PENDING_GOOGLE_SIGN_IN)
      .then(value => { if (mounted) setNeedsRecovery(value !== null); })
      .catch(() => { if (mounted) setError(t('googleRecoveryUnavailable')); })
      .finally(() => { if (mounted) setCheckingRecovery(false); });
    return () => { mounted = false; };
  }, [t]);

  const confirmClosed = async () => {
    try {
      await AsyncStorage.removeItem(PENDING_GOOGLE_SIGN_IN);
      setNeedsRecovery(false);
      setError('');
    } catch {
      setError(t('googleRecoveryUnavailable'));
    }
  };

  const signIn = async () => {
    if (busyRef.current || checkingRecovery || needsRecovery) return;
    busyRef.current = true;
    setError('');
    setBusy(true);
    const attemptId = `${Date.now()}:${Math.random()}`;
    let completed = false;
    try {
      if (Platform.OS !== 'web') await AsyncStorage.setItem(PENDING_GOOGLE_SIGN_IN, attemptId);
      const result = await startSSOFlow({ strategy: 'oauth_google' });
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        completed = true;
      } else if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') {
        setError(t('googleCancelled'));
      } else {
        setError(t('googleIncomplete'));
      }
    } catch (failure: any) {
      setError(failure?.errors?.[0]?.message ?? failure?.message ?? t('googleIncomplete'));
    } finally {
      if (Platform.OS !== 'web') {
        try {
          if (await AsyncStorage.getItem(PENDING_GOOGLE_SIGN_IN) === attemptId) {
            await AsyncStorage.removeItem(PENDING_GOOGLE_SIGN_IN);
          }
        }
        catch { setError(t('googleRecoveryUnavailable')); }
      }
      busyRef.current = false;
      setBusy(false);
    }
    if (completed) onSuccess?.();
  };

  return <>
    {needsRecovery ? <>
      <Text accessibilityRole="alert" style={[styles.error, { color: colors.primary }]}>{t('googleInterrupted')}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void confirmClosed(); }} style={[styles.button, { borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground }}>{t('googleWindowClosed')}</Text>
      </Pressable>
    </> : <Pressable accessibilityRole="button" onPress={signIn} disabled={busy || checkingRecovery} style={[styles.button, { borderColor: colors.border, opacity: busy || checkingRecovery ? 0.6 : 1 }]}>
      <Text style={{ color: colors.foreground }}>{busy ? t('sending') : checkingRecovery ? t('authLoading') : t('continueGoogle')}</Text>
    </Pressable>}
    {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: colors.primary }]}>{error}</Text>}
  </>;
}

const styles = StyleSheet.create({
  button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 10, borderWidth: 1 },
  error: { marginTop: 10, textAlign: 'center' },
});