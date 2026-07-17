/**
 * Secure Camera capture screen.
 *
 * =========================== THE CORE SECURITY RULE ===========================
 * VeriSnap captures evidence from the LIVE camera only. There is deliberately no
 * `expo-image-picker`, no gallery access, and no file import anywhere in the app.
 * `CameraView.takePictureAsync` is the single source of media, so every record
 * provably originates from a real-time capture rather than a pre-existing (and
 * possibly doctored) file. Do not add a picker to this screen.
 * =============================================================================
 *
 * At the shutter press we bind three things to the frame from trusted sources:
 *   1. the UTC timestamp (device clock, stamped before any async work),
 *   2. the GPS fix (read independently from the OS, not from EXIF), and
 *   3. the raw EXIF the camera returned (kept only for cross-referencing).
 * That bundle is then hashed on-device and uploaded (or queued offline) by
 * saveEvidence; the free-tier paywall gates it at 3 captures/month.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { LocationSubscription } from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraOverlay } from '@/components/CameraOverlay';
import { CapturePreview } from '@/components/CapturePreview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UpgradeModal } from '@/components/UpgradeModal';
import { useTheme } from '@/hooks/use-theme';
import { saveEvidence } from '@/services/evidence';
import { requestLocationPermission, watchLocation } from '@/services/location';
import { useAuthStore } from '@/store/authStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useEvidenceStore } from '@/store/evidenceStore';
import type { CaptureResult, GpsCoordinates } from '@/types/evidence';

export function CaptureScreen() {
  const theme = useTheme();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const pendingCount = useEvidenceStore((s) => s.pendingCount);
  const refreshPending = useEvidenceStore((s) => s.refreshPending);
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const monthlyCount = useEntitlementStore((s) => s.monthlyCount);
  const limit = useEntitlementStore((s) => s.limit);
  const refreshEntitlement = useEntitlementStore((s) => s.refresh);
  const setShowUpgradeModal = useEntitlementStore((s) => s.setShowUpgradeModal);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [gps, setGps] = useState<GpsCoordinates | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  // True while the captured file is being hashed / metadata is being assembled.
  const [processing, setProcessing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  // Single timer drives the HUD clock (passed down so there's only one interval).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load the user's plan + this month's usage so the counter/paywall are accurate.
  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  // Request foreground location and keep a live high-accuracy fix while mounted.
  // The subscription is torn down on unmount — we never track in the background.
  useEffect(() => {
    let active = true;
    let subscription: LocationSubscription | undefined;

    (async () => {
      const granted = await requestLocationPermission();
      if (!active) return;
      setLocationGranted(granted);
      if (granted) {
        subscription = await watchLocation((coords) => {
          if (active) setGps(coords);
        });
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || !cameraReady) return;

    // Stamp the shutter instant BEFORE the async work, so the timestamp reflects
    // the moment of capture, not when image processing finishes.
    const utcTimestamp = new Date().toISOString();
    // Snapshot the freshest GPS fix we are already showing in the HUD.
    const gpsAtShutter = gps;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, exif: true });
      if (!photo) return;
      setCapture({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        exif: (photo.exif as Record<string, unknown> | undefined) ?? null,
        gps: gpsAtShutter,
        utcTimestamp,
      });
    } catch (error) {
      Alert.alert('Capture failed', error instanceof Error ? error.message : String(error));
    } finally {
      setIsCapturing(false);
    }
  }, [cameraReady, gps, isCapturing]);

  const handleUseAsEvidence = useCallback(async () => {
    if (!capture || !user) return;

    setProcessing(true);
    try {
      // Hash on-device, then upload (or queue offline). saveEvidence returns a
      // typed result rather than throwing for expected outcomes.
      const result = await saveEvidence({ capture, userId: user.id });
      await Promise.all([refreshPending(), refreshEntitlement()]);

      switch (result.status) {
        case 'uploaded':
          Alert.alert(
            'Evidence secured',
            `Uploaded and recorded with a trusted server timestamp.\n\nSHA-256:\n${result.sha256Hash}`,
            [{ text: 'Done', onPress: () => setCapture(null) }],
          );
          break;
        case 'queued':
          Alert.alert(
            'Saved offline',
            "No connection right now. Your evidence is encrypted on this device and will " +
              "upload automatically as soon as you're back online.\n\nSHA-256:\n" +
              result.sha256Hash,
            [{ text: 'Done', onPress: () => setCapture(null) }],
          );
          break;
        case 'limit_reached':
          // The capture can't be saved on the free plan — discard it and present
          // the paywall. The server trigger is the actual enforcement.
          setCapture(null);
          setShowUpgradeModal(true);
          break;
        case 'error':
          Alert.alert('Could not save', result.message);
          break;
      }
    } finally {
      setProcessing(false);
    }
  }, [capture, user, refreshPending, refreshEntitlement, setShowUpgradeModal]);

  // ---- Permission / loading states -----------------------------------------
  if (!cameraPermission) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.permission}>
          <ThemedText type="subtitle" style={styles.center}>
            Camera access
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            VeriSnap captures evidence live and never imports from your gallery, so
            camera access is required to continue.
          </ThemedText>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: theme.text }]}
            onPress={requestCameraPermission}
          >
            <ThemedText style={[styles.primaryBtnLabel, { color: theme.background }]}>
              Grant camera access
            </ThemedText>
          </Pressable>
          <Pressable onPress={signOut}>
            <ThemedText type="small" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ---- Post-capture review --------------------------------------------------
  if (capture) {
    return (
      <CapturePreview
        capture={capture}
        busy={processing}
        onDiscard={() => setCapture(null)}
        onUse={handleUseAsEvidence}
      />
    );
  }

  // ---- Live camera ----------------------------------------------------------
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      <CameraOverlay gps={gps} now={now} />

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRight}>
          <Pressable style={styles.topButton} onPress={signOut}>
            <Text style={styles.topButtonText}>Sign out</Text>
          </Pressable>

          {isPremium ? (
            <View style={styles.premiumPill}>
              <Text style={styles.premiumText}>★ Premium</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.usagePill, monthlyCount >= limit && styles.usagePillFull]}
              onPress={() => setShowUpgradeModal(true)}
            >
              <Text style={styles.usageText}>
                {monthlyCount} / {limit} this month
              </Text>
            </Pressable>
          )}

          {pendingCount > 0 ? (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingText}>⧗ {pendingCount} pending upload</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.controls} edges={['bottom']} pointerEvents="box-none">
        {locationGranted === false ? (
          <View style={styles.warnPill}>
            <Text style={styles.warnText}>Location off — evidence will be saved without GPS</Text>
          </View>
        ) : null}

        <View style={styles.controlRow}>
          {/* Left slot kept empty to keep the shutter centred. */}
          <View style={styles.sideSlot} />

          <Pressable
            onPress={handleCapture}
            disabled={!cameraReady || isCapturing}
            style={({ pressed }) => [
              styles.shutter,
              pressed && styles.shutterPressed,
              (!cameraReady || isCapturing) && styles.shutterDisabled,
            ]}
          >
            <View style={styles.shutterInner}>
              {isCapturing ? <ActivityIndicator color="#000" /> : null}
            </View>
          </Pressable>

          <View style={styles.sideSlot}>
            <Pressable
              style={styles.flipButton}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.flipText}>Flip</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Paywall — self-managed via the entitlement store (visible on limit / tap). */}
      <UpgradeModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permission: { paddingHorizontal: 24, gap: 16, alignItems: 'center', maxWidth: 420 },
  center: { textAlign: 'center' },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnLabel: { fontSize: 16, fontWeight: '600' },

  topBar: { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end' },
  topRight: { alignItems: 'flex-end', gap: 6, marginTop: 8, marginRight: 12 },
  topButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  topButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pendingPill: {
    backgroundColor: 'rgba(245,166,35,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pendingText: { color: '#000', fontSize: 12, fontWeight: '600' },
  usagePill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  usagePillFull: { backgroundColor: 'rgba(229,72,77,0.92)' },
  usageText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  premiumPill: {
    backgroundColor: 'rgba(61,214,140,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  premiumText: { color: '#00110a', fontSize: 12, fontWeight: '700' },

  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 12 },
  warnPill: {
    backgroundColor: 'rgba(245,166,35,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  warnText: { color: '#000', fontSize: 12, fontWeight: '600' },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  sideSlot: { width: 64, alignItems: 'center', justifyContent: 'center' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.7 },
  shutterDisabled: { opacity: 0.5 },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  flipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
