/**
 * The fingerprint band — VeriSnap's signature element.
 *
 * A SHA-256 *is* a fingerprint, but 64 hex characters are unreadable to a human:
 * nobody can tell two hashes apart at a glance, which is exactly the comparison
 * evidence work demands. So we render the hash's own bytes as a bar band. Each of
 * the 32 bytes sets one bar's height and tint, which means the shape is derived
 * entirely from the data — no decoration, no randomness. Two identical files
 * produce identical bands; a single altered byte produces an obviously different
 * one.
 *
 * It doubles as the identifier in the log (a compact spine on each row) and the
 * hero on the record screen, so the same mark carries identity at both scales.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme/tokens';
import { FINGERPRINT_BAR_COUNT, hashToBars } from '@/utils/fingerprint';

/** On screen: low bytes sit back in the ground, high bytes surface as peaks. */
const SCREEN_RAMP = ['#2C5A73', '#3E8AA8', palette.cyan, palette.chalk];

interface HashFingerprintProps {
  /** Hex SHA-256. */
  hash: string | null;
  height?: number;
  /** How many bytes to draw. 32 = the whole digest. */
  bars?: number;
  gap?: number;
}

export function HashFingerprint({
  hash,
  height = 44,
  bars = FINGERPRINT_BAR_COUNT,
  gap = 2,
}: HashFingerprintProps) {
  const computed = useMemo(
    () =>
      hashToBars(hash, bars).map((bar) => ({
        heightPct: bar.heightPct,
        color: bar.level < 0 ? palette.rule : SCREEN_RAMP[bar.level],
      })),
    [hash, bars],
  );

  return (
    <View
      style={[styles.container, { height, gap }]}
      accessibilityRole="image"
      accessibilityLabel={
        hash ? `Fingerprint for hash starting ${hash.slice(0, 8)}` : 'No fingerprint yet'
      }
    >
      {computed.map((bar, index) => (
        <View
          key={index}
          style={[styles.bar, { height: `${bar.heightPct}%`, backgroundColor: bar.color }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // Bottom-aligned: the band reads as a measurement, not an audio waveform.
    alignItems: 'flex-end',
    width: '100%',
  },
  bar: { flex: 1, borderRadius: 0.5 },
});
