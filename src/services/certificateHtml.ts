/**
 * The evidence certificate, as a printable document.
 *
 * DESIGN NOTE: this inverts to ink-on-paper. The app is a cyanotype ground
 * because photographs read well on it, but a document that gets printed, faxed to
 * an insurer, or attached to a claim must be ink on white. What carries over is
 * the *structure* — the label/value rows, the mono data voice, the fingerprint
 * band — so a certificate is recognisably the same artefact as the record on
 * screen.
 *
 * HONESTY RULES BAKED IN:
 *  - The certificate never claims more than it can prove. Timestamps are labelled
 *    with whose clock they came from, and an unsealed record says so plainly
 *    instead of looking official.
 *  - It tells the reader to fetch the public key from the published registry, NOT
 *    from this document. A certificate that supplied its own verification key
 *    would be trivially forgeable, and that trap is worth naming out loud.
 *  - The footer states that this document *describes* evidence; the evidence is
 *    the original file.
 */
import type { EvidenceRecord } from '@/types/evidence';
import { formatCoords, formatStamp, groupHash } from '@/utils/format';
import { hashToBars } from '@/utils/fingerprint';
import { SEAL_COPY, type SealState } from '@/utils/seal';

/** Deeper than the screen palette — thin cyan does not survive printing. */
const PRINT = {
  ink: '#0A1826',
  paper: '#FFFFFF',
  muted: '#5A7385',
  rule: '#C9D6DE',
  sealed: '#0F6E7A',
  awaiting: '#9A6A12',
  broken: '#B23026',
};

const PRINT_RAMP = ['#C9D9E2', '#8FB0C2', '#3E7B94', '#0A1826'];

const TONE: Record<SealState, string> = {
  sealed: PRINT.sealed,
  awaiting: PRINT.awaiting,
  broken: PRINT.broken,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function band(hash: string | null): string {
  return hashToBars(hash)
    .map((bar) => {
      const color = bar.level < 0 ? PRINT.rule : PRINT_RAMP[bar.level];
      return `<i style="height:${bar.heightPct.toFixed(1)}%;background:${color}"></i>`;
    })
    .join('');
}

function hashGrid(hash: string | null): string {
  const groups = groupHash(hash);
  if (groups.length === 0) return '<span class="muted">Not available</span>';
  return groups.map((g) => `<code>${escapeHtml(g)}</code>`).join(' ');
}

function row(label: string, value: string, note?: string): string {
  return `
    <div class="row">
      <div class="row-label">${escapeHtml(label)}</div>
      <div class="row-value">
        <div>${escapeHtml(value)}</div>
        ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}
      </div>
    </div>`;
}

interface CertificateInput {
  record: EvidenceRecord;
  sealState: SealState;
  /** data: URI of the photograph, embedded so the PDF is self-contained. */
  imageDataUri: string | null;
  generatedAt: string;
}

export function buildCertificateHtml({
  record,
  sealState,
  imageDataUri,
  generatedAt,
}: CertificateInput): string {
  const tone = TONE[sealState];
  const sealLabel = SEAL_COPY[sealState].label.toUpperCase();
  const device = record.deviceInfo;
  const deviceLine = device
    ? `${device.modelName ?? device.brand ?? 'Unknown device'} · ${device.osName ?? ''} ${device.osVersion ?? ''}`.trim()
    : 'Not recorded';

  const verificationSection =
    sealState === 'sealed'
      ? `
      <ol>
        <li>Obtain the original file. It is supplied alongside this certificate, not inside it.</li>
        <li>Re-hash it and compare with the SHA-256 above:
          <div class="cmd">sha256sum &lt;file&gt;</div>
          <div class="cmd">certutil -hashfile &lt;file&gt; SHA256</div>
        </li>
        <li>Verify the signature below over the signed payload, using VeriSnap's published
            public key for key id <code>${escapeHtml(record.signingKeyId ?? 'unknown')}</code>.
            <strong>Obtain that key from VeriSnap's published key registry — never from this
            document.</strong> A certificate that supplied its own key would prove nothing.</li>
        <li>All three must pass. If any fails, treat this record as unverified.</li>
      </ol>`
      : sealState === 'broken'
        ? `<p class="alert">The file held in storage does not match the fingerprint taken at
           capture. This record must not be relied upon. Both hashes are printed above so the
           divergence can be examined.</p>`
        : `<p class="alert">This record has not yet been countersigned by the server, so its
           contents cannot be independently verified from this document alone.</p>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: ${PRINT.ink};
    background: ${PRINT.paper};
    font-family: 'IBM Plex Sans Condensed', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  code, .mono, .cmd, pre { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .masthead { display: flex; justify-content: space-between; align-items: baseline; }
  .wordmark { font-weight: 700; letter-spacing: 2px; font-size: 13px; }
  .doctype { letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px; color: ${PRINT.muted}; }
  .rule { height: 2px; background: ${PRINT.ink}; margin: 6px 0 16px; }
  h2 {
    font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase;
    color: ${PRINT.muted}; margin: 0 0 8px; font-weight: 600;
  }
  section { margin-bottom: 20px; page-break-inside: avoid; }
  .seal {
    border: 1.5px solid ${tone}; padding: 10px 12px; display: flex;
    align-items: baseline; gap: 12px; flex-wrap: wrap;
  }
  .seal-state { color: ${tone}; font-weight: 700; letter-spacing: 2px; font-size: 13px; }
  .seal-note { color: ${PRINT.ink}; flex: 1; min-width: 200px; }
  .seal-meta { color: ${PRINT.muted}; font-size: 11px; }
  figure { margin: 0 0 20px; }
  figure img { width: 100%; max-height: 320px; object-fit: contain; border: 1px solid ${PRINT.rule}; }
  .band { display: flex; align-items: flex-end; gap: 2px; height: 46px; margin-bottom: 8px; }
  .band i { flex: 1; display: block; }
  .hash code { font-size: 12px; letter-spacing: 0.5px; }
  .row { display: flex; gap: 14px; padding: 4px 0; border-bottom: 1px solid ${PRINT.rule}; }
  .row:last-child { border-bottom: 0; }
  .row-label {
    width: 96px; flex: none; font-size: 10px; letter-spacing: 1.4px;
    text-transform: uppercase; color: ${PRINT.muted}; padding-top: 2px;
  }
  .row-value { flex: 1; font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace; font-size: 11.5px; }
  .note { color: ${PRINT.muted}; font-size: 10px; font-family: inherit; }
  .muted { color: ${PRINT.muted}; }
  .wrap { word-break: break-all; font-size: 10.5px; }
  ol { margin: 0; padding-left: 18px; }
  ol li { margin-bottom: 6px; }
  .cmd {
    background: #F2F6F8; border: 1px solid ${PRINT.rule}; padding: 3px 6px;
    margin: 4px 0; font-size: 10.5px;
  }
  .alert { color: ${tone}; border-left: 3px solid ${tone}; padding-left: 10px; margin: 0; }
  pre {
    background: #F2F6F8; border: 1px solid ${PRINT.rule}; padding: 8px;
    font-size: 10px; white-space: pre-wrap; word-break: break-all; margin: 0;
  }
  footer {
    margin-top: 24px; padding-top: 8px; border-top: 1px solid ${PRINT.rule};
    color: ${PRINT.muted}; font-size: 10px;
  }
</style>
</head>
<body>
  <div class="masthead">
    <div class="wordmark">VERISNAP</div>
    <div class="doctype">Evidence certificate</div>
  </div>
  <div class="rule"></div>

  <section class="seal">
    <div class="seal-state">${escapeHtml(sealLabel)}</div>
    <div class="seal-note">${escapeHtml(SEAL_COPY[sealState].note)}</div>
    ${
      record.verifiedAt
        ? `<div class="seal-meta">Sealed ${escapeHtml(formatStamp(record.verifiedAt))}${
            record.signingKeyId ? ` · key ${escapeHtml(record.signingKeyId)}` : ''
          }</div>`
        : ''
    }
  </section>

  ${
    imageDataUri
      ? `<figure><img src="${imageDataUri}" alt="Captured evidence" /></figure>`
      : `<section><p class="muted">The photograph could not be embedded in this certificate.</p></section>`
  }

  <section>
    <h2>Fingerprint</h2>
    <div class="band">${band(record.serverSha256Hash ?? record.sha256Hash)}</div>
    ${
      sealState === 'broken'
        ? `<div class="hash"><div class="note">At capture</div>${hashGrid(record.sha256Hash)}</div>
           <div class="hash" style="margin-top:8px"><div class="note">In storage now</div>${hashGrid(record.serverSha256Hash)}</div>`
        : `<div class="hash">${hashGrid(record.serverSha256Hash ?? record.sha256Hash)}</div>`
    }
  </section>

  <section>
    <h2>Record</h2>
    ${row('Captured', formatStamp(record.capturedAtUtc), 'Device clock — not independently trusted')}
    ${row('Recorded', formatStamp(record.serverReceivedAt), 'Server clock — trusted timestamp')}
    ${row('Location', formatCoords(record.gpsLat, record.gpsLng, record.gpsAccuracyM), record.locationCapturedAt ? `Fix at ${formatStamp(record.locationCapturedAt)}` : undefined)}
    ${row('Device', deviceLine, device && !device.isPhysicalDevice ? 'Captured on a simulator' : undefined)}
    ${record.category ? row('Category', record.category) : ''}
    ${row('Record', record.id)}
    ${row('Storage', record.storagePath)}
  </section>

  <section>
    <h2>How to verify this independently</h2>
    ${verificationSection}
  </section>

  ${
    record.signature
      ? `<section>
           <h2>Signature (ECDSA P-256)</h2>
           <div class="mono wrap">${escapeHtml(record.signature)}</div>
         </section>
         <section>
           <h2>Signed payload (verbatim)</h2>
           <pre>${escapeHtml(record.signedPayload ?? '')}</pre>
         </section>`
      : ''
  }

  <footer>
    Generated ${escapeHtml(formatStamp(generatedAt))}. This certificate <em>describes</em> a piece
    of evidence; the evidence itself is the original file. Verify the file, not this document.
  </footer>
</body>
</html>`;
}
