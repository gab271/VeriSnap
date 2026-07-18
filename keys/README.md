# Evidence signing public keys

Each `.pub` file is the **public half** of a keypair used by the `verify-evidence`
Edge Function to sign verified evidence records. They are base64 SPKI (ECDSA P-256).

## These are meant to be public
Publishing them is the whole point: they are what lets a court, insurer, or
opposing expert verify a VeriSnap record independently, without trusting us.
Commit them, put them on your website — the more reachable, the better.

## Never delete an old key
Every record stores the `signing_key_id` that signed it. If you rotate keys, the
**old public key must stay here forever**, or every piece of evidence signed with
it becomes unverifiable. Keys are additive — never removed.

## Never put a private key in this folder
Private keys live only in the Supabase Edge Function secrets
(`EVIDENCE_SIGNING_PRIVATE_KEY`). If a private key is ever exposed, rotate it:
generate a new pair, update the secrets, and add the new public key here. Records
signed by the old key stay valid and verifiable.

## Verifying with one of these
```bash
node scripts/verify-evidence.mjs <evidence-file> <record.json> keys/<key-id>.pub
```

See [../VERIFICATION.md](../VERIFICATION.md) for the full procedure.
