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
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE CAPTURE</Text>
      </View>

      <View style={styles.pill}>
        <Text style={styles.label}>UTC</Text>
        <Text style={styles.value}>
          {now.toISOString().replace('T', '  ').replace('Z', '')}
        </Text>
      </View>

      <View style={styles.pill}>
        <View style={[styles.gpsDot, { backgroundColor: hasFix ? '#3dd68c' : '#f5a623' }]} />
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
    left: 12,
    right: 12,
    alignItems: 'flex-start',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  label: { color: '#9aa0a6', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  value: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    // Monospaced so the ticking clock doesn't shift the layout each second.
    fontVariant: ['tabular-nums'],
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
});
