/**
 * The fingerprint band, as data.
 *
 * Deliberately medium-agnostic: this returns bar heights and a magnitude level,
 * never colours. The screen renders the band light-on-ink; the printed
 * certificate renders it ink-on-paper. Both must produce the *same shape* from
 * the same hash, because the shape is what a person compares — so the geometry
 * lives here, once, and each medium supplies only its own palette.
 */
export const FINGERPRINT_BAR_COUNT = 32;

export interface FingerprintBar {
  /** 18–100. Derived from the byte, with a floor so every bar stays visible. */
  heightPct: number;
  /** Magnitude bucket 0–3, or -1 when there is no hash to render. */
  level: number;
}

export function hashToBars(
  hash: string | null,
  count: number = FINGERPRINT_BAR_COUNT,
): FingerprintBar[] {
  // No hash yet renders as a flat, inert baseline — never a plausible-looking
  // pattern, which would imply an identity this record does not have.
  if (!hash || hash.length < count * 2) {
    return Array.from({ length: count }, () => ({ heightPct: 12, level: -1 }));
  }

  const bars: FingerprintBar[] = [];
  for (let i = 0; i < count; i += 1) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    const safeByte = Number.isNaN(byte) ? 0 : byte;
    bars.push({
      heightPct: 18 + (safeByte / 255) * 82,
      level: Math.min(3, Math.floor(safeByte / 64)),
    });
  }
  return bars;
}
