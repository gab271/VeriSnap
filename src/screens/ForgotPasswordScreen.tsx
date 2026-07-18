/**
 * Password reset, in two steps on one screen.
 *
 * Uses the emailed six-digit code rather than a magic link: a link has to
 * deep-link back into the app, which behaves differently in Expo Go, a dev build,
 * and the store build. A code is typed by hand and works identically everywhere —
 * and can be read on a laptop while resetting on a phone.
 *
 * The screen never reveals whether an address has an account. That would let
 * anyone test which emails are registered, and in a product about evidence, user
 * identities are worth protecting.
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
import { useAuthStore } from '@/store/authStore';
import { palette, space, type } from '@/theme/tokens';

type Step = 'request' | 'confirm';

interface ForgotPasswordScreenProps {
  onDone: () => void;
}

export function ForgotPasswordScreen({ onDone }: ForgotPasswordScreenProps) {
  const submitting = useAuthStore((s) => s.submitting);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rule = (field: string) => ({
    borderBottomColor: focused === field ? palette.cyan : palette.rule,
  });

  const handleRequest = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter the email address on your account.');
      return;
    }
    const { error: requestError } = await requestPasswordReset(email);
    // Deliberately the same outcome whether or not the account exists.
    if (requestError && !/rate|limit/i.test(requestError)) {
      setStep('confirm');
      setNotice('If that address has an account, a six-digit code is on its way.');
      return;
    }
    if (requestError) {
      setError(requestError);
      return;
    }
    setStep('confirm');
    setNotice('If that address has an account, a six-digit code is on its way.');
  };

  const handleConfirm = async () => {
    setError(null);
    if (!code.trim() || !password) {
      setError('Enter the code from your email and a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Passwords must be at least 6 characters.');
      return;
    }
    const { error: confirmError } = await confirmPasswordReset(email, code, password);
    if (confirmError) {
      setError(confirmError);
      return;
    }
    onDone();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.masthead}>
            <Text style={styles.eyebrow}>RESET PASSWORD</Text>
            <Text style={styles.title}>
              {step === 'request' ? 'Where should we send the code?' : 'Enter your code'}
            </Text>
          </View>

          {step === 'request' ? (
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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Send code" onPress={handleRequest} loading={submitting} />
            </View>
          ) : (
            <View style={styles.form}>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>CODE</Text>
                <TextInput
                  style={[styles.input, styles.code, rule('code')]}
                  placeholder="000000"
                  placeholderTextColor={palette.rule}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  onFocus={() => setFocused('code')}
                  onBlur={() => setFocused(null)}
                  editable={!submitting}
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
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
              <Button label="Set new password" onPress={handleConfirm} loading={submitting} />

              <Pressable onPress={() => setStep('request')} disabled={submitting} style={styles.link}>
                <Text style={styles.linkLabel}>Use a different email</Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={onDone} disabled={submitting} style={styles.link}>
            <Text style={styles.linkLabel}>Back to sign in</Text>
          </Pressable>
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
  eyebrow: { ...type.label, color: palette.cyan },
  title: { ...type.title, color: palette.chalk },
  form: { gap: space.xl },
  inputBlock: { gap: space.sm },
  inputLabel: { ...type.label, color: palette.mist },
  input: { ...type.data, color: palette.chalk, borderBottomWidth: 1, paddingVertical: space.sm },
  code: { fontSize: 20, letterSpacing: 6 },
  error: { ...type.dataSmall, color: palette.vermilion },
  notice: { ...type.dataSmall, color: palette.mist },
  link: { alignSelf: 'center', paddingVertical: space.sm },
  linkLabel: { ...type.label, color: palette.mist },
});
