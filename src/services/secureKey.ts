/**
 * Symmetric key management for encrypting queued offline payloads.
 *
 * The key lives in `expo-secure-store`, which is backed by the iOS Keychain and
 * the Android Keystore — hardware-protected, per-app storage that other apps
 * cannot read. The key itself is 256 bits of CSPRNG output from expo-crypto. We
 * generate it once, lazily, and reuse it; it never leaves the device.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'verisnap_payload_key_v1';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Returns the payload encryption key (hex), creating and persisting it once. */
export async function getOrCreatePayloadKeyHex(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;

  const keyBytes = Crypto.getRandomBytes(32); // 256-bit key
  const keyHex = bytesToHex(keyBytes);
  await SecureStore.setItemAsync(KEY_NAME, keyHex);
  return keyHex;
}
