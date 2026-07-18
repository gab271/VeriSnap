/**
 * A single evidence record — the chain of custody, laid out to be read.
 *
 * The page is ordered by what matters in a dispute, not by what's prettiest:
 * the seal first (is this trustworthy?), then the fingerprint (what exactly is
 * it?), then the record fields (when, where, on what).
 *
 * Two honesty details drive the design:
 *  - Captured and Recorded times are labelled with WHOSE clock they came from.
 *    The device clock is user-settable; only the server's is trusted, and hiding
 *    that distinction would overstate what the evidence proves.
 *  - When a seal is broken we show BOTH hashes side by side. The divergence is
 *    the finding, so it gets shown, not buried.
 */
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { HashFingerprint } from '@/components/HashFingerprint';
import { SealBadge } from '@/components/SealBadge';
import { exportCertificate } from '@/services/certificate';
import { getEvidenceById, getSignedUrl } from '@/services/evidenceQueries';
import { palette, radius, space, type } from '@/theme/tokens';
import type { EvidenceRecord } from '@/types/evidence';
import { formatCoords, formatStamp, groupHash } from '@/utils/format';
import { SEAL_COPY, sealStateOf } from '@/utils/seal';

function HashBlock({ label, hash, tone }: { label: string; hash: string | null; tone?: string }) {
  const groups = groupHash(hash);
  return (
    <View style={styles.hashBlock}>
      <Text style={[styles.fieldLabel, tone ? { color: tone } : null]}>{label}</Text>
      <View style={styles.hashGrid}>
        {groups.map((group, index) => (
          <Text key={index} style={styles.hashGroup}>
            {group}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function EvidenceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const found = await getEvidenceById(id);
      setRecord(found);
      if (found) setImageUri(await getSignedUrl(found.storagePath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = useCallback(async () => {
    if (!record) return;
    setExporting(true);
    const outcome = await exportCertificate(record);
    setExporting(false);
    if (outcome.status === 'unavailable' || outcome.status === 'error') {
      Alert.alert('Certificate not created', outcome.message);
    }
  }, [record]);

  const header = (
    <Pressable
      onPress={() => router.back()}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Back to evidence log"
      hitSlop={12}
    >
      <Text style={styles.backGlyph}>←</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.headerPad}>{header}</View>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !record) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.headerPad}>{header}</View>
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>{error ? 'Couldn’t load this record' : 'Record not found'}</Text>
          {error ? <Text style={styles.stateBody}>{error}</Text> : null}
          <Pressable style={styles.action} onPress={load}>
            <Text style={styles.actionLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const seal = sealStateOf(record);
  const sealCopy = SEAL_COPY[seal];
  const device = record.deviceInfo;
  const deviceLine = device
    ? `${device.modelName ?? device.brand ?? 'Unknown device'} · ${device.osName ?? ''} ${device.osVersion ?? ''}`.trim()
    : '—';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerPad}>{header}</View>

        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" transition={160} />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Text style={styles.fieldNote}>Image unavailable</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* 1. Seal — the first question anyone asks of evidence. */}
          <View style={styles.sealBlock}>
            <SealBadge state={seal} size="full" />
            <Text style={styles.sealNote}>{sealCopy.note}</Text>
            {record.verifiedAt ? (
              <Text style={styles.sealMeta}>Sealed {formatStamp(record.verifiedAt)}</Text>
            ) : null}
            {record.signingKeyId ? (
              <Text style={styles.sealMeta}>Key {record.signingKeyId}</Text>
            ) : null}
          </View>

          {/* 2. Fingerprint — the identity of the file itself. */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fingerprint</Text>
            <HashFingerprint
              hash={record.serverSha256Hash ?? record.sha256Hash}
              height={56}
              bars={32}
            />
            {seal === 'broken' ? (
              <>
                <HashBlock label="At capture" hash={record.sha256Hash} tone={palette.mist} />
                <HashBlock label="In storage now" hash={record.serverSha256Hash} tone={palette.vermilion} />
              </>
            ) : (
              <HashBlock label="SHA-256" hash={record.serverSha256Hash ?? record.sha256Hash} />
            )}
          </View>

          {/* 3. The record. */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Record</Text>
            <Field
              label="Captured"
              value={formatStamp(record.capturedAtUtc)}
              note="Device clock · not independently trusted"
            />
            <Field
              label="Recorded"
              value={formatStamp(record.serverReceivedAt)}
              note="Server clock · trusted timestamp"
            />
            <Field
              label="Location"
              value={formatCoords(record.gpsLat, record.gpsLng, record.gpsAccuracyM)}
              note={record.locationCapturedAt ? `Fix at ${formatStamp(record.locationCapturedAt)}` : undefined}
            />
            <Field
              label="Device"
              value={deviceLine}
              note={device && !device.isPhysicalDevice ? 'Captured on a simulator' : undefined}
            />
            {record.category ? <Field label="Category" value={record.category} /> : null}
            <Field label="Record" value={record.id} />
          </View>

          {/* 4. Signature — only meaningful once sealed. */}
          {record.signature ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Signature</Text>
              <Text style={styles.signature}>{record.signature}</Text>
              <Text style={styles.fieldNote}>
                Anyone can check this independently with the published public key — they never
                have to trust VeriSnap.
              </Text>
            </View>
          ) : null}

          {/* 5. The deliverable: what actually gets sent to a lawyer or insurer. */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Export</Text>
            <Button label="Export certificate" onPress={handleExport} loading={exporting} />
            <Text style={styles.fieldNote}>
              Creates a PDF holding the photograph, the fingerprint, the signature, and
              step-by-step instructions for verifying this record independently. Send the
              original file alongside it — verification is performed against the file, not the
              certificate.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  scroll: { paddingBottom: space.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  headerPad: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md },
  back: { alignSelf: 'flex-start' },
  backGlyph: { ...type.data, color: palette.mist, fontSize: 18 },

  photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: palette.inkRaised },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },

  body: { padding: space.xl, gap: space.xxl },

  sealBlock: { gap: space.sm },
  sealNote: { ...type.body, color: palette.chalk, marginTop: space.xs },
  sealMeta: { ...type.dataSmall, color: palette.mist },

  section: { gap: space.md },
  sectionLabel: { ...type.label, color: palette.mist },

  hashBlock: { gap: space.sm },
  hashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  hashGroup: { ...type.hash, color: palette.chalk },

  fieldLabel: { ...type.label, color: palette.mist, width: 92, paddingTop: 3 },
  fieldNote: { ...type.dataSmall, color: palette.mist },

  signature: { ...type.dataSmall, color: palette.chalk, lineHeight: 18 },

  stateTitle: { ...type.title, color: palette.chalk, textAlign: 'center' },
  stateBody: { ...type.body, color: palette.mist, textAlign: 'center' },
  action: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: palette.cyan,
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  actionLabel: { ...type.label, color: palette.cyan },
});
