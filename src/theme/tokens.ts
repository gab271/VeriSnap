/**
 * VeriSnap design tokens — "cyanotype forensic log".
 *
 * DIRECTION: cyanotype is the original photographic printing process and the
 * visual language of documents-of-record (blueprints, archival plans). Prints are
 * pale marks on deep Prussian blue, which is exactly the right ground for an
 * evidence vault: photographs read well on it, and it feels archival rather than
 * app-like. Everything is matte and flat — no gradients, no glows. This is a
 * filing system, not a dashboard; that restraint is what keeps it from drifting
 * into generic dark-mode-with-an-accent.
 *
 * TYPE: one superfamily used in two sharply different registers, so the product
 * reads as a single instrument rather than a mashup of fonts.
 *   - Mono (IBM Plex Mono) is the MACHINE voice: hashes, coordinates, timestamps,
 *     identifiers. It dominates, because evidence is fundamentally data.
 *   - Condensed sans (IBM Plex Sans Condensed) is the HUMAN voice: labels and
 *     headings. Condensed type is the vernacular of official forms and the paper
 *     tag tied to a physical exhibit.
 */

export const palette = {
  /** Cyanotype ground — deep Prussian, never pure black. */
  ink: '#0A1826',
  /** Raised surfaces: rows, cards, wells. */
  inkRaised: '#102636',
  /** Hairlines and dividers — the ruled lines of a register. */
  rule: '#1D3A4F',
  /** Primary text: the pale highlight of a cyanotype print. */
  chalk: '#E6EFF4',
  /** Secondary text and labels. */
  mist: '#7DA2B8',
  /** The accent — developing chemistry / UV inspection light. */
  cyan: '#4FD1E3',
  /** Awaiting seal. */
  amber: '#E9A23B',
  /** Seal broken — tampering or corruption. */
  vermilion: '#E2564A',
} as const;

/**
 * Translucent surfaces. Kept as tokens so chrome over the camera reads
 * identically everywhere — these are ink at low opacity, never neutral black, so
 * the overlay stays part of the same world as the rest of the app.
 */
export const scrim = {
  /** Controls laid over the live camera feed. */
  chrome: 'rgba(10,24,38,0.66)',
  /** Behind a modal sheet. */
  backdrop: 'rgba(4,10,17,0.82)',
} as const;

export const font = {
  /** Machine voice — hashes, coordinates, timestamps, ids. */
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
  /** Human voice — labels, headings, actions. */
  sans: 'IBMPlexSansCondensed_400Regular',
  sansSemi: 'IBMPlexSansCondensed_600SemiBold',
  sansBold: 'IBMPlexSansCondensed_700Bold',
} as const;

/**
 * Type scale. Labels are set in small caps-style tracking — the register of a
 * form field, not a heading.
 */
export const type = {
  display: { fontFamily: font.sansBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.2 },
  title: { fontFamily: font.sansSemi, fontSize: 20, lineHeight: 24 },
  /** Field labels: uppercase, tracked out, quiet. */
  label: { fontFamily: font.sansSemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 21 },
  /** Data values — always mono so columns align and hex is unambiguous. */
  data: { fontFamily: font.monoMedium, fontSize: 13, lineHeight: 18 },
  dataSmall: { fontFamily: font.mono, fontSize: 11, lineHeight: 15 },
  hash: { fontFamily: font.monoSemi, fontSize: 13, lineHeight: 20, letterSpacing: 0.6 },
} as const;

/** 4pt base. Generous vertical rhythm — an archive breathes. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
} as const;

export const radius = {
  /** Deliberately small: documents have corners, not pills. */
  sm: 2,
  md: 4,
} as const;
