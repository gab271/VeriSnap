/**
 * Seal status. Three states, three colours, one glyph each — deliberately
 * unmissable, because whether a record is sealed is the single most important
 * fact about it.
 */
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, space, type } from '@/theme/tokens';
import { SEAL_COPY, type SealState } from '@/utils/seal';

const TONE: Record<SealState, string> = {
  sealed: palette.cyan,
  awaiting: palette.amber,
  broken: palette.vermilion,
};

interface SealBadgeProps {
  state: SealState;
  /** `compact` for log rows, `full` for the record screen. */
  size?: 'compact' | 'full';
}

export function SealBadge({ state, size = 'compact' }: SealBadgeProps) {
  const tone = TONE[state];
  const { label, glyph } = SEAL_COPY[state];
  const full = size === 'full';

  return (
    <View
      style={[styles.badge, full && styles.badgeFull, { borderColor: tone }]}
      accessibilityRole="text"
      accessibilityLabel={`Seal status: ${label}`}
    >
      <Text style={[styles.glyph, { color: tone, fontSize: full ? 13 : 10 }]}>{glyph}</Text>
      <Text style={[styles.label, { color: tone, fontSize: full ? 12 : 10 }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs + 2,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  badgeFull: { paddingHorizontal: space.md, paddingVertical: space.xs + 2 },
  glyph: { ...type.label, letterSpacing: 0 },
  label: { ...type.label },
});
