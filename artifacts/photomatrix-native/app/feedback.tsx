import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useAccountGuard } from '@/context/account-epoch';
import { useSubmitFeedback } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export default function Feedback() {
  const isCurrentAccount = useAccountGuard();
  const c = useColors();
  const { t } = useLocale();
  const { isSignedIn } = useAuth();
  const { clubProposal, themeProposal } = useLocalSearchParams<{ clubProposal?: string; themeProposal?: string }>();
  const proposalType = clubProposal === '1' ? 'club' : themeProposal === '1' ? 'theme' : null;
  const isProposal = proposalType !== null;
  const titleKey = proposalType === 'club' ? 'proposeClub' : proposalType === 'theme' ? 'proposeTheme' : 'feedback';
  const introKey = proposalType === 'club' ? 'clubProposalIntro' : proposalType === 'theme' ? 'themeProposalIntro' : 'feedbackIntro';
  const detailsKey = proposalType === 'club' ? 'clubProposalDetails' : proposalType === 'theme' ? 'themeProposalDetails' : 'writeFeedback';
  const consentKey = proposalType === 'club' ? 'clubProposalConsent' : proposalType === 'theme' ? 'themeProposalConsent' : 'consent';
  const returnTo = proposalType === 'club' ? '/feedback?clubProposal=1' : proposalType === 'theme' ? '/feedback?themeProposal=1' : '/feedback';
  const [message, setMessage] = useState('');
  const [proposalName, setProposalName] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const submit = useSubmitFeedback({
    mutation: {
      onSuccess: () => {
        if (!isCurrentAccount()) return;
        setMessage('');
        setProposalName('');
        setCity('');
        setConsent(false);
        setDiagnostics(false);
        Alert.alert(t('thankYou'), t(proposalType === 'club' ? 'clubProposalSent' : proposalType === 'theme' ? 'themeProposalSent' : 'feedbackSent'));
      },
      onError: error => { if (isCurrentAccount()) Alert.alert(t('cannotSend'), error?.message ?? t('feedbackUnavailable')); },
    },
  });
  const disabled = !(isProposal ? proposalName.trim() : message.trim()) || !consent || submit.isPending;
  const send = () => {
    const body = proposalType === 'club'
      ? `[Club proposal]\nName: ${proposalName.trim()}\nCity: ${city.trim() || 'Not provided'}\nDetails: ${message.trim() || 'Not provided'}`
      : proposalType === 'theme'
        ? `[Theme proposal]\nName: ${proposalName.trim()}\nDescription: ${message.trim() || 'Not provided'}`
        : message.trim();
    submit.mutate({ data: {
      message: body, consent: true,
      ...(!isProposal && diagnostics ? { diagnostics: { platform: Platform.OS, version: String(Platform.Version) } } : {}),
    } });
  };

  if (!isSignedIn) return <View style={[styles.root, { backgroundColor: c.background }]}>
    <Stack.Screen options={{ title: t(titleKey) }} />
    <Text style={[styles.title, { color: c.foreground }]}>{t(titleKey)}</Text>
    <Text style={{ color: c.mutedForeground, marginTop: 12 }}>{t(proposalType === 'theme' ? 'signInThemeProposal' : isProposal ? 'signInProposal' : 'signInFeedback')}</Text>
    <Link href={{ pathname: '/sign-in', params: { returnTo } }}
      style={{ color: c.primary, marginTop: 22 }}>{t('signIn')}</Link>
  </View>;

  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: t(titleKey) }} />
    <Text style={[styles.title, { color: c.foreground }]}>{t(isProposal ? titleKey : 'tellUs')}</Text>
    <Text style={{ color: c.mutedForeground, marginTop: 8 }}>{t(introKey)}</Text>
    <Text style={{ color: c.mutedForeground, marginTop: 8 }}>{t('feedbackIdentityNotice')}</Text>
    {isProposal && <>
      <Text style={[styles.label, { color: c.foreground }]}>{t(proposalType === 'club' ? 'clubName' : 'themeName')}</Text>
      <TextInput value={proposalName} onChangeText={setProposalName} maxLength={150} accessibilityLabel={t(proposalType === 'club' ? 'clubName' : 'themeName')}
        placeholder={t(proposalType === 'club' ? 'clubName' : 'themeName')} placeholderTextColor={c.mutedForeground}
        style={[styles.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]} />
      {proposalType === 'club' && <>
        <Text style={[styles.label, { color: c.foreground }]}>{t('clubCityOptional')}</Text>
        <TextInput value={city} onChangeText={setCity} maxLength={100} accessibilityLabel={t('clubCityOptional')}
          placeholder={t('clubCityOptional')} placeholderTextColor={c.mutedForeground}
          style={[styles.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]} />
      </>}
    </>}
    <TextInput multiline value={message} onChangeText={setMessage} maxLength={isProposal ? 3000 : 4000}
      accessibilityLabel={t(detailsKey)}
      placeholder={t(detailsKey)} placeholderTextColor={c.mutedForeground}
      style={[styles.input, styles.message, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]} />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(value => !value)}>
      <Text style={{ color: c.mutedForeground }}>{consent ? '☑' : '□'} {t(consentKey)}</Text>
    </Pressable>
    {!isProposal && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: diagnostics }}
      onPress={() => setDiagnostics(value => !value)} style={styles.check}>
      <Text style={{ color: c.mutedForeground }}>{diagnostics ? '☑' : '□'} {t('diagnosticsConsent')}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" disabled={disabled} onPress={send}
      style={[styles.button, { backgroundColor: c.primary, opacity: disabled ? 0.45 : 1 }]}>
      <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{submit.isPending ? t('sending') : t(isProposal ? 'submitClubProposal' : 'send')}</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, padding: 22, paddingBottom: 90 },
  title: { fontSize: 30, fontWeight: '700', marginTop: 20 },
  label: { fontWeight: '600', marginTop: 20 },
  input: { borderWidth: 1, borderRadius: 7, padding: 14, marginTop: 8, textAlignVertical: 'top' },
  message: { minHeight: 140, marginVertical: 24 },
  check: { marginTop: 14 },
  button: { padding: 15, borderRadius: 7, alignItems: 'center', marginTop: 24 },
});