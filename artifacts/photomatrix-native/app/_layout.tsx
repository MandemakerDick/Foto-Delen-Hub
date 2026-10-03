import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { LocaleProvider } from '@/context/locale';
import { AccountEpoch } from '@/utils/accountEpoch';
import { AccountEpochContext } from '@/context/account-epoch';
import { clearPrivateAccountCaches } from '@/utils/privateCache';

if (process.env.EXPO_PUBLIC_DOMAIN) setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { getToken, userId, isLoaded } = useAuth();
  const session = useRef(new AccountEpoch(userId)).current;
  const epoch = session.observe(userId);
  const [cacheOwner, setCacheOwner] = useState(userId);
  useLayoutEffect(() => {
    setAuthTokenGetter(() => isLoaded ? getToken() : Promise.resolve(null));
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded]);
  useLayoutEffect(() => {
    if (cacheOwner !== userId) {
      clearPrivateAccountCaches(queryClient);
      setCacheOwner(userId);
    }
  }, [cacheOwner, userId]);
  // Unmount observers before clearing their cache and never render a new
  // identity against the prior identity's private query results.
  if (cacheOwner !== userId) return null;
  return (
    <AccountEpochContext.Provider value={{ session, epoch }}>
      <Stack key={epoch} screenOptions={{ headerBackTitle: 'Back', headerStyle: { backgroundColor: '#0b0b0c' }, headerTintColor: '#e7e3dc', headerTitleStyle: { fontFamily: 'Inter_600SemiBold' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: true }} />
      <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
    </Stack>
    </AccountEpochContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <View style={{ flex: 1, backgroundColor: '#0b0b0c', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#e7e3dc', fontSize: 20, textAlign: 'center' }}>PhotoMatrix authentication is not configured.</Text><Text style={{ color: '#96908a', marginTop: 10, textAlign: 'center' }}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and reload.</Text></View>;
  }

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''} proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined} tokenCache={tokenCache}>
    <LocaleProvider>
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
    </LocaleProvider>
    </ClerkProvider>
  );
}
