# EduLink Writers

A web platform connecting students and writers worldwide for secure, high-quality assignments with role-based workflows, approvals, and payments.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Database, Storage)
- Lipana STK Push (Kenya) + PayPal (Global)

## Features
- Roles: Student, Writer, Admin with server-side guards
- Admin approvals for new users
- Student wallet top-up via Lipana (Kenya) and PayPal (Global)
- Assignment uploads (Supabase Storage)
- Writer subscriptions with task limits
- Writer task acceptance and submissions flow
- Admin review/approve submissions
- Writer withdrawal requests and admin approval
- Dashboards for student, writer, and admin
- About, Contact, Privacy pages

## Setup

1. Create a Supabase project and get URL and anon key.
2. Create `.env.local` in the project root with the following values:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
LIPANA_SECRET_KEY=...
LIPANA_WEBHOOK_SECRET=...
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```
3. Apply SQL schema in `supabase/schema.sql` via Supabase SQL editor.
4. Create Storage buckets named `assignments` and `submissions` and apply the storage policies in the schema.

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

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
- Writers upload submission files under `submissions/{writerId}/{uuid-filename}`.

## Notes
- Enforce task-per-day limits through queries against `tasks` and active subscriptions.
- Harden RLS policies and webhook signature verification for production.
