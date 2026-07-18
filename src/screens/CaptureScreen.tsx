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
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CameraOverlay } from '@/components/CameraOverlay';
import { CapturePreview } from '@/components/CapturePreview';
import { UpgradeModal } from '@/components/UpgradeModal';
import { palette, radius, scrim, space, type } from '@/theme/tokens';
import { saveEvidence } from '@/services/evidence';
import { requestLocationPermission, watchLocation } from '@/services/location';
import { useAuthStore } from '@/store/authStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useEvidenceStore } from '@/store/evidenceStore';
import type { CaptureResult, GpsCoordinates } from '@/types/evidence';

export function CaptureScreen() {
  const router = useRouter();
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
        case 'uploaded': {
          // The server independently re-hashes and signs the record; surface that
          // outcome, because "sealed" is the claim that actually has legal weight.
          const sealNote =
            result.verification === 'verified'
              ? 'Sealed: the server re-hashed the stored file and signed the record.'
              : result.verification === 'mismatch'
                ? 'Seal broken: the stored file does not match the fingerprint taken at capture.'
                : 'Awaiting seal. It will be signed automatically.';

          Alert.alert('Evidence filed', `${sealNote}\n\nFingerprint\n${result.sha256Hash}`, [
            { text: 'Done', onPress: () => setCapture(null) },
          ]);
          break;
        }
        case 'queued':
          Alert.alert(
            'Filed offline',
            'No connection right now. This evidence is encrypted on your device and uploads ' +
              `automatically when you are back online.\n\nFingerprint\n${result.sha256Hash}`,
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
      <View style={styles.centered}>
        <ActivityIndicator color={palette.cyan} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centered}>
        <SafeAreaView style={styles.permission}>
          <Text style={styles.permissionLabel}>CAMERA</Text>
          <Text style={styles.permissionTitle}>Camera access is required</Text>
          <Text style={styles.permissionBody}>
            VeriSnap only records what the camera sees right now. It never imports from your
            gallery, which is what makes a capture worth anything as evidence.
          </Text>
          <Button label="Allow camera" onPress={requestCameraPermission} style={styles.stretch} />
          <Pressable onPress={signOut} style={styles.signOutLink} accessibilityRole="button">
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </SafeAreaView>
      </View>
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
            <View style={[styles.pill, { borderColor: palette.cyan }]}>
              <Text style={[styles.pillLabel, { color: palette.cyan }]}>PREMIUM</Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.pill,
                { borderColor: monthlyCount >= limit ? palette.vermilion : palette.rule },
              ]}
              onPress={() => setShowUpgradeModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`${monthlyCount} of ${limit} captures filed this month. Open plans.`}
            >
              <Text
                style={[
                  styles.pillLabel,
                  { color: monthlyCount >= limit ? palette.vermilion : palette.chalk },
                ]}
              >
                {monthlyCount} / {limit} THIS MONTH
              </Text>
            </Pressable>
          )}

          {pendingCount > 0 ? (
            <View style={[styles.pill, { borderColor: palette.amber }]}>
              <Text style={[styles.pillLabel, { color: palette.amber }]}>
                {pendingCount} AWAITING UPLOAD
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.controls} edges={['bottom']} pointerEvents="box-none">
        {locationGranted === false ? (
          <View style={styles.warnPill}>
            <Text style={styles.warnText}>Location off · captures will be filed without GPS</Text>
          </View>
        ) : null}

        <View style={styles.controlRow}>
          <View style={styles.sideSlot}>
            <Pressable
              style={styles.flipButton}
              onPress={() => router.push('/evidence')}
              accessibilityRole="button"
              accessibilityLabel="Open evidence log"
            >
              <Text style={styles.flipText}>Log</Text>
            </Pressable>
          </View>

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
  container: { flex: 1, backgroundColor: palette.ink },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink },
  permission: { paddingHorizontal: space.xl, gap: space.md, maxWidth: 420 },
  permissionLabel: { ...type.label, color: palette.cyan },
  permissionTitle: { ...type.title, color: palette.chalk },
  permissionBody: { ...type.body, color: palette.mist, marginBottom: space.sm },
  stretch: { alignSelf: 'stretch' },
  signOutLink: { alignSelf: 'center', paddingVertical: space.sm },
  signOutLabel: { ...type.label, color: palette.mist },

  topBar: { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end' },
  topRight: { alignItems: 'flex-end', gap: space.sm, marginTop: space.sm, marginRight: space.md },
  topButton: {
    backgroundColor: scrim.chrome,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
  },
  topButtonText: { ...type.label, color: palette.chalk },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    backgroundColor: scrim.chrome,
    borderWidth: 1,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  pillLabel: { ...type.label },

  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: space.md,
  },
  warnPill: {
    backgroundColor: scrim.chrome,
    borderWidth: 1,
    borderColor: palette.amber,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  warnText: { ...type.dataSmall, color: palette.amber },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: space.xl + space.sm,
    paddingBottom: space.xl,
  },
  sideSlot: { width: 64, alignItems: 'center', justifyContent: 'center' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: palette.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.7 },
  shutterDisabled: { opacity: 0.45 },
  flipButton: {
    backgroundColor: scrim.chrome,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.sm,
  },
  flipText: { ...type.label, color: palette.chalk },
});
