/**
 * Formatting for the record. Everything is rendered in UTC, never local time —
 * a piece of evidence has one true timestamp, and showing it shifted by the
 * reader's timezone would be actively misleading in a dispute.
 */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `18 JUL 2026 · 09:15:22Z` */
export function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];
  const time = date.toISOString().slice(11, 19);
  return `${day} ${month} ${date.getUTCFullYear()} · ${time}Z`;
}

/** `18 JUL · 09:15Z` — the compact form used in the log. */
export function formatStampShort(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];
  return `${day} ${month} · ${date.toISOString().slice(11, 16)}Z`;
}

export function formatCoords(lat: number | null, lng: number | null, accuracy: number | null): string {
  if (lat == null || lng == null) return 'No GPS fix';
  const base = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return accuracy != null ? `${base}  ±${Math.round(accuracy)} m` : base;
}

/** Hex in groups of eight — the way fingerprints are read aloud and compared. */
export function groupHash(hash: string | null, perGroup = 8): string[] {
  if (!hash) return [];
  const groups: string[] = [];
  for (let i = 0; i < hash.length; i += perGroup) groups.push(hash.slice(i, i + perGroup));
  return groups;
}
