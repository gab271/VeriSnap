# VeriSnap — Monetization setup

How the free/Premium/Pro plans actually work, and what you must do to turn real
payments on.

## Before you start: what this costs

Real in-app purchases are not free to set up. You need:

| Requirement | Cost |
|---|---|
| Apple Developer Program (to sell on iOS) | **€99 / year** |
| Google Play Developer account (to sell on Android) | **€25 once** |
| RevenueCat | Free below ~$2.5k monthly tracked revenue |
| Expo EAS builds | Free tier available (queued), paid for faster builds |

**Until you have those, nothing here is blocked.** The app runs today in Expo Go
with billing disabled: the paywall appears at the free limit and explains that
purchases need the full build. Everything below is only needed when you want to
actually charge.

## How entitlement works

```
   App                RevenueCat            Supabase                Postgres
   ───                ──────────            ────────                ────────
   purchase  ───────▶  validates
                       receipt
                          │
                          ▼  webhook (shared secret)
                    revenuecat-webhook  ──▶  profiles.is_premium
                                             profiles.premium_expires_at
                                                        │
   capture   ─────────────────────────────────────────▶ trigger checks it
                                                        and allows / refuses
```

**The client never decides whether it is premium.** The app's own view of the plan
is used only to render UI. The free-tier limit is enforced by a Postgres trigger
reading `profiles.is_premium`, and that column is writable only by the webhook
holding the `service_role` key. A tampered app can claim anything and still be
refused by the database.

Subscriptions expire, so the trigger also checks `premium_expires_at` — a lapsed
plan falls back to the free limit automatically, with no cleanup job.

## Setup

### 1. Apply the migration
Run [`supabase/migrations/0003_entitlements.sql`](supabase/migrations/0003_entitlements.sql)
in the SQL editor. It adds `premium_expires_at`, `revenuecat_user_id`, `plan`, and
teaches the free-tier trigger about expiry.

### 2. Create products in the stores
- **App Store Connect** → Subscriptions → create `premium_monthly` and `pro_monthly`.
- **Google Play Console** → Monetize → Subscriptions → the same two ids.

### 3. Configure RevenueCat
1. Create a project; add your iOS and Android apps.
2. Create an **entitlement** with the identifier **`premium`** (both paid tiers grant it).
3. Create **packages** with identifiers **`premium_monthly`** and **`pro_monthly`**,
   attached to the store products, and add them to the **current offering**.
   > These identifiers must match `PACKAGE_BY_TIER` in
   > [`src/services/purchaseService.ts`](src/services/purchaseService.ts).
4. Copy the **public SDK keys** into `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxx
   ```

### 4. Deploy the webhook
```bash
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET="<a long random string>"
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```
`--no-verify-jwt` is required: RevenueCat authenticates with the shared secret, not
a Supabase user JWT.

Then in RevenueCat → **Integrations → Webhooks**:
- URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
- Authorization header: the same value you set as `REVENUECAT_WEBHOOK_SECRET`

### 5. Make a development build
RevenueCat is a native module, so it cannot run in Expo Go.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android   # or ios
```
Install the resulting build on your device, then run `npx expo start --dev-client`.

> The bundle identifier is currently **`com.gab271.verisnap`** (in `app.json`).
> Change it before your first store submission if you want something else — after
> publishing it is permanent.

## Testing purchases
- **iOS:** create a Sandbox tester in App Store Connect, sign in under
  Settings → App Store → Sandbox Account.
- **Android:** add licence testers in Play Console and use an internal testing track.
- RevenueCat's dashboard shows every event, which is the fastest way to see whether
  the webhook fired and what it sent.

## Store requirements already handled
- **Restore purchases** — required by Apple for any app selling content; it is in
  the paywall.
- **User cancellation** is treated as a normal outcome, not an error.
- Prices are shown before purchase, and the plan's contents are described.

Still required before submission (see the roadmap): a **privacy policy**, **terms
of service**, and an **account deletion** path.
