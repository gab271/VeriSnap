/**
 * Email / password authentication screen.
 *
 * A verifiable identity is the first link in the chain of custody: every piece
 * of evidence is stamped with the authenticated user's id. We therefore require
 * a real account (email + password) rather than anonymous access.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';

type Mode = 'signIn' | 'signUp';

export function SignInScreen() {
  const theme = useTheme();
  const submitting = useAuthStore((s) => s.submitting);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter both an email and a password.');
      return;
    }

    const action = mode === 'signIn' ? signIn : signUp;
    const { error: authError } = await action(email, password);

    if (authError) {
      setError(authError);
      return;
    }

    // On sign-up, Supabase may require email confirmation depending on project
    // settings, in which case no session is created yet.
    if (mode === 'signUp') {
      setNotice('Account created. If email confirmation is enabled, check your inbox before signing in.');
      setMode('signIn');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}
        >
          <View style={styles.header}>
            <ThemedText type="title">VeriSnap</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tamper-evident evidence capture
            </ThemedText>
          </View>

          <View style={styles.fields}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
            />
          </View>

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
          {notice ? (
            <ThemedText type="small" themeColor="textSecondary">
              {notice}
            </ThemedText>
          ) : null}

          <Pressable
            style={[styles.button, { backgroundColor: theme.text }, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setNotice(null);
              setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
            }}
            disabled={submitting}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.switchMode}>
              {mode === 'signIn'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </ThemedText>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one, alignItems: 'center' },
  fields: { gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  error: { color: '#e5484d' },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  switchMode: { textAlign: 'center' },
});
