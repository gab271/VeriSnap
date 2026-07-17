/**
 * Offline queue — the "basement / mountain with no signal" fallback.
 *
 * When a capture can't reach the server, we persist it locally and upload it
 * automatically once connectivity returns (see sync.ts). Two things are stored:
 *   1. The image file, COPIED into the document directory. Captures live in the
 *      cache directory, which the OS may purge under storage pressure; the
 *      document directory is durable, so the evidence survives until uploaded.
 *   2. The metadata payload, ENCRYPTED (see crypto.ts) in a SQLite row. The DB
 *      file itself is app-sandboxed, and encrypting on top means the sensitive
 *      fields (GPS, device, timestamps) are protected even at rest.
 *
 * `row_inserted` distinguishes two retry cases: an item still needing its DB row
 * inserted, versus one whose row already exists and only needs the file uploaded
 * (which happens if the network dropped between insert and upload). This keeps
 * retries idempotent — we never double-insert a record.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { decryptJson, encryptJson } from '@/services/crypto';
import type { EvidenceInsert } from '@/types/evidence';

// Resolve the durable directory lazily. Constructing a Directory touches native
// filesystem APIs, so doing it at module scope would run during import on every
// platform — and crashes on web, where these paths are stubbed. Deferring it means
// merely importing this module (e.g. from the store) is always side-effect free.
let pendingDir: Directory | null = null;
function getPendingDir(): Directory {
  if (!pendingDir) {
    pendingDir = new Directory(Paths.document, 'pending_evidence');
  }
  return pendingDir;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('verisnap.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS pending_evidence (
          id                TEXT PRIMARY KEY NOT NULL,
          local_uri         TEXT NOT NULL,
          content_type      TEXT NOT NULL,
          row_inserted      INTEGER NOT NULL DEFAULT 0,
          encrypted_payload TEXT NOT NULL,
          attempts          INTEGER NOT NULL DEFAULT 0,
          last_error        TEXT,
          created_at        TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export interface PendingItem {
  id: string;
  localUri: string;
  contentType: string;
  rowInserted: boolean;
  insert: EvidenceInsert;
  attempts: number;
}

interface EnqueueParams {
  insert: EvidenceInsert;
  /** Source file (usually the cache-dir capture) to copy into durable storage. */
  sourceUri: string;
  contentType: string;
  /** True if the DB row already exists and only the upload is pending. */
  rowInserted: boolean;
}

export async function enqueueEvidence({
  insert,
  sourceUri,
  contentType,
  rowInserted,
}: EnqueueParams): Promise<void> {
  const pending = getPendingDir();
  if (!pending.exists) pending.create({ intermediates: true });

  // Copy the capture into durable storage (idempotent — skip if already there).
  const destination = new File(pending, `${insert.id}.jpg`);
  if (!destination.exists) {
    await new File(sourceUri).copy(destination);
  }

  const encryptedPayload = await encryptJson(insert);
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO pending_evidence
       (id, local_uri, content_type, row_inserted, encrypted_payload, attempts, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
    insert.id,
    destination.uri,
    contentType,
    rowInserted ? 1 : 0,
    encryptedPayload,
    new Date().toISOString(),
  );
}

interface PendingRow {
  id: string;
  local_uri: string;
  content_type: string;
  row_inserted: number;
  encrypted_payload: string;
  attempts: number;
}

export async function listPending(): Promise<PendingItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingRow>(
    `SELECT id, local_uri, content_type, row_inserted, encrypted_payload, attempts
       FROM pending_evidence ORDER BY created_at ASC`,
  );

  const items: PendingItem[] = [];
  for (const row of rows) {
    items.push({
      id: row.id,
      localUri: row.local_uri,
      contentType: row.content_type,
      rowInserted: row.row_inserted === 1,
      attempts: row.attempts,
      insert: await decryptJson<EvidenceInsert>(row.encrypted_payload),
    });
  }
  return items;
}

export async function markRowInserted(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE pending_evidence SET row_inserted = 1 WHERE id = ?`, id);
}

export async function recordAttempt(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_evidence SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
    error,
    id,
  );
}

export async function removePending(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM pending_evidence WHERE id = ?`, id);

  const file = new File(getPendingDir(), `${id}.jpg`);
  if (file.exists) file.delete();
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pending_evidence`,
  );
  return row?.count ?? 0;
}
