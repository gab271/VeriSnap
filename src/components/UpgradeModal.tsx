/**
 * Upgrade paywall, shown when a free user hits the 3-per-month limit (or taps the
 * usage indicator). Self-contained: it reads its visibility and the usage numbers
 * from the entitlement store, so screens just render <UpgradeModal /> once.
 *
 * The "Upgrade" buttons go through PurchaseService, which is currently stubbed
 * (RevenueCat needs a dev build). The tiers/prices below are illustrative
 * placeholders for the freemium structure.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { purchaseTier, type PremiumTier } from '@/services/purchaseService';
import { useEntitlementStore } from '@/store/entitlementStore';

interface Tier {
  id: PremiumTier;
  name: string;
  price: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: 'premium',
    name: 'Premium',
    price: '€4.99 / mo',
    features: ['Unlimited captures', 'Priority cloud sync'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€12.99 / mo',
    features: ['Everything in Premium', 'Court-ready PDF exports', 'Verification certificates'],
  },
];

export function UpgradeModal() {
  const theme = useTheme();
  const visible = useEntitlementStore((s) => s.showUpgradeModal);
  const monthlyCount = useEntitlementStore((s) => s.monthlyCount);
  const limit = useEntitlementStore((s) => s.limit);
  const setShowUpgradeModal = useEntitlementStore((s) => s.setShowUpgradeModal);

  const [pendingTier, setPendingTier] = useState<PremiumTier | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => {
    setNotice(null);
    setShowUpgradeModal(false);
  };

  const handleUpgrade = async (tier: PremiumTier) => {
    setNotice(null);
    setPendingTier(tier);
    const result = await purchaseTier(tier);
    setPendingTier(null);
    // Stub returns ok:false with an explanatory message in this Expo Go build.
    setNotice(result.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Stop propagation so taps inside the card don't dismiss the modal. */}
        <Pressable style={styles.cardWrapper} onPress={() => {}}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">Upgrade VeriSnap</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You&apos;ve used {monthlyCount} of {limit} free captures this month. Upgrade
              for unlimited tamper-evident evidence.
            </ThemedText>

            {TIERS.map((tier) => (
              <View key={tier.id} style={[styles.tier, { borderColor: theme.backgroundSelected }]}>
                <View style={styles.tierHeader}>
                  <ThemedText type="smallBold">{tier.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {tier.price}
                  </ThemedText>
                </View>
                {tier.features.map((feature) => (
                  <ThemedText key={feature} type="small" themeColor="textSecondary">
                    • {feature}
                  </ThemedText>
                ))}
                <Pressable
                  style={[styles.upgradeBtn, { backgroundColor: theme.text }]}
                  onPress={() => handleUpgrade(tier.id)}
                  disabled={pendingTier !== null}
                >
                  <ThemedText style={[styles.upgradeLabel, { color: theme.background }]}>
                    {pendingTier === tier.id ? 'Processing…' : `Upgrade to ${tier.name}`}
                  </ThemedText>
                </Pressable>
              </View>
            ))}

            {notice ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
                {notice}
              </ThemedText>
            ) : null}

            <Pressable onPress={close} style={styles.later}>
              <ThemedText type="small" themeColor="textSecondary">
                Maybe later
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrapper: { width: '100%' },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Spacing.four },
  tier: {
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  upgradeBtn: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  upgradeLabel: { fontSize: 15, fontWeight: '600' },
  notice: { textAlign: 'center' },
  later: { alignItems: 'center', paddingVertical: Spacing.two },
});
