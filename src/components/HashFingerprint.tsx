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

/** Low bytes sit back in the ground; high bytes surface as bright peaks. */
const RAMP = ['#2C5A73', '#3E8AA8', palette.cyan, palette.chalk];

interface HashFingerprintProps {
  /** Hex SHA-256. */
  hash: string | null;
  height?: number;
  /** How many bytes to draw. 32 = the whole digest. */
  bars?: number;
  gap?: number;
}

interface Bar {
  heightPct: number;
  color: string;
}

function toBars(hash: string | null, count: number): Bar[] {
  if (!hash || hash.length < count * 2) {
    // Unknown hash renders as a flat, inert baseline rather than a fake pattern.
    return Array.from({ length: count }, () => ({ heightPct: 12, color: palette.rule }));
  }

  const bars: Bar[] = [];
  for (let i = 0; i < count; i += 1) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    const safeByte = Number.isNaN(byte) ? 0 : byte;
    bars.push({
      // Keep a floor so every bar stays visible as part of the band.
      heightPct: 18 + (safeByte / 255) * 82,
      color: RAMP[Math.min(RAMP.length - 1, Math.floor(safeByte / 64))],
    });
  }
  return bars;
}

export function HashFingerprint({ hash, height = 44, bars = 32, gap = 2 }: HashFingerprintProps) {
  const computed = useMemo(() => toBars(hash, bars), [hash, bars]);

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
