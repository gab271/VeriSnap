/**
 * Plans.
 *
 * Reached two ways — by hitting the free limit, or by tapping the usage counter —
 * so the heading states which situation you are in rather than selling at you in
 * both. Plans are laid out as rows in the same register as everything else: name,
 * price, what it unlocks.
 *
 * Purchases run through PurchaseService, which is stubbed in this build (real
 * in-app purchases need a native build), so the modal reports that plainly
 * instead of pretending a checkout happened.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { purchaseTier, type PremiumTier } from '@/services/purchaseService';
import { useEntitlementStore } from '@/store/entitlementStore';
import { palette, radius, scrim, space, type } from '@/theme/tokens';

interface Tier {
  id: PremiumTier;
  name: string;
  price: string;
  unlocks: string;
}

const TIERS: Tier[] = [
  {
    id: 'premium',
    name: 'Premium',
    price: '€4.99 / month',
    unlocks: 'Unlimited captures. Priority upload.',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€12.99 / month',
    unlocks: 'Everything in Premium, plus court-ready exports and verification certificates.',
  },
];

export function UpgradeModal() {
  const visible = useEntitlementStore((s) => s.showUpgradeModal);
  const monthlyCount = useEntitlementStore((s) => s.monthlyCount);
  const limit = useEntitlementStore((s) => s.limit);
  const setShowUpgradeModal = useEntitlementStore((s) => s.setShowUpgradeModal);

  const [pendingTier, setPendingTier] = useState<PremiumTier | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const atLimit = monthlyCount >= limit;

  const close = () => {
    setNotice(null);
    setShowUpgradeModal(false);
  };

  const handleUpgrade = async (tier: PremiumTier) => {
    setNotice(null);
    setPendingTier(tier);
    const result = await purchaseTier(tier);
    setPendingTier(null);
    setNotice(result.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Absorbs taps so the sheet doesn't dismiss when you interact with it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.eyebrow}>{atLimit ? 'FREE PLAN LIMIT' : 'YOUR PLAN'}</Text>
          <Text style={styles.title}>
            {atLimit ? 'You have used all 3 free captures' : 'Free plan'}
          </Text>
          <Text style={styles.body}>
            {monthlyCount} of {limit} captures filed this month. The count resets on the 1st.
          </Text>

          <View style={styles.tiers}>
            {TIERS.map((tier) => (
              <View key={tier.id} style={styles.tier}>
                <View style={styles.tierHead}>
                  <Text style={styles.tierName}>{tier.name.toUpperCase()}</Text>
                  <Text style={styles.tierPrice}>{tier.price}</Text>
                </View>
                <Text style={styles.tierUnlocks}>{tier.unlocks}</Text>
                <Button
                  label={`Choose ${tier.name}`}
                  onPress={() => handleUpgrade(tier.id)}
                  variant={tier.id === 'premium' ? 'primary' : 'secondary'}
                  loading={pendingTier === tier.id}
                  disabled={pendingTier !== null}
                />
              </View>
            ))}
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable onPress={close} style={styles.dismiss} accessibilityRole="button">
            <Text style={styles.dismissLabel}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrim.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.ink,
    borderTopWidth: 1,
    borderColor: palette.rule,
    padding: space.xl,
    gap: space.md,
  },
  eyebrow: { ...type.label, color: palette.amber },
  title: { ...type.title, color: palette.chalk },
  body: { ...type.dataSmall, color: palette.mist },

  tiers: { gap: space.md, marginTop: space.sm },
  tier: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.sm,
    padding: space.lg,
  },
  tierHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tierName: { ...type.label, color: palette.chalk },
  tierPrice: { ...type.data, color: palette.cyan },
  tierUnlocks: { ...type.body, color: palette.mist, marginBottom: space.xs },

  notice: { ...type.dataSmall, color: palette.mist },
  dismiss: { alignSelf: 'center', paddingVertical: space.sm },
  dismissLabel: { ...type.label, color: palette.mist },
});
