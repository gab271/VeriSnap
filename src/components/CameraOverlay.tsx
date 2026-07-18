/**
 * Heads-up display drawn over the live camera feed.
 *
 * Beyond looking the part, the HUD is a trust feature: it shows the user the
 * exact UTC time and GPS fix that will be bound to their evidence, in real time,
 * BEFORE they press the shutter. What you see is what gets recorded — there is no
 * hidden step that injects a different time or place afterwards.
 *
 * `pointerEvents="none"` so the overlay never intercepts taps meant for the
 * shutter or camera controls underneath it.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, scrim, space, type } from '@/theme/tokens';
import type { GpsCoordinates } from '@/types/evidence';

interface CameraOverlayProps {
  gps: GpsCoordinates | null;
  /** Live clock value, ticked by the parent so there's a single timer. */
  now: Date;
}

export function CameraOverlay({ gps, now }: CameraOverlayProps) {
  const insets = useSafeAreaInsets();
  const hasFix = gps !== null;

  return (
    <View pointerEvents="none" style={[styles.container, { top: insets.top + 8 }]}>
      <View style={styles.pill}>
        <Text style={styles.label}>UTC</Text>
        <Text style={styles.value}>
          {now.toISOString().replace('T', '  ').replace('Z', '')}
        </Text>
      </View>

      <View style={styles.pill}>
        <View style={[styles.gpsDot, { backgroundColor: hasFix ? palette.cyan : palette.amber }]} />
        <Text style={styles.value}>
          {hasFix
            ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` +
              (gps.accuracy != null ? `  ·  ±${Math.round(gps.accuracy)} m` : '')
            : 'Acquiring GPS…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    alignItems: 'flex-start',
    gap: space.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: scrim.chrome,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
  },
  label: { ...type.label, color: palette.mist },
  // Mono keeps the ticking clock from shifting the layout every second.
  value: { ...type.data, color: palette.chalk },
  gpsDot: { width: 7, height: 7, borderRadius: 3.5 },
});
