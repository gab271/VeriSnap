/**
 * Account — plan, legal documents, sign out, and deletion.
 *
 * Deletion is the delicate part. In most apps deleting your account loses your
 * settings; here it destroys evidence someone may be relying on in a dispute, and
 * there is no undo and no backup we can restore from. So the consequence is
 * spelled out in full and the action requires typing DELETE, rather than a tap
 * that could happen by accident or by someone else holding the phone.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { deleteAccount } from '@/services/account';
import { useAuthStore } from '@/store/authStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { palette, space, type } from '@/theme/tokens';

const CONFIRM_WORD = 'DELETE';

export function AccountScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const monthlyCount = useEntitlementStore((s) => s.monthlyCount);
  const limit = useEntitlementStore((s) => s.limit);
  const setShowUpgradeModal = useEntitlementStore((s) => s.setShowUpgradeModal);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      Alert.alert('Type DELETE to confirm', 'This protects you from deleting evidence by accident.');
      return;
    }

    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    if (!result.ok) {
      Alert.alert('Account not deleted', result.message);
      return;
    }
    // Nothing left to return to — the auth gate routes back to sign-in.
    await signOut();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back to camera"
          hitSlop={12}
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>

        <View style={styles.masthead}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>{user?.email ?? 'Signed in'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plan</Text>
          <Field
            label="Current"
            value={isPremium ? 'Premium' : 'Free'}
            note={
              isPremium
                ? 'Unlimited captures'
                : `${monthlyCount} of ${limit} captures filed this month`
            }
          />
          {!isPremium ? (
            <Button label="View plans" variant="secondary" onPress={() => setShowUpgradeModal(true)} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <Pressable style={styles.link} onPress={() => router.push('/legal/terms')}>
            <Text style={styles.linkLabel}>Terms of Service</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.linkLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.dangerLabel]}>Delete account</Text>
          <Text style={styles.consequence}>
            This permanently deletes your account, every evidence record you have filed, and every
            stored photograph. It cannot be undone, and we cannot recover it for you afterwards.
          </Text>
          <Text style={styles.consequence}>
            If you may need this evidence later, export the certificates first.
          </Text>

          <View style={styles.confirmBlock}>
            <Text style={styles.inputLabel}>TYPE {CONFIRM_WORD} TO CONFIRM</Text>
            <TextInput
              style={[
                styles.input,
                { borderBottomColor: focused ? palette.vermilion : palette.rule },
              ]}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={palette.rule}
              autoCapitalize="characters"
              autoCorrect={false}
              value={confirmText}
              onChangeText={setConfirmText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              editable={!deleting}
            />
          </View>

          <Button
            label="Delete my account"
            variant="danger"
            onPress={handleDelete}
            loading={deleting}
            disabled={confirmText.trim().toUpperCase() !== CONFIRM_WORD}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  scroll: { padding: space.xl, paddingBottom: space.xxl, gap: space.xxl },
  back: { alignSelf: 'flex-start' },
  backGlyph: { ...type.data, color: palette.mist, fontSize: 18 },
  masthead: { gap: space.xs },
  eyebrow: { ...type.label, color: palette.cyan },
  title: { ...type.title, color: palette.chalk },

  section: { gap: space.md },
  sectionLabel: { ...type.label, color: palette.mist },
  dangerLabel: { color: palette.vermilion },

  link: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  linkLabel: { ...type.body, color: palette.chalk },
  chevron: { ...type.data, color: palette.mist, fontSize: 18 },

  consequence: { ...type.body, color: palette.chalk },
  confirmBlock: { gap: space.sm },
  inputLabel: { ...type.label, color: palette.mist },
  input: { ...type.data, color: palette.chalk, borderBottomWidth: 1, paddingVertical: space.sm },
});
