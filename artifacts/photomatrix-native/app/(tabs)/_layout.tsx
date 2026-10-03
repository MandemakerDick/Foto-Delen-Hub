import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useLocale } from '@/context/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { TabBarVisibilityContext } from '@/context/tab-bar';
import { TabResetContext, type TabName, type TabResets } from '@/context/tab-reset';

const tabRoots = {
  index: { path: '/', href: '/(tabs)' },
  gallery: { path: '/gallery', href: '/(tabs)/gallery' },
  'my-photos': { path: '/my-photos', href: '/(tabs)/my-photos' },
  'liked-photos': { path: '/liked-photos', href: '/(tabs)/liked-photos' },
} as const;

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// Preserve the system's liquid-glass surface, but tint the selected tab with
// the same primary color used by the classic tab bar and the rest of the app.
function NativeTabLayout({ hideTabs, onTabPress }: { hideTabs: boolean; onTabPress: (name: TabName) => void }) {
  const colors = useColors();
  const { t } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const showPersonalTabs = isLoaded && isSignedIn;
  return (
    <NativeTabs hidden={hideTabs} tintColor={colors.primary} screenListeners={({ route }) => ({
      tabPress: () => {
        onTabPress(route.name as TabName);
      },
    })}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
        <NativeTabs.Trigger name="gallery"><NativeTabs.Trigger.Icon sf={{ default: 'photo', selected: 'photo.fill' }} /><NativeTabs.Trigger.Label>{t('gallery')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="my-photos" hidden={!showPersonalTabs}><NativeTabs.Trigger.Icon sf={{ default: 'person.crop.square', selected: 'person.crop.square.fill' }} /><NativeTabs.Trigger.Label>{t('me')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
         <NativeTabs.Trigger name="liked-photos" hidden={!showPersonalTabs}><NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} /><NativeTabs.Trigger.Label>{t('likedPhotos')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout({ hideTabs, onTabPress }: { hideTabs: boolean; onTabPress: (name: TabName) => void }) {
  const colors = useColors();
  const { t } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const showPersonalTabs = isLoaded && isSignedIn;
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenListeners={({ route, navigation }) => ({
        tabPress: event => {
          event.preventDefault();
          const tabState = navigation.getState().routes.find(tab => tab.name === route.name)?.state;
          onTabPress(route.name as TabName);
          // A bare tab navigate restores a nested page such as Following,
          // including when it was the first route in a deep-linked stack.
          // Only specify the child index when the saved route is not already
          // there, so an open Gallery root keeps its filters and search.
          const activePage = tabState?.routes?.[tabState.index ?? 0]?.name;
          if (activePage === 'index') navigation.navigate(route.name);
          else navigation.navigate(route.name, { screen: 'index' });
        },
      })}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        tabBarStyle: {
          display: hideTabs ? 'none' : 'flex',
          position: isIOS ? 'absolute' : 'relative',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
           ...(!isWeb && !isIOS ? { height: 60 + insets.bottom, paddingBottom: insets.bottom } : {}),
        },
         tabBarItemStyle: !isWeb && !isIOS ? { minHeight: 56 } : undefined,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          headerTitleAlign: 'left',
          headerTitle: () => (
            <Image
              source={require('../../../../attached_assets/image_1790351792491.png')}
              style={styles.brandWordmark}
              resizeMode="contain"
              accessibilityLabel="PhotoMatrix"
              accessibilityIgnoresInvertColors
            />
          ),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
       <Tabs.Screen name="gallery" options={{ title: t('gallery'), headerShown: false, tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }} />
       <Tabs.Screen name="my-photos" options={{ title: t('myPhotos'), headerShown: false, tabBarButton: showPersonalTabs ? undefined : () => null, tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
        <Tabs.Screen name="liked-photos" options={{ title: t('likedPhotos'), headerShown: false, tabBarButton: showPersonalTabs ? undefined : () => null, tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brandWordmark: { width: 190, height: 56 },
});

export default function TabLayout() {
  const [hideTabs, setHideTabs] = useState(false);
  const [resets, setResets] = useState<TabResets>({ index: 0, gallery: 0, 'my-photos': 0, 'liked-photos': 0 });
  const [requestedTab, setRequestedTab] = useState<TabName | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const onTabPress = useCallback((name: TabName) => {
    setResets(previous => ({ ...previous, [name]: previous[name] + 1 }));
    if (isLiquidGlassAvailable()) setRequestedTab(name);
  }, []);
  useEffect(() => {
    if (!requestedTab) return;
    const root = tabRoots[requestedTab];
    if (pathname !== root.path) router.replace(root.href);
    setRequestedTab(null);
  }, [pathname, requestedTab, router]);
  return (
    <TabBarVisibilityContext.Provider value={setHideTabs}>
      <TabResetContext.Provider value={resets}>
        {isLiquidGlassAvailable()
          ? <NativeTabLayout hideTabs={hideTabs} onTabPress={onTabPress} />
          : <ClassicTabLayout hideTabs={hideTabs} onTabPress={onTabPress} />}
      </TabResetContext.Provider>
    </TabBarVisibilityContext.Provider>
  );
}
