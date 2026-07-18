# VeriSnap — Evidence Verification

This document explains how VeriSnap makes a photo verifiable, and how **anyone**
— a court, an insurer, an opposing expert — can confirm a piece of evidence
independently, without trusting VeriSnap.

## The trust chain

| Step | Where | What it proves |
|---|---|---|
| 1. SHA-256 computed over the raw file bytes | On the device, **before** upload | Fingerprints the original capture |
| 2. File uploaded to private storage | Client → Supabase | — |
| 3. **Server re-hashes the stored bytes** | `verify-evidence` Edge Function | The stored file is byte-identical to what was captured |
| 4. **Server signs the record** (ECDSA P-256) | Edge Function, private key never leaves the server | The record is un-forged and attributable |

Step 3 is the crucial one. A hash supplied by a client proves nothing — a
tampered app could send any value. Only an *independent* re-hash is meaningful.

## What's protected

- Clients **cannot** mark their own evidence as verified: a `BEFORE INSERT`
  trigger blanks every verification column on the way in.
- Clients **cannot** modify records at all: `evidence_records` has no UPDATE or
  DELETE policy, so RLS denies both. Only the `service_role` key — used solely by
  the Edge Function — can write the verification columns.
- A hash **mismatch is recorded, not hidden**: the record is flagged
  `hash_verified = false` with the server's own hash stored, which is itself
  evidence that something changed.

## Verifying a piece of evidence (third party)

You need three things:
1. the **file**,
2. the **record** (the `evidence_records` row, as JSON), and
3. the **published public key**.

```bash
node scripts/verify-evidence.mjs ./photo.jpg ./record.json ./keys/<key-id>.pub
```

The verifier runs three independent checks, **all** of which must pass:

1. **File integrity** — re-hashes the file; must equal `server_sha256_hash`.
2. **Payload binding** — rebuilds the canonical payload from the record's own
   fields and the file's hash; must equal the stored `signed_payload`. This stops
   a valid signature being lifted onto a different file or altered metadata.
3. **Server signature** — the ECDSA P-256 signature must verify against the
   public key.

Example output:

```
  PASS  File integrity — SHA-256 3bd8b32d2afaa4cd…
  PASS  Payload binding — signed payload matches the record fields and file hash
  PASS  Server signature — valid for the published public key

RESULT: VERIFIED ✓
```

### Tamper detection (tested)

| Attack | Detected by |
|---|---|
| One byte of the photo altered | File integrity + payload binding |
| GPS coordinates changed in the record | Payload binding |
| `signed_payload` rewritten to claim another hash | Payload binding + signature |

## The signed payload format

The exact bytes signed are a deterministic, line-oriented string (also stored
verbatim on the record as `signed_payload`, so nobody has to guess):

```
VeriSnap-v1
id=<uuid>
user_id=<uuid>
sha256=<server-computed hex>
captured_at_utc=<ISO-8601 UTC, milliseconds>
server_received_at=<ISO-8601 UTC, milliseconds>
storage_path=<bucket path>
gps=<lat>,<lng>            # or "none"
```

Timestamps are normalised with `new Date(x).toISOString()` so they reproduce
byte-for-byte. Signature: **ECDSA P-256 / SHA-256**, raw IEEE-P1363 (`r||s`)
encoding, base64. (In Node's `crypto.verify`, that is `dsaEncoding: 'ieee-p1363'`;
with Web Crypto it is the default.)

## Setup (one time)

```bash
# 1. Generate the signing keypair
node scripts/generate-signing-key.mjs

# 2. Set the PRIVATE key as a function secret (never commit it)
npx supabase secrets set EVIDENCE_SIGNING_PRIVATE_KEY="<base64 pkcs8>"
npx supabase secrets set EVIDENCE_SIGNING_KEY_ID="<key id>"

# 3. Publish the PUBLIC key so evidence stays verifiable forever
mkdir -p keys && echo "<base64 spki>" > keys/<key-id>.pub

# 4. Apply the migration and deploy the function
npx supabase link --project-ref <your-project-ref>
npx supabase db push                       # or paste 0002_verification.sql in the SQL editor
npx supabase functions deploy verify-evidence
```

### Key rotation
Generate a new keypair with a new key id and update the secrets. Existing records
stay verifiable because each one stores the `signing_key_id` that signed it —
keep every public key you have ever published.

## Known limitations (roadmap)

- **Capture time is still the device clock.** `server_received_at` is trusted but
  is *upload* time, not capture time. A trusted timestamp (RFC-3161) or a
  transparency-log anchor would close this gap.
- **GPS can be spoofed** on a rooted/jailbroken device. Mock-location detection is
  not yet implemented.
- **No hash chain between records yet**, so the *set* of evidence isn't
  tamper-evident as a whole (individual records are).
