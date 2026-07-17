import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useEvidenceStore } from '@/store/evidenceStore';

// Keep the native splash visible until we know whether a session exists, so the
// user never sees a flash of the sign-in screen before being routed to the app.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const initialize = useAuthStore((s) => s.initialize);
  const startSync = useEvidenceStore((s) => s.startSync);

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

  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync();
    }
  }, [initializing]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const backgroundColor = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      {/*
        Route guards enforce the auth boundary declaratively: when a screen's
        guard is false it is removed from the navigator and expo-router falls
        back to the first available route. Authenticated users can never reach
        sign-in, and signed-out users can never reach evidence screens.
      */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
