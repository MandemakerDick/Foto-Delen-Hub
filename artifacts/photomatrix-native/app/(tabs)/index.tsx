import { Link } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { AccountControl } from '@/components/AccountControl';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { useTabPressReset } from '@/context/tab-reset';

export default function HomeScreen() {
  const colors = useColors();
  const { t, locale, setLocale } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  useTabPressReset('index', () => scroll.current?.scrollTo({ y: 0, animated: false }));
  return (
    <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: 100 }]}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[styles.eyebrow, { color: colors.primary }]}>{t('darkroom')}</Text>
        {isSignedIn ? <AccountControl /> : <Link href="/sign-in" asChild>
          <Pressable accessibilityRole="button" style={styles.signInControl}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('signIn')}</Text>
          </Pressable>
        </Link>}
      </View>
      <Image
        source={require('../../../../attached_assets/image_1790351734053.png')}
        style={styles.fullLogo}
        resizeMode="contain"
        accessibilityLabel="PhotoMatrix — Capture. Connect. Create."
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.title, { color: colors.foreground }]}>{t('stories')}</Text>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{t('homeIntro')}</Text>
      <Link href="/gallery" asChild>
        <Pressable style={StyleSheet.flatten([styles.hero, { borderColor: colors.border }])}>
          <View><Text style={[styles.heroTitle, { color: colors.foreground }]}>{t('explore')}</Text><Text style={{ color: colors.mutedForeground, marginTop: 6 }}>{t('latest')}</Text></View>
          <Feather name="arrow-up-right" color={colors.primary} size={25} />
        </Pressable>
      </Link>
      <Text style={[styles.section, { color: colors.foreground }]}>{t('findPeople')}</Text>
      <View style={styles.grid}>
        {[
          ['users', t('clubs'), '/gallery/clubs?fromHome=1'],
          ['user', t('photographers'), '/gallery/photographers?fromHome=1'],
          ['aperture', t('themes'), '/gallery/themes?fromHome=1'],
           ...(isLoaded && isSignedIn ? [
             ['heart', t('likedPhotos'), '/(tabs)/liked-photos'],
             ['user-check', t('following'), '/gallery/following?fromHome=1'],
           ] : []),
        ].map(([icon, label, href]) => <Link key={label} href={href as never} asChild><Pressable style={StyleSheet.flatten([styles.tile, { backgroundColor: colors.card, borderColor: colors.border }])}><Feather name={icon as never} size={21} color={colors.primary} /><Text style={{ color: colors.foreground, marginTop: 12, fontWeight: '600' }}>{label}</Text></Pressable></Link>)}
      </View>
      <Text style={[styles.section, { color: colors.foreground }]}>{t('memberAccess')}</Text>
      {isSignedIn
        ? <Link href="/(tabs)/my-photos" asChild><Pressable style={StyleSheet.flatten([styles.outline, { borderColor: colors.border }])}><Text style={{ color: colors.foreground }}>{t('myPhotos')}</Text><Feather name="user" size={18} color={colors.mutedForeground} /></Pressable></Link>
        : <Link href="/sign-in" asChild><Pressable style={StyleSheet.flatten([styles.outline, { borderColor: colors.border }])}><Text style={{ color: colors.foreground }}>{t('signInShare')}</Text><Feather name="log-in" size={18} color={colors.mutedForeground} /></Pressable></Link>}
      {!isLoaded && <Text style={{ color: colors.mutedForeground, marginTop: 10 }}>{t('authLoading')}</Text>}
      <Link href="/feedback" asChild><Pressable style={StyleSheet.flatten([styles.outline, { borderColor: colors.border, marginTop: 12 }])}><Text style={{ color: colors.foreground }}>{t('feedback')}</Text><Feather name="message-square" size={18} color={colors.mutedForeground} /></Pressable></Link>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 26 }}>
        {(['en', 'nl'] as const).map(language => <Pressable key={language} accessibilityRole="button" accessibilityState={{ selected: locale === language }} onPress={() => setLocale(language)}><Text style={{ color: locale === language ? colors.primary : colors.mutedForeground, fontWeight: locale === language ? '700' : '400' }}>{language === 'en' ? 'English' : 'Nederlands'}</Text></Pressable>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  signInControl: { minHeight: 44, justifyContent: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', flexShrink: 1 },
  fullLogo: { width: 245, height: 199, alignSelf: 'center', marginTop: 16, marginBottom: 4 },
  title: {
    fontSize: 42, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 12,
  },
  text: { fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 340 },
  hero: { marginTop: 34, padding: 20, borderWidth: 1, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '600' },
  section: { fontSize: 21, fontWeight: '600', marginTop: 34, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', minHeight: 112, padding: 16, borderRadius: 8, borderWidth: 1 },
  outline: { padding: 17, borderWidth: 1, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' },
});
