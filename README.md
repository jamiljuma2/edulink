# EduLink Writers

A web platform connecting students and writers worldwide for secure, high-quality assignments with role-based workflows, approvals, and payments.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Firebase (Auth, Storage)
- External PostgreSQL
- Lipana STK Push (Kenya) + PayPal (Global)

## Features
- Roles: Student, Writer, Admin with server-side guards
- Admin approvals for new users
- Student wallet top-up via Lipana (Kenya) and PayPal (Global)
- Assignment uploads (Firebase Storage)
- Writer subscriptions with task limits
- Writer task acceptance and submissions flow
- Admin review/approve submissions
- Writer withdrawal requests and admin approval
- Dashboards for student, writer, and admin
- About, Contact, Privacy pages

## Setup

1. Create a Firebase project (Auth + Storage) and a PostgreSQL database.
2. Create `.env.local` in the project root with the following values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_STORAGE_BUCKET=...
DATABASE_URL=postgres://<user>:<password>@<host>/<db>?sslmode=require
NEXT_PUBLIC_BASE_URL=http://localhost:3000
LIPANA_SECRET_KEY=...
LIPANA_WEBHOOK_SECRET=...
PAYPAL_ENV=production
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```
3. Apply the SQL schema in `db/schema.sql` to your PostgreSQL database.
4. Deploy Firebase Storage rules from `firebase.storage.rules`.
5. Create Firebase Storage folders `assignments/` and `submissions/` (they are created on first upload).

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Android App Packaging (TWA)

This project includes Trusted Web Activity packaging helpers in `twa/`.

1. Deploy your app over HTTPS.
2. Build APK/AAB:

```powershell
./twa/build-twa.ps1 -ManifestUrl "https://your-domain.com/manifest.webmanifest" -ApplicationId "com.edulinkwriters.twa"
```

3. Configure Digital Asset Links env vars in production:

```env
TWA_PACKAGE_NAME=com.edulinkwriters.twa
TWA_SHA256_CERT_FINGERPRINTS=12:34:...,AB:CD:...
```

The app exposes `/.well-known/assetlinks.json` using those values.

## Firebase Storage Rules
Deploy storage rules after updating `firebase.storage.rules`:

```bash
firebase deploy --only storage
```

## Auth & Roles
- Register at `/register` with role (student or writer). Admin users can be created by setting `role='admin'` and `approval_status='approved'` in `profiles`.
- Admin approves users at `/admin/dashboard`.

## Payments
- Lipana STK Push: `src/app/api/payments/mpesa/topup/route.ts`
- PayPal checkout (global): `src/app/api/payments/mpesa-global/topup/route.ts`
- Webhook: `src/app/api/payments/webhook/route.ts` (activates topups and subscriptions)

## Subscriptions
- Writers choose a plan from `/writer/dashboard`. Subscription activation occurs on webhook for Lipana transactions.

## File Uploads
- Students upload assignment files under `assignments/{userId}/{uuid-filename}`.
- Writers upload submission files under `submissions/{writerId}/{taskId}/{uuid-filename}`.

## Notes
- Enforce task-per-day limits through queries against `tasks` and active subscriptions.
- Harden RLS policies and webhook signature verification for production.

## Migration Checklist
- [ ] Apply the schema from `db/schema.sql` to Postgres.
- [ ] Set `DATABASE_URL` and Firebase env vars in `.env.local`.
- [ ] Configure Firebase Auth sign-in methods and create admin service account keys.
- [ ] Deploy Firebase Storage rules from `firebase.storage.rules`.
- [ ] Verify uploads and signed URLs for `assignments/` and `submissions/`.
