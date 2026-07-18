/**
 * Terms of Service and Privacy Policy.
 *
 * Single source of truth: these render inside the app AND are what you publish at
 * a public URL for store review. Keep them here so the two can never drift.
 *
 * ⚠️ THESE ARE DRAFTS. They are written specifically for what VeriSnap actually
 * does — location capture, immutable records, subscriptions — but they are not
 * legal advice. Have a lawyer review them before you publish, especially the
 * admissibility and liability sections, which are the ones that matter for a
 * product used in disputes.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: 'terms' | 'privacy';
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = 'privacy@verisnap.app';
const UPDATED = '18 July 2026';

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  updated: UPDATED,
  intro:
    'These terms govern your use of VeriSnap. By creating an account you agree to them. ' +
    'Please read the section on evidence and admissibility carefully — it describes what ' +
    'VeriSnap does and does not promise.',
  sections: [
    {
      heading: 'What VeriSnap does',
      paragraphs: [
        'VeriSnap captures photographs from your device camera, records the time and location ' +
          'of capture, computes a cryptographic fingerprint (SHA-256) of the file on your device ' +
          'before upload, and stores the file together with that fingerprint.',
        'Our server independently re-computes the fingerprint from the stored file and, when it ' +
          'matches, signs the record. This lets anyone holding our published public key confirm ' +
          'later that the stored file is byte-for-byte the file that was captured.',
      ],
    },
    {
      heading: 'What VeriSnap does not promise',
      paragraphs: [
        'VeriSnap does not guarantee that any record will be accepted as evidence by any court, ' +
          'tribunal, insurer, or other body. Admissibility depends on the law of your jurisdiction, ' +
          'the circumstances of the dispute, and decisions we do not control.',
        'VeriSnap proves that a stored file has not changed since it was captured, and records the ' +
          'time and place your device reported. It cannot prove that what appears in a photograph ' +
          'is true, that the scene was not staged, or that the device clock was correct. The time ' +
          'taken from your device is shown as such and is not independently verified.',
        'We do not provide legal advice. If a matter is important, consult a qualified lawyer.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'You are responsible for keeping your password secure and for activity under your account. ' +
          'You must be at least 16 years old to use VeriSnap.',
        'You may delete your account at any time from the Account screen. Deletion is permanent and ' +
          'removes every record you have filed.',
      ],
    },
    {
      heading: 'Records cannot be edited or individually deleted',
      paragraphs: [
        'Evidence records are append-only. Once filed, a record cannot be altered or removed on its ' +
          'own — not by you, and not by us through the app. This is deliberate: a vault whose ' +
          'contents can be quietly edited proves nothing.',
        'If you need everything removed, delete your account, which erases all of your records ' +
          'together. There is no partial deletion.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You must only capture material you are lawfully entitled to capture. Do not use VeriSnap ' +
          'to record people where they have a reasonable expectation of privacy, to harass anyone, ' +
          'or in any way that breaks the law where you are.',
        'You are responsible for complying with local rules on filming, recording, and data ' +
          'protection, including obtaining consent where it is required.',
        'We may suspend accounts used for unlawful purposes.',
      ],
    },
    {
      heading: 'Plans and payment',
      paragraphs: [
        'The free plan allows three captures per calendar month. Paid plans provide unlimited ' +
          'captures and additional features as described in the app.',
        'Subscriptions are billed through the Apple App Store or Google Play, and are managed and ' +
          'cancelled there — not by us. Payment is taken by the store, and their refund policies ' +
          'apply. A subscription renews until you cancel it.',
        'If a subscription lapses, your account reverts to the free plan. Records you have already ' +
          'filed remain in your account.',
      ],
    },
    {
      heading: 'Availability and liability',
      paragraphs: [
        'VeriSnap is provided as-is. We do not warrant uninterrupted availability, and we may change ' +
          'or discontinue features.',
        'To the extent permitted by law, our total liability to you is limited to the amount you ' +
          'paid us in the twelve months before the claim. Nothing in these terms limits liability ' +
          'that cannot be limited by law.',
        'You are strongly advised to keep your own copies of anything important. Use the certificate ' +
          'export to keep records outside VeriSnap.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'We may update these terms. Material changes will be notified in the app before they take ' +
          'effect. Continuing to use VeriSnap after that means you accept the new terms.',
        `Questions about these terms: ${CONTACT}`,
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  updated: UPDATED,
  intro:
    'This policy explains what VeriSnap collects, why, and what control you have. VeriSnap ' +
    'deliberately collects precise location and time, because those are what make a capture ' +
    'useful as evidence — so this policy is specific about it.',
  sections: [
    {
      heading: 'What we collect',
      paragraphs: [
        'Account: your email address and an encrypted password hash.',
        'Evidence: the photographs you capture, their cryptographic fingerprint, the precise GPS ' +
          'coordinates and accuracy at the moment of capture, the time reported by your device, the ' +
          'time our server received the upload, any EXIF metadata the camera provided, and a ' +
          'description of the device used (model, operating system, app version).',
        'Billing: if you subscribe, our payments provider RevenueCat records your subscription ' +
          'status. We never receive or store your card details — the app stores handle payment.',
        'We do not use advertising trackers, and we do not sell personal data.',
      ],
    },
    {
      heading: 'Why we collect it, and our legal basis',
      paragraphs: [
        'Location and time are collected to perform the service you asked for: binding a capture to ' +
          'a place and moment is the entire function of the product. Under the GDPR our basis is ' +
          'performance of a contract with you, and your device permission provides your consent to ' +
          'access location.',
        'Location is only read while the capture screen is open. VeriSnap never tracks you in the ' +
          'background.',
        'Your email is used for authentication, password recovery, and essential service notices.',
      ],
    },
    {
      heading: 'Who can see your evidence',
      paragraphs: [
        'Your records are private to your account. Access is enforced in the database with ' +
          'row-level security, and stored files live in a private bucket in a folder scoped to your ' +
          'user id. Files are served only through short-lived signed links.',
        'You can share a record deliberately by exporting a certificate. Anything you share is then ' +
          'outside our control.',
        'We use processors to run the service: Supabase (database, storage, authentication), Expo ' +
          '(app delivery), and RevenueCat (subscriptions). They process data on our instructions.',
        'We will disclose data if legally compelled to do so.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep your records for as long as your account exists, because an evidence vault that ' +
          'silently expires would be worthless.',
        'When you delete your account we remove your evidence records, your stored files, and your ' +
          'account, permanently.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You can access and export your data at any time using the certificate export in the app.',
        'You can correct your email, and you can erase everything by deleting your account from the ' +
          'Account screen.',
        'Individual records cannot be edited or deleted on their own. This is a deliberate integrity ' +
          'property, not a limitation of your rights: erasure is offered at the account level, which ' +
          'removes all of your data together.',
        'If you are in the EU or UK you may also complain to your local data protection authority.',
        `To exercise any right, or to ask a question: ${CONTACT}`,
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Data is encrypted in transit. Evidence awaiting upload is held in your app’s private ' +
          'storage with its metadata encrypted using a key held in your device’s secure hardware ' +
          '(iOS Keychain / Android Keystore).',
        'No system is perfectly secure. If a breach affects your data, we will notify you and the ' +
          'relevant authority as the law requires.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'VeriSnap is not intended for anyone under 16. If you believe a child has created an ' +
          `account, contact ${CONTACT} and we will remove it.`,
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocument['slug'], LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
};
