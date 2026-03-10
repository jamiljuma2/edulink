# EduLink Writers

A web platform connecting students and writers worldwide for secure, high-quality assignments with role-based workflows, approvals, and payments.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Firebase (Auth)
- External PostgreSQL
- Lipana STK Push (Kenya) + PayPal (Global)

## Features
- Roles: Student, Writer, Admin with server-side guards
- Admin approvals for new users
- Student wallet top-up via Lipana (Kenya) and PayPal (Global)
- Assignment uploads (Cloudflare R2)
- Writer subscriptions with task limits
- Writer task acceptance and submissions flow
- Admin review/approve submissions
- Writer withdrawal requests and admin approval
- Dashboards for student, writer, and admin
- About, Contact, Privacy pages

## Setup

1. Create a Firebase project (Auth) and a PostgreSQL database.
2. Create `.env.local` in the project root with the following values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
R2_ACCOUNT_ID=...
R2_ENDPOINT=... # optional; defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
DATABASE_URL=postgres://<user>:<password>@<host>/<db>?sslmode=require
NEXT_PUBLIC_BASE_URL=http://localhost:3000
LIPANA_SECRET_KEY=...
LIPANA_WEBHOOK_SECRET=...
PAYPAL_ENV=production
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```
3. Apply the SQL schema in `db/schema.sql` to your PostgreSQL database.
4. Ensure Cloudflare R2 bucket and API credentials are configured.

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

## Cloudflare R2 Uploads
- Students upload assignment files under `assignments/{userId}/{uuid-filename}`.
- Writers upload submission files under `submissions/{writerId}/{taskId}/{uuid-filename}`.
- Admin download links are generated as short-lived signed URLs.

### R2 CORS Setup

Direct browser uploads to signed R2 URLs require bucket CORS rules.

1. Open Cloudflare Dashboard -> `R2` -> bucket -> `Settings` -> `CORS policy`.
2. Add a policy like this (adjust origins for your environments):

```json
[
	{
		"AllowedOrigins": [
			"https://www.edulinkwriters.com",
			"https://edulinkwriters.com",
			"http://localhost:3000"
		],
		"AllowedMethods": ["GET", "PUT", "HEAD"],
		"AllowedHeaders": ["*"],
		"ExposeHeaders": ["ETag"],
		"MaxAgeSeconds": 3600
	}
]
```

If uploads fail with browser preflight/CORS errors, verify `PUT` is allowed and origin matches exactly.

## Auth & Roles
- Register at `/register` with role (student or writer). Admin users can be created by setting `role='admin'` and `approval_status='approved'` in `profiles`.
- Admin approves users at `/admin/dashboard`.

## Payments
- Lipana STK Push: `src/app/api/payments/mpesa/topup/route.ts`
- PayPal checkout (global): `src/app/api/payments/mpesa-global/topup/route.ts`
- Webhook: `src/app/api/payments/webhook/route.ts` (activates topups and subscriptions)

## Subscriptions
- Writers choose a plan from `/writer/dashboard`. Subscription activation occurs on webhook for Lipana transactions.

## Notes
- Enforce task-per-day limits through queries against `tasks` and active subscriptions.
- Harden RLS policies and webhook signature verification for production.

## DB Linkage Repair (Neon)
If assignment counts stay at zero after successful posting, run `db/fix_user_linkage.sql` in Neon (replace `OLD_UID` and `NEW_UID` first) to remap records from legacy user ids to the correct Firebase UID.

## Migration Checklist
- [ ] Apply the schema from `db/schema.sql` to Postgres.
- [ ] Set `DATABASE_URL` and Firebase env vars in `.env.local`.
- [ ] Configure Firebase Auth sign-in methods and create admin service account keys.
- [ ] Verify uploads and signed URLs for `assignments/` and `submissions/`.
