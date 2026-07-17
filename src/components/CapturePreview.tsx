/**
 * Post-capture review screen.
 *
 * Shows the freshly captured frame together with the exact metadata that will be
 * hashed and stored: the shutter-time UTC timestamp, the independently-read GPS
 * fix, the native resolution, and whether the camera returned EXIF. Surfacing
 * this before the user commits keeps the chain of custody transparent.
 *
 * The "Use as evidence" action is where the hashing engine (Milestone 3) and the
 * secure upload / offline queue (Milestone 4) will plug in.
 */
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaptureResult } from '@/types/evidence';

interface CapturePreviewProps {
  capture: CaptureResult;
  busy?: boolean;
  onDiscard: () => void;
  onUse: () => void;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.metaLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.metaValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export function CapturePreview({ capture, busy = false, onDiscard, onUse }: CapturePreviewProps) {
  const theme = useTheme();

  const exifKeyCount = capture.exif ? Object.keys(capture.exif).length : 0;
  const gpsText = capture.gps
    ? `${capture.gps.latitude.toFixed(6)}, ${capture.gps.longitude.toFixed(6)}` +
      (capture.gps.accuracy != null ? `  (±${Math.round(capture.gps.accuracy)} m)` : '')
    : 'No GPS fix recorded';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Image
            source={{ uri: capture.uri }}
            style={styles.image}
            resizeMode="contain"
          />

          <ThemedView type="backgroundElement" style={styles.metaCard}>
            <ThemedText type="smallBold">Evidence metadata</ThemedText>
            <MetaRow label="Captured (device UTC)" value={capture.utcTimestamp} />
            <MetaRow label="GPS (from OS, not EXIF)" value={gpsText} />
            {capture.gps ? (
              <MetaRow label="GPS fix time (UTC)" value={capture.gps.capturedAt} />
            ) : null}
            <MetaRow label="Resolution" value={`${capture.width} × ${capture.height}`} />
            <MetaRow
              label="EXIF tags returned"
              value={exifKeyCount > 0 ? `${exifKeyCount} tags` : 'none'}
            />
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Next: this file will be SHA-256 hashed on-device, then uploaded with a
            trusted server timestamp.
          </ThemedText>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.secondary, { borderColor: theme.backgroundSelected }]}
            onPress={onDiscard}
            disabled={busy}
          >
            <ThemedText style={styles.secondaryLabel}>Discard</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: theme.text }, busy && styles.disabled]}
            onPress={onUse}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.primaryLabel, { color: theme.background }]}>
                Use as evidence
              </ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Spacing.two,
    backgroundColor: '#000',
  },
  metaCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  metaLabel: { flexShrink: 0 },
  metaValue: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  button: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondary: { borderWidth: 1 },
  secondaryLabel: { fontSize: 16, fontWeight: '600' },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
