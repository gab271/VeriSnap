/**
 * VeriSnap independent evidence verifier.
 *
 * This is the tool a court, insurer, or opposing expert runs to check a piece of
 * evidence WITHOUT trusting VeriSnap. It needs nothing but the file, the record's
 * public metadata, and the published public key.
 *
 *   node scripts/verify-evidence.mjs <evidence-file> <record.json> <public-key>
 *
 * e.g.
 *   node scripts/verify-evidence.mjs ./photo.jpg ./record.json ./keys/vs-2026-07-18-a1b2c3d4.pub
 *
 * <record.json> is the row from `evidence_records` (must include signed_payload,
 * signature and server_sha256_hash). <public-key> is a base64 SPKI key, either
 * inline or as a file path.
 *
 * It performs three independent checks:
 *   1. FILE INTEGRITY  — re-hash the file, compare to the server's recorded hash.
 *   2. PAYLOAD BINDING — the signed payload must reference that exact hash and
 *                        match the record's own fields (so the signature can't be
 *                        lifted from a different record).
 *   3. SIGNATURE       — ECDSA P-256 signature over the payload verifies against
 *                        the published public key.
 * All three must pass.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const [, , filePath, recordPath, keyArg] = process.argv;

if (!filePath || !recordPath || !keyArg) {
  console.error('Usage: node scripts/verify-evidence.mjs <evidence-file> <record.json> <public-key>');
  process.exit(2);
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalTimestamp(value) {
  return new Date(value).toISOString();
}

/** Rebuild the canonical payload from the record's own fields (see Edge Function). */
function buildExpectedPayload(record, serverHash) {
  const gps =
    record.gps_lat != null && record.gps_lng != null ? `${record.gps_lat},${record.gps_lng}` : 'none';
  return [
    'VeriSnap-v1',
    `id=${record.id}`,
    `user_id=${record.user_id}`,
    `sha256=${serverHash}`,
    `captured_at_utc=${canonicalTimestamp(record.captured_at_utc)}`,
    `server_received_at=${canonicalTimestamp(record.server_received_at)}`,
    `storage_path=${record.storage_path}`,
    `gps=${gps}`,
  ].join('\n');
}

const fileBytes = await readFile(filePath);
const record = JSON.parse(await readFile(recordPath, 'utf8'));
const publicKeyB64 = (existsSync(keyArg) ? await readFile(keyArg, 'utf8') : keyArg).trim();

let failures = 0;
const pass = (label, detail = '') => console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
const fail = (label, detail = '') => {
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log('\nVeriSnap evidence verification');
console.log('='.repeat(60));
console.log(`File   : ${filePath}`);
console.log(`Record : ${record.id}`);
console.log(`Key id : ${record.signing_key_id ?? '(none)'}`);
console.log('-'.repeat(60));

// --- Check 0: was it ever verified/signed by the server? --------------------
if (!record.hash_verified || !record.signature || !record.signed_payload) {
  console.log('  FAIL  Record was never server-verified (no signature present).');
  console.log('\nRESULT: NOT VERIFIABLE\n');
  process.exit(1);
}

// --- Check 1: file integrity -------------------------------------------------
const actualHash = bytesToHex(await crypto.subtle.digest('SHA-256', fileBytes));
if (actualHash === record.server_sha256_hash) {
  pass('File integrity', `SHA-256 ${actualHash.slice(0, 16)}…`);
} else {
  fail('File integrity', `file hashes to ${actualHash}, record says ${record.server_sha256_hash}`);
}

// --- Check 2: the signed payload is bound to THIS file and THIS record -------
const expectedPayload = buildExpectedPayload(record, actualHash);
if (record.signed_payload === expectedPayload) {
  pass('Payload binding', 'signed payload matches the record fields and file hash');
} else {
  fail('Payload binding', 'signed payload does not match the record/file');
  console.log('\n--- signed_payload on record ---\n' + record.signed_payload);
  console.log('\n--- rebuilt from record + file ---\n' + expectedPayload + '\n');
}

// --- Check 3: signature ------------------------------------------------------
const publicKey = await crypto.subtle.importKey(
  'spki',
  Buffer.from(publicKeyB64, 'base64'),
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['verify'],
);
const signatureValid = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  publicKey,
  Buffer.from(record.signature, 'base64'),
  new TextEncoder().encode(record.signed_payload),
);
if (signatureValid) {
  pass('Server signature', 'valid for the published public key');
} else {
  fail('Server signature', 'signature does not verify');
}

console.log('-'.repeat(60));
if (failures === 0) {
  console.log('\nRESULT: VERIFIED ✓');
  console.log('This file is byte-for-byte what VeriSnap recorded, and the server');
  console.log(`attested to it at ${record.verified_at}.\n`);
  process.exit(0);
} else {
  console.log(`\nRESULT: FAILED (${failures} check(s) failed) ✗\n`);
  process.exit(1);
}
