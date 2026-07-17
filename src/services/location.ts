/**
 * Location service.
 *
 * SECURITY / EVIDENCE NOTE — why we don't trust EXIF for GPS:
 * Camera hardware (especially on Android) frequently omits EXIF GPS tags, and
 * EXIF is trivially editable after the fact. So instead of reading location from
 * the photo, we read it INDEPENDENTLY from the OS at the moment of capture and
 * bind it to the record ourselves. Keeping a live fix open while the camera is on
 * screen means the coordinate we stamp is exactly the one the user sees in the
 * on-screen HUD — nothing is added or altered later.
 *
 * We only ever request FOREGROUND ("when in use") location and only watch while
 * the camera screen is mounted. VeriSnap never tracks location in the background.
 */
import * as Location from 'expo-location';

import type { GpsCoordinates } from '@/types/evidence';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Normalise an OS location fix into our typed, serialisable shape. */
export function toGpsCoordinates(position: Location.LocationObject): GpsCoordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    altitude: position.coords.altitude ?? null,
    // The OS reports the fix time as epoch milliseconds; store it as UTC ISO-8601.
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

/**
 * Subscribe to high-accuracy location updates. Returns the subscription so the
 * caller can remove it when the camera closes.
 */
export async function watchLocation(
  onUpdate: (coords: GpsCoordinates) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 1000,
      distanceInterval: 0,
    },
    (position) => onUpdate(toGpsCoordinates(position)),
  );
}

/** One-shot high-accuracy fix (fallback when no watched position exists yet). */
export async function getCurrentLocation(): Promise<GpsCoordinates | null> {
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    return toGpsCoordinates(position);
  } catch {
    return null;
  }
}
