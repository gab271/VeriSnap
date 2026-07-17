# VeriSnap — Setup (Milestone 1)

Tamper-evident evidence capture. Built with Expo (React Native + TypeScript),
Supabase, and Zustand. This milestone delivers the environment, the secure
Supabase connection, and email/password auth. The Secure Camera capture flow is
the next milestone.

## 1. Prerequisites
- Node.js 20+ (you have v24)
- The **Expo Go** app on a physical iOS/Android device (this phase targets Expo Go)

## 2. Configure Supabase
1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the **Project URL** and the **anon /
   public** key.
3. Copy `.env.example` to `.env` and paste those two values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-SUPABASE-ANON-KEY
   ```
   > Only the **anon** key goes here. Never put the `service_role` key in the app —
   > it bypasses Row Level Security.
4. In the Supabase Dashboard → **SQL Editor**, paste and run the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This
   creates the `evidence_records` table, the `evidence` storage bucket, all RLS
   policies, and the server-side free-tier limit (3 captures / month).
5. (Optional) Under **Authentication → Providers → Email**, decide whether to
   require email confirmation. With it on, new sign-ups must confirm via email
   before they can sign in.

## 3. Run the app
```bash
npm install     # already done during scaffolding
npx expo start
```
Scan the QR code with Expo Go. You should land on the **Sign in** screen; create
an account, and you'll be routed to the authenticated home placeholder.

## Project structure
```
src/
  app/            expo-router routes (auth-gated): _layout, sign-in, index
  screens/        screen components (SignInScreen, …)
  components/     reusable UI (themed-text, themed-view, …)
  services/       supabase client (more services next milestone)
  store/          Zustand stores (authStore)
  types/          shared types (evidence)
  utils/          constants
supabase/
  migrations/     0001_init.sql — schema + RLS + storage + free-tier gate
```

## Security decisions baked in so far
- **Anon key only** in the client; all access governed by RLS.
- **Append-only, immutable** evidence: no UPDATE/DELETE policies on the table or
  storage objects.
- **Trusted timestamp** (`server_received_at`) written by Postgres, separate from
  the untrusted device clock.
- **Server-enforced** free-tier limit — the app cannot bypass it.
- Camera/location permission strings explain the evidence rationale to the user
  and to app-store reviewers.
