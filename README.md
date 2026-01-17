# EduLink Writers

A web platform connecting students and writers worldwide for high-quality assignments.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Database, Storage)
- M-Pesa (Kenya) and M-Pesa Global (International) integrations (stubbed)

## Features
- Roles: Student, Writer, Admin
- Admin approves registrations
- Student wallet top-up (M-Pesa or card via Global)
- Assignment uploads to Supabase Storage
- Writer subscriptions: Basic ($5, 5/day), Standard ($10, 15/day), Premium ($20, unlimited)

## Setup

1. Create a Supabase project and get URL and anon key.
2. Copy `.env.local.example` to `.env.local` and fill values:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_PATH=/api/payments/webhook
MPESA_GLOBAL_API_KEY=...
MPESA_GLOBAL_MERCHANT_ID=...
MPESA_GLOBAL_ENV=sandbox
```
3. Apply SQL schema in `supabase/schema.sql` via Supabase SQL editor.
4. Create a Storage bucket named `assignments` and configure RLS policies per your org.

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Auth & Roles
- Register at `/register` with role (student or writer). Admin users can be created manually by setting `role='admin'` and `approval_status='approved'` in `profiles`.
- Admin approves users at `/admin/dashboard`.

## Payments (Stubs)
- API routes exist for `M-Pesa` and `M-Pesa Global` top-ups but use development stubs by default. Replace with real integrations:
	- `src/app/api/payments/mpesa/topup/route.ts`
	- `src/app/api/payments/mpesa-global/topup/route.ts`
	- `src/app/api/payments/webhook/route.ts`

## Subscriptions
- Writers choose a plan from `/writer/dashboard`. Currently simulated as instant activation; wire to your payment gateway as needed.

## File Uploads
- Students upload assignment files; stored under `assignments/{userId}/{uuid-filename}`.

## Notes
- Enforce task-per-day limits through queries against `tasks` and active subscriptions.
- Harden RLS policies and webhook signature verification for production.
