/**
 * Producing and sharing an evidence certificate.
 *
 * The photograph is downloaded and embedded as a data URI rather than linked, so
 * the PDF is self-contained: it still shows the image months later, offline, on a
 * machine that has never heard of VeriSnap. A certificate that depended on a
 * live signed URL would quietly become blank when the link expired — exactly the
 * wrong failure mode for a legal document.
 *
 * Sharing the certificate does NOT share the original file. That separation is
 * deliberate and stated in the document: the certificate describes the evidence,
 * and verification is performed against the original.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  copyAsync,
  downloadAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';

import { buildCertificateHtml } from '@/services/certificateHtml';
import { getSignedUrl } from '@/services/evidenceQueries';
import type { EvidenceRecord } from '@/types/evidence';
import { sealStateOf } from '@/utils/seal';

export type ExportOutcome =
  | { status: 'shared' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

/**
 * Fetch the stored photograph and inline it. Returns null on any failure — a
 * certificate without the image is still useful (the hash and signature are the
 * parts that carry proof), so this must never abort the export.
 */
async function embedPhotograph(record: EvidenceRecord): Promise<string | null> {
  try {
    const signedUrl = await getSignedUrl(record.storagePath);
    if (!signedUrl || !cacheDirectory) return null;

    const target = `${cacheDirectory}certificate-source-${record.id}.jpg`;
    const download = await downloadAsync(signedUrl, target);
    if (download.status !== 200) return null;

    const base64 = await readAsStringAsync(download.uri, { encoding: 'base64' });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

export async function exportCertificate(record: EvidenceRecord): Promise<ExportOutcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return {
        status: 'unavailable',
        message: 'Sharing is not available on this device.',
      };
    }

    const html = buildCertificateHtml({
      record,
      sealState: sealStateOf(record),
      imageDataUri: await embedPhotograph(record),
      generatedAt: new Date().toISOString(),
    });

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // printToFileAsync names the file randomly; give it a name the recipient can
    // recognise in an inbox or a case folder.
    let shareUri = uri;
    if (cacheDirectory) {
      const named = `${cacheDirectory}VeriSnap-certificate-${record.id.slice(0, 8)}.pdf`;
      try {
        await copyAsync({ from: uri, to: named });
        shareUri = named;
      } catch {
        // Keep the generated name rather than failing the export.
      }
    }

    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share evidence certificate',
    });

    return { status: 'shared' };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
