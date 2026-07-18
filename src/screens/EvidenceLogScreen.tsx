/**
 * The evidence log.
 *
 * Deliberately not a photo grid. A gallery foregrounds the picture, but the
 * product here is the *record* — so each row leads with the things that make it
 * evidence: when it was taken, its fingerprint, and whether it is sealed. The
 * thumbnail is supporting information, not the headline.
 */
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HashFingerprint } from '@/components/HashFingerprint';
import { SealBadge } from '@/components/SealBadge';
import { getSignedUrls, listEvidence } from '@/services/evidenceQueries';
import { palette, radius, space, type } from '@/theme/tokens';
import type { EvidenceRecord } from '@/types/evidence';
import { formatStampShort } from '@/utils/format';
import { sealStateOf } from '@/utils/seal';

export function EvidenceLogScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const rows = await listEvidence();
      setRecords(rows);
      // One batched request for all thumbnails — the bucket is private, so each
      // image needs a short-lived signed URL.
      setThumbs(await getSignedUrls(rows.map((r) => r.storagePath)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload on focus so a capture you just took is already here when you come back.
  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const sealedCount = records.filter((r) => sealStateOf(r) === 'sealed').length;

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back to camera"
        hitSlop={12}
      >
        <Text style={styles.backGlyph}>←</Text>
      </Pressable>

      <Text style={styles.title}>Evidence log</Text>
      <Text style={styles.summary}>
        {records.length === 0
          ? 'No records'
          : `${records.length} record${records.length === 1 ? '' : 's'} · ${sealedCount} sealed`}
      </Text>
    </View>
  );

  const renderRow = ({ item }: { item: EvidenceRecord }) => {
    const uri = thumbs[item.storagePath];
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push(`/evidence/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Record from ${formatStampShort(item.capturedAtUtc)}`}
      >
        <View style={styles.thumbFrame}>
          {uri ? (
            <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={120} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
        </View>

        <View style={styles.rowBody}>
          <Text style={styles.stamp}>{formatStampShort(item.capturedAtUtc)}</Text>
          <HashFingerprint hash={item.serverSha256Hash ?? item.sha256Hash} height={18} bars={20} />
          <View style={styles.rowFooter}>
            <SealBadge state={sealStateOf(item)} />
            <Text style={styles.coords} numberOfLines={1}>
              {item.gpsLat != null && item.gpsLng != null
                ? `${item.gpsLat.toFixed(4)}, ${item.gpsLng.toFixed(4)}`
                : 'No GPS'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator color={palette.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ListHeaderComponent={renderHeader}
        ItemSeparatorComponent={() => <View style={styles.rule} />}
        contentContainerStyle={records.length === 0 && styles.emptyContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={palette.cyan}
            colors={[palette.cyan]}
          />
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.state}>
              <Text style={styles.stateTitle}>Couldn&apos;t load the log</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <Pressable style={styles.action} onPress={() => load('refresh')}>
                <Text style={styles.actionLabel}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={styles.stateTitle}>Nothing filed yet</Text>
              <Text style={styles.stateBody}>
                Evidence you capture is fingerprinted, sealed, and filed here.
              </Text>
              <Pressable style={styles.action} onPress={() => router.back()}>
                <Text style={styles.actionLabel}>Capture evidence</Text>
              </Pressable>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContent: { flexGrow: 1 },

  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  back: { marginBottom: space.md },
  backGlyph: { ...type.data, color: palette.mist, fontSize: 18 },
  title: { ...type.display, color: palette.chalk },
  summary: { ...type.dataSmall, color: palette.mist },

  row: { flexDirection: 'row', gap: space.lg, paddingHorizontal: space.xl, paddingVertical: space.lg },
  rowPressed: { backgroundColor: palette.inkRaised },
  thumbFrame: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.rule,
  },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { backgroundColor: palette.inkRaised },
  rowBody: { flex: 1, gap: space.sm, justifyContent: 'center' },
  stamp: { ...type.data, color: palette.chalk },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  coords: { ...type.dataSmall, color: palette.mist, flexShrink: 1 },
  rule: { height: 1, backgroundColor: palette.rule, marginHorizontal: space.xl },

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  stateTitle: { ...type.title, color: palette.chalk },
  stateBody: { ...type.body, color: palette.mist, textAlign: 'center', maxWidth: 300 },
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
