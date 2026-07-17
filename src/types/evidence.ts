import { EVIDENCE_CATEGORIES } from '@/utils/constants';

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/** GPS fix captured at the exact moment the shutter is pressed. */
export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres, if the device reported it. */
  accuracy: number | null;
  altitude: number | null;
  /** UTC ISO-8601 time the OS produced this location fix. */
  capturedAt: string;
}

/** Snapshot of the device that produced the evidence. */
export interface DeviceInfo {
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
  /** Whether capture happened on a physical device vs. a simulator. */
  isPhysicalDevice: boolean;
  appVersion: string | null;
}

/**
 * The raw output of a single secure capture, produced entirely on-device and
 * before any network activity. It is the hand-off object to the hashing engine
 * (next milestone). Note the GPS here is read independently from the OS, NOT
 * pulled from the (untrusted, often-missing) EXIF block.
 */
export interface CaptureResult {
  /** Local file URI in the app's private sandbox — never the shared gallery. */
  uri: string;
  width: number;
  height: number;
  /** EXIF as returned by the camera; may be partial and is treated as untrusted. */
  exif: Record<string, unknown> | null;
  /** Independently-read GPS fix at shutter time (not EXIF-derived). */
  gps: GpsCoordinates | null;
  /** Device UTC time stamped the instant the shutter was pressed. */
  utcTimestamp: string;
}

/**
 * The metadata object assembled on-device for each capture. This is the payload
 * that gets hashed-alongside and stored; it is the heart of the chain of custody.
 */
export interface EvidenceMetadata {
  userId: string;
  /** Device wall-clock time (UTC ISO-8601). Informational — see note below. */
  utcTimestamp: string;
  gpsCoordinates: GpsCoordinates | null;
  deviceInfo: DeviceInfo;
  /** Raw-byte SHA-256 (hex) of the media file, computed before upload. */
  sha256Hash: string;
  /** Raw EXIF block returned by the camera, for cross-referencing. */
  exif: Record<string, unknown> | null;
  category: EvidenceCategory | null;
}

/**
 * A row as stored in / read back from the `evidence_records` table.
 *
 * `capturedAtUtc` is the untrusted device clock; `serverReceivedAt` is written by
 * Postgres (`default now()`) and is the trusted, tamper-proof timestamp used for
 * legal purposes.
 */
export interface EvidenceRecord {
  id: string;
  userId: string;
  storagePath: string;
  sha256Hash: string;
  capturedAtUtc: string;
  serverReceivedAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  locationCapturedAt: string | null;
  deviceInfo: DeviceInfo | null;
  exif: Record<string, unknown> | null;
  category: EvidenceCategory | null;
  createdAt: string;
}
