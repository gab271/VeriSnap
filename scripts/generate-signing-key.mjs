/**
 * Generates the ECDSA P-256 keypair used to sign verified evidence records.
 *
 *   node scripts/generate-signing-key.mjs
 *
 * WHY ECDSA P-256 (ES256): it is supported natively by Web Crypto everywhere —
 * the Deno runtime the Edge Function runs on, Node, browsers, and OpenSSL — so a
 * third party can verify a VeriSnap signature in any language without exotic
 * dependencies.
 *
 * SECURITY:
 *  - The PRIVATE key must ONLY ever live in the Supabase Edge Function secrets.
 *    Never commit it, never ship it in the app.
 *  - The PUBLIC key is meant to be published (commit it, put it on your website).
 *    It is what lets courts/insurers verify evidence independently, forever.
 *  - Rotating keys: generate a new pair with a NEW key id. Old records stay
 *    verifiable because each record stores the `signing_key_id` that signed it.
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const privateB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const publicB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const keyId = `vs-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;

console.log('='.repeat(78));
console.log('VeriSnap evidence signing keypair (ECDSA P-256)');
console.log('='.repeat(78));
console.log();
console.log('KEY ID:');
console.log(keyId);
console.log();
console.log('--- 1. SET THESE AS SUPABASE SECRETS (private key — keep secret!) ---');
console.log();
console.log(`npx supabase secrets set EVIDENCE_SIGNING_PRIVATE_KEY="${privateB64}"`);
console.log(`npx supabase secrets set EVIDENCE_SIGNING_KEY_ID="${keyId}"`);
console.log();
console.log('--- 2. PUBLISH THIS PUBLIC KEY (safe to commit / share) ---');
console.log();
console.log(`${keyId}:${publicB64}`);
console.log();
console.log('Save it to keys/<key-id>.pub so verifiers can find it, e.g.:');
console.log(`  mkdir -p keys && echo "${publicB64}" > keys/${keyId}.pub`);
console.log();
console.log('='.repeat(78));
