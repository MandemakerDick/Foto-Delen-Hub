import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { reloadAppAsync } from 'expo';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { passwordSignIn, sendSignInCode, verifySignInCode, submitNewPassword } from '@/utils/emailAuth';

type CodeFactor = 'totp' | 'backup_code' | 'email_code' | 'phone_code';
const isCodeFactor = (strategy: string): strategy is CodeFactor =>
  strategy === 'totp' || strategy === 'backup_code' || strategy === 'email_code' || strategy === 'phone_code';

export default function SignIn() {
  const c = useColors();
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo ?? '/';
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { setActive } = useClerk();
  const ready = !!signIn && !!signUp && !!setActive;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorCode, setFactorCode] = useState('');
  const [create, setCreate] = useState(false);
  const [verify, setVerify] = useState(false);
  const [emailFlow, setEmailFlow] = useState<'sign-in' | 'reset' | null>(null);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<CodeFactor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const factors = (signIn?.supportedSecondFactors ?? []).filter(factor => isCodeFactor(factor.strategy));
  const factorLabel = (strategy: CodeFactor) =>
    t(strategy === 'totp' ? 'authenticatorCode' : strategy === 'backup_code' ? 'backupCode' : strategy === 'email_code' ? 'emailCode' : 'phoneCode');
  const errorText = (failure: any, fallback: string) => failure?.errors?.[0]?.message ?? failure?.message ?? fallback;

  const finishSignIn = async () => {
    if (signIn!.status === 'complete' && signIn!.createdSessionId) {
      const result = await signIn!.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) throw new Error(t('signInIncomplete'));
          router.replace(returnTo as any);
        },
      });
      if (result.error) throw result.error;
      setPassword('');
      setFactorCode('');
    } else if (signIn!.status === 'needs_second_factor' || signIn!.status === 'needs_client_trust') {
      const options = signIn!.supportedSecondFactors.filter(factor => isCodeFactor(factor.strategy));
      setNeedsSecondFactor(true);
      setSelectedFactor(options.some(factor => factor.strategy === 'totp') ? 'totp' : null);
      if (!options.length) setError(t('secondFactorUnavailable'));
    } else {
      setError(`${t('signInIncomplete')} (${signIn!.status})`);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!ready) { setError(t('authLoading')); return; }
    if (!email.trim() || !password) { setError(t('enterEmailPassword')); return; }
    setError('');
    setBusy(true);
    try {
      if (create) {
        const result = await signUp!.password({ emailAddress: email.trim(), password });
        if (result.error) throw result.error;
        const sent = await signUp!.verifications.sendEmailCode();
        if (sent.error) throw sent.error;
        setVerify(true);
      } else {
        await passwordSignIn(signIn!, email, password);
        await finishSignIn();
      }
    } catch (failure) {
      setError(errorText(failure, t('signInFailed')));
    } finally {
      setBusy(false);
    }
  };

  const startEmailFlow = async (flow: 'sign-in' | 'reset') => {
    if (!ready || busy) return;
    if (!email.trim()) { setError(t('enterEmail')); return; }
    setBusy(true);
    setError('');
    try {
      await sendSignInCode(signIn!, email, flow === 'reset');
      setEmailFlow(flow);
      setCode('');
      setPassword('');
      setNewPassword('');
      setNeedsNewPassword(false);
    } catch (failure) {
      setError(errorText(failure, t('signInFailed')));
    } finally {
      setBusy(false);
    }
  };

  const completeEmailFlow = async () => {
    if (!ready || busy) return;
    if (needsNewPassword ? !newPassword : !code.trim()) {
      setError(t(needsNewPassword ? 'enterNewPassword' : 'invalidCode'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (needsNewPassword) {
        await submitNewPassword(signIn!, newPassword);
        setNewPassword('');
        setEmailFlow(null);
        setNeedsNewPassword(false);
        await finishSignIn();
      } else {
        await verifySignInCode(signIn!, code, emailFlow === 'reset');
        if (emailFlow === 'reset') {
          if (signIn!.status !== 'needs_new_password') throw new Error(t('verificationIncomplete'));
          setNeedsNewPassword(true);
          setCode('');
        } else {
          setEmailFlow(null);
          setCode('');
          await finishSignIn();
        }
      }
    } catch (failure) {
      setError(errorText(failure, t('signInFailed')));
    } finally {
      setBusy(false);
    }
  };

  const startOver = async () => {
    if (busy) return;
    try { await signIn?.reset(); }
    catch (failure) { setError(errorText(failure, t('signInFailed'))); return; }
    setEmailFlow(null);
    setNeedsNewPassword(false);
    setNewPassword('');
    setCode('');
    setPassword('');
    setNeedsSecondFactor(false);
    setSelectedFactor(null);
    setFactorCode('');
    setError('');
  };

  const chooseFactor = async (strategy: CodeFactor) => {
    if (!ready || busy) return;
    setError('');
    setBusy(true);
    try {
      if (!signIn!.supportedSecondFactors.some(factor => factor.strategy === strategy)) throw new Error(t('secondFactorUnavailable'));
      if (strategy === 'email_code') {
        const result = await signIn!.mfa.sendEmailCode();
        if (result.error) throw result.error;
      } else if (strategy === 'phone_code') {
        const result = await signIn!.mfa.sendPhoneCode();
        if (result.error) throw result.error;
      }
      setFactorCode('');
      setSelectedFactor(strategy);
    } catch (failure) {
      setError(errorText(failure, t('secondFactorUnavailable')));
    } finally {
      setBusy(false);
    }
  };

  const verifySecondFactor = async () => {
    if (!ready || !selectedFactor || !factorCode.trim()) { setError(t('invalidCode')); return; }
    setError('');
    setBusy(true);
    try {
      const params = { code: factorCode.trim() };
      const result = selectedFactor === 'totp' ? await signIn!.mfa.verifyTOTP(params)
        : selectedFactor === 'backup_code' ? await signIn!.mfa.verifyBackupCode(params)
          : selectedFactor === 'email_code' ? await signIn!.mfa.verifyEmailCode(params)
            : await signIn!.mfa.verifyPhoneCode(params);
      if (result.error) throw result.error;
       if (signIn!.status === 'needs_second_factor' || signIn!.status === 'needs_client_trust') setError(t('invalidCode'));
      else await finishSignIn();
    } catch (failure) {
      setError(errorText(failure, t('invalidCode')));
    } finally {
      setBusy(false);
    }
  };

  const verifyEmail = async () => {
    if (!ready || !code.trim()) { setError(t('invalidCode')); return; }
    setError('');
    setBusy(true);
    try {
      const result = await signUp!.verifications.verifyEmailCode({ code: code.trim() });
      if (result.error) throw result.error;
      if (signUp!.status === 'complete' && signUp!.createdSessionId) {
        const finalized = await signUp!.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) throw new Error(t('verificationIncomplete'));
            router.replace(returnTo as any);
          },
        });
        if (finalized.error) throw finalized.error;
      } else setError(t('verificationIncomplete'));
    } catch (failure) {
      setError(errorText(failure, t('invalidCode')));
    } finally {
      setBusy(false);
    }
  };

  return <KeyboardAwareScrollViewCompat style={{ backgroundColor: c.background }} contentContainerStyle={styles.root} bottomOffset={20}>
    <Stack.Screen options={{ title: create ? t('createAccount') : t('signIn') }} />
    <Text style={[styles.title, { color: c.foreground }]}>{needsSecondFactor ? t('secondFactorTitle') : needsNewPassword ? t('setNewPassword') : emailFlow || verify ? t('checkEmail') : create ? t('joinDarkroom') : t('welcomeBack')}</Text>
    {!ready ? <View>
      <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>{t('authLoading')}</Text>
      <Pressable accessibilityRole="button" onPress={async () => {
        try { await reloadAppAsync(); } catch { setError(t('tryAgain')); }
      }} style={[styles.button, { backgroundColor: c.primary }]}>
        <Text style={{ color: c.primaryForeground }}>{t('refresh')}</Text>
      </Pressable>
    </View> : needsSecondFactor ? <>
      <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>{t('chooseSecondFactor')}</Text>
      {factors.filter((factor, index) => factors.findIndex(item => item.strategy === factor.strategy) === index).map(factor => <Pressable
        key={factor.strategy}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedFactor === factor.strategy }}
        disabled={busy}
        onPress={() => chooseFactor(factor.strategy as CodeFactor)}
        style={[styles.factor, { borderColor: selectedFactor === factor.strategy ? c.primary : c.border }]}
      ><Text style={{ color: c.foreground }}>{factorLabel(factor.strategy as CodeFactor)}</Text></Pressable>)}
      {selectedFactor && <View>
        {(selectedFactor === 'email_code' || selectedFactor === 'phone_code') && <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>{t('secondFactorSent')}</Text>}
        <TextInput
          value={factorCode}
          onChangeText={setFactorCode}
          placeholder={factorLabel(selectedFactor)}
          placeholderTextColor={c.mutedForeground}
          keyboardType={selectedFactor === 'backup_code' ? 'default' : 'number-pad'}
          autoCapitalize="none"
          autoComplete="one-time-code"
          style={[styles.input, { color: c.foreground, borderColor: c.border }]}
        />
        <Pressable accessibilityRole="button" onPress={verifySecondFactor} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground }}>{t('verifyCode')}</Text></Pressable>
      </View>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={startOver} style={styles.switch}><Text style={{ color: c.mutedForeground }}>{t('anotherAccount')}</Text></Pressable>
    </> : emailFlow ? <>
      <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>{t(needsNewPassword ? 'newPasswordIntro' : 'secondFactorSent')}</Text>
      {needsNewPassword ? <TextInput
        secureTextEntry autoComplete="new-password" value={newPassword} onChangeText={setNewPassword}
        placeholder={t('newPassword')} placeholderTextColor={c.mutedForeground}
        style={[styles.input, { color: c.foreground, borderColor: c.border }]}
      /> : <TextInput
        keyboardType="number-pad" autoComplete="one-time-code" value={code} onChangeText={setCode}
        placeholder={t('verificationCode')} placeholderTextColor={c.mutedForeground}
        style={[styles.input, { color: c.foreground, borderColor: c.border }]}
      />}
      <Pressable accessibilityRole="button" onPress={completeEmailFlow} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}>
        <Text style={{ color: c.primaryForeground }}>{busy ? t('sending') : t(needsNewPassword ? 'saveNewPassword' : 'verifyCode')}</Text>
      </Pressable>
      {!needsNewPassword && <Pressable accessibilityRole="button" disabled={busy} onPress={() => startEmailFlow(emailFlow)} style={styles.switch}><Text style={{ color: c.primary }}>{t('resendCode')}</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={startOver} style={styles.switch}><Text style={{ color: c.mutedForeground }}>{t('anotherAccount')}</Text></Pressable>
    </> : verify ? <>
      <Text style={{ color: c.mutedForeground }}>{t('emailSent')} {email}</Text>
      <TextInput keyboardType="number-pad" autoComplete="one-time-code" value={code} onChangeText={setCode} placeholder={t('verificationCode')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
      <Pressable accessibilityRole="button" onPress={verifyEmail} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground }}>{t('verifyEmail')}</Text></Pressable>
    </> : <>
      <TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
      <TextInput secureTextEntry autoComplete={create ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} placeholder={t('password')} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
      <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={[styles.button, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground }}>{busy ? t('sending') : create ? t('createAccount') : t('signIn')}</Text></Pressable>
      {!create && <>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => startEmailFlow('sign-in')} style={styles.switch}><Text style={{ color: c.primary }}>{t('signInEmailCode')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => startEmailFlow('reset')} style={styles.switch}><Text style={{ color: c.mutedForeground }}>{t('forgotPassword')}</Text></Pressable>
      </>}
      <GoogleSignInButton disabled={busy} onBusyChange={setBusy} onSuccess={() => router.replace(returnTo as any)} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setCreate(!create); setPassword(''); setError(''); }} style={styles.switch}><Text style={{ color: c.mutedForeground }}>{create ? t('existingMember') : t('newMember')}</Text></Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.primary, marginTop: 18, textAlign: 'center' }}>{error}</Text>}
    <View style={styles.exit}><Pressable onPress={() => router.replace('/')}><Text style={{ color: c.primary }}>{t('home')}</Text></Pressable><Pressable onPress={() => router.replace('/gallery')}><Text style={{ color: c.primary }}>{t('gallery')}</Text></Pressable></View>
  </KeyboardAwareScrollViewCompat>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, padding: 22, justifyContent: 'center' },
  title: { fontSize: 31, fontWeight: '700', marginBottom: 22 },
  input: { borderWidth: 1, borderRadius: 7, padding: 14, marginBottom: 12 },
  button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 7 },
  factor: { borderWidth: 1, borderRadius: 7, padding: 14, marginBottom: 10, minHeight: 48 },
  switch: { marginTop: 20, alignItems: 'center' },
  exit: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 32, paddingBottom: 12 },
});