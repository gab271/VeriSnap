/**
 * Review before filing.
 *
 * Structured as a provisional version of the record it is about to become — same
 * label/value rows, same order — so nothing about the evidence appears for the
 * first time after you have already committed to it.
 *
 * The note above the actions states the real consequence: filing is permanent.
 * Evidence is append-only by design, so this is the last moment a capture can be
 * discarded, and the interface says so plainly rather than burying it.
 */
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { palette, space, type } from '@/theme/tokens';
import type { CaptureResult } from '@/types/evidence';
import { formatCoords, formatStamp } from '@/utils/format';

interface CapturePreviewProps {
  capture: CaptureResult;
  busy?: boolean;
  onDiscard: () => void;
  onUse: () => void;
}

export function CapturePreview({ capture, busy = false, onDiscard, onUse }: CapturePreviewProps) {
  const exifCount = capture.exif ? Object.keys(capture.exif).length : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: capture.uri }} style={styles.photo} contentFit="cover" />

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Unfiled capture</Text>

          <View style={styles.fields}>
            <Field
              label="Captured"
              value={formatStamp(capture.utcTimestamp)}
              note="Device clock, stamped at the shutter"
            />
            <Field
              label="Location"
              value={formatCoords(
                capture.gps?.latitude ?? null,
                capture.gps?.longitude ?? null,
                capture.gps?.accuracy ?? null,
              )}
              note="Read from the OS at the shutter, not from EXIF"
            />
            <Field label="Size" value={`${capture.width} × ${capture.height}`} />
            <Field label="EXIF" value={exifCount > 0 ? `${exifCount} tags` : 'None returned'} />
          </View>

          <Text style={styles.consequence}>
            Filing fingerprints this file and seals it. Filed evidence cannot be edited or
            deleted — this is the last moment to discard it.
          </Text>

          <View style={styles.actions}>
            <Button label="Discard" variant="secondary" onPress={onDiscard} disabled={busy} style={styles.action} />
            <Button label="File as evidence" onPress={onUse} loading={busy} style={styles.action} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  scroll: { paddingBottom: space.xxl },
  photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: palette.inkRaised },
  body: { padding: space.xl, gap: space.xl },
  sectionLabel: { ...type.label, color: palette.mist },
  fields: { gap: space.md },
  consequence: { ...type.body, color: palette.chalk },
  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1 },
});
