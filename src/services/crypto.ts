/**
 * AES-256-CBC encryption for offline payloads at rest.
 *
 * WHY WE ENCRYPT THE QUEUED PAYLOAD:
 * When a capture can't be uploaded immediately (no signal), we hold its metadata
 * on the device. That metadata contains sensitive information — precise GPS,
 * device identity, timestamps. Storing it in plaintext SQLite would expose it to
 * anyone with filesystem access (e.g. on a rooted/jailbroken device or via a
 * backup). So we encrypt the JSON with a key that lives only in the hardware
 * keystore (see secureKey.ts).
 *
 * We deliberately supply the key and a per-record random IV ourselves (both from
 * expo-crypto's CSPRNG) rather than relying on crypto-js's internal RNG, and we
 * store IV alongside the ciphertext so each record decrypts independently.
 */
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

import { getOrCreatePayloadKeyHex } from '@/services/secureKey';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Encrypts an object to a `base64(iv):base64(ciphertext)` string. */
export async function encryptJson(value: unknown): Promise<string> {
  const key = CryptoJS.enc.Hex.parse(await getOrCreatePayloadKeyHex());
  const iv = CryptoJS.enc.Hex.parse(bytesToHex(Crypto.getRandomBytes(16)));

  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return `${CryptoJS.enc.Base64.stringify(iv)}:${encrypted.ciphertext.toString(CryptoJS.enc.Base64)}`;
}

/** Reverses {@link encryptJson}. */
export async function decryptJson<T>(blob: string): Promise<T> {
  const key = CryptoJS.enc.Hex.parse(await getOrCreatePayloadKeyHex());
  const [ivB64, cipherB64] = blob.split(':');

  const iv = CryptoJS.enc.Base64.parse(ivB64);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(cipherB64),
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8)) as T;
}
