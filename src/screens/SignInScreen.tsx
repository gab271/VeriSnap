/**
 * The front door.
 *
 * Laid out as an evidence record: the same label/value rows used on the record
 * screen, so the app teaches its own vocabulary — capture, fingerprint, seal —
 * before you are inside. The three rows are the product's actual guarantees, not
 * marketing copy, which is the only kind of claim this product can afford to make.
 *
 * Inputs are set in mono with a single rule underneath: data entry on a form,
 * not a rounded app field.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { palette, space, type } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';

type Mode = 'signIn' | 'signUp';

export function SignInScreen() {
  const submitting = useAuthStore((s) => s.submitting);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    const { error: authError } = await (mode === 'signIn' ? signIn : signUp)(email, password);
    if (authError) {
      setError(authError);
      return;
    }

    if (mode === 'signUp') {
      setNotice('Account created. If email confirmation is on, confirm it, then sign in.');
      setMode('signIn');
    }
  };

  const rule = (field: 'email' | 'password') => ({
    borderBottomColor: focused === field ? palette.cyan : palette.rule,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.masthead}>
            <Text style={styles.wordmark}>VERISNAP</Text>
            <Text style={styles.title}>Tamper-evident evidence</Text>
          </View>

          {/* The guarantee, in the same form as a filed record. */}
          <View style={styles.manifest}>
            <Field label="Capture" value="Live camera only. No gallery imports." />
            <Field label="Fingerprint" value="SHA-256 taken on this device, before upload." />
            <Field label="Seal" value="Countersigned by the server. Anyone can verify it." />
          </View>

          <View style={styles.form}>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                style={[styles.input, rule('email')]}
                placeholder="you@example.com"
                placeholderTextColor={palette.rule}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                editable={!submitting}
              />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={[styles.input, rule('password')]}
                placeholder="••••••••"
                placeholderTextColor={palette.rule}
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                editable={!submitting}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Button
              label={mode === 'signIn' ? 'Sign in' : 'Create account'}
              onPress={handleSubmit}
              loading={submitting}
            />

            <Pressable
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
              }}
              disabled={submitting}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Text style={styles.switchLabel}>
                {mode === 'signIn' ? 'Create an account' : 'Sign in instead'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },

  masthead: { gap: space.sm },
  wordmark: { ...type.label, color: palette.cyan },
  title: { ...type.display, color: palette.chalk },

  manifest: { gap: space.md },

  form: { gap: space.xl },
  inputBlock: { gap: space.sm },
  inputLabel: { ...type.label, color: palette.mist },
  input: {
    ...type.data,
    color: palette.chalk,
    borderBottomWidth: 1,
    paddingVertical: space.sm,
  },
  error: { ...type.dataSmall, color: palette.vermilion },
  notice: { ...type.dataSmall, color: palette.mist },
  switch: { alignSelf: 'center', paddingVertical: space.sm },
  switchLabel: { ...type.label, color: palette.mist },
});
