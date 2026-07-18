/**
 * On-device hashing engine — the integrity core of the chain of custody.
 *
 * SECURITY DECISION 1 — hash the RAW FILE BYTES (not a base64 string):
 * We read the exact bytes on disk with `File.bytes()` and hash those. The
 * resulting hex digest is byte-for-byte identical to what any standard tool
 * (`sha256sum`, `openssl dgst -sha256`, `certutil -hashfile`) produces for the
 * same file. That means a third party — a court, an insurer, an opposing
 * lawyer — can independently re-hash the stored file and confirm it was never
 * altered. Hashing the base64 *text* instead would yield a non-standard digest
 * nobody could reproduce, which would defeat the entire point.
 *
 * SECURITY DECISION 2 — hash BEFORE upload, using NATIVE crypto:
 * The digest is computed on the device before the file ever leaves it, so it
 * fingerprints the original capture rather than any server-side re-encoding. We
 * use `expo-crypto`'s native `digest()` (backed by the platform crypto library)
 * for correctness and speed over multi-megabyte images.
 */
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

/** Lowercase hex encoding of a digest buffer, matching `sha256sum` output. */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compute the SHA-256 (hex) of the file at `uri` over its raw bytes.
 * @throws if the file cannot be read.
 */
export async function hashFileSha256(uri: string): Promise<string> {
  const file = new File(uri);
  // `bytes()` (not `arrayBuffer()`): despite its `BufferSource` type, native
  // `digest()` rejects a bare ArrayBuffer and requires an actual TypedArray.
  const bytes = await file.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return bufferToHex(digest);
}
