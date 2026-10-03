import { useAuth, useClerk, useUser } from '@clerk/expo';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

export function AccountControl() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const colors = useColors();
  const { t } = useLocale();
  if (!isSignedIn) return null;

  const firstName = user?.firstName ?? user?.fullName?.split(' ')[0];
  return <Pressable accessibilityRole="button" accessibilityLabel={firstName ? `${firstName}, ${t('signOut')}` : t('signOut')} onPress={() => signOut()} style={styles.control}>
    {firstName ? <Text numberOfLines={1} style={[styles.name, { color: colors.mutedForeground }]}>{firstName}</Text> : null}
    <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('signOut')}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 44 },
  name: { maxWidth: 70 },
});