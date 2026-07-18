import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSansCondensed_400Regular,
  IBMPlexSansCondensed_600SemiBold,
  IBMPlexSansCondensed_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { configureBilling } from '@/services/purchaseService';
import { useAuthStore } from '@/store/authStore';
import { useEvidenceStore } from '@/store/evidenceStore';
import { palette } from '@/theme/tokens';

// Keep the native splash visible until we know whether a session exists, so the
// user never sees a flash of the sign-in screen before being routed to the app.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const initialize = useAuthStore((s) => s.initialize);
  const startSync = useEvidenceStore((s) => s.startSync);

  // Hold the splash until the typefaces are ready, so text never reflows on first
  // paint. Mono carries the hashes; a fallback swap would be visibly jarring.
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexSansCondensed_400Regular,
    IBMPlexSansCondensed_600SemiBold,
    IBMPlexSansCondensed_700Bold,
  });

  // Resolve the persisted session once, and subscribe to future auth changes.
  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // Once signed in, drain any offline queue and keep syncing on reconnect. A
  // session is required because uploads run under the user's RLS-scoped identity.
  useEffect(() => {
    if (!session) return;
    const unsubscribe = startSync();
    return unsubscribe;
  }, [session, startSync]);

  // Point RevenueCat at the Supabase user id, so its webhook can map a purchase
  // straight back to the right profile row. No-ops in Expo Go, where there is no
  // native billing SDK.
  useEffect(() => {
    if (!session?.user?.id) return;
    void configureBilling(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!initializing && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [initializing, fontsLoaded]);

  if (initializing || !fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={palette.cyan} />
      </View>
    );
  }

  return (
    <>
      {/* The app has one fixed identity — a vault looks the same every time you
          open it — so the status bar is pinned light rather than following the
          system theme. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink } }}
      >
        {/*
        Route guards enforce the auth boundary declaratively: when a screen's
        guard is false it is removed from the navigator and expo-router falls
        back to the first available route. Authenticated users can never reach
        sign-in, and signed-out users can never reach evidence screens.
      */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="evidence/index" />
          <Stack.Screen name="evidence/[id]" />
          <Stack.Screen name="account" />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>

        {/* Readable either way: someone deciding whether to sign up must be able
            to read the terms first, and store reviewers check for exactly that. */}
        <Stack.Screen name="legal/[doc]" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
  },
});
