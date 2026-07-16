# RoyalStory production setup

This guide contains operational steps only. Never place credentials, environment values, user records, or session tokens in GitHub, browser code, logs, screenshots, or chat messages.

## 1. Supabase authentication

In the intended Supabase project:

1. Enable Email/password authentication.
2. Require email confirmation for new accounts.
3. Configure a custom SMTP sender before inviting production users. Supabase's default email service is intended for development and has restrictive delivery limits.
4. Review production authentication rate limits.
5. In Auth URL Configuration, set the final Vercel HTTPS origin as the Site URL.
6. Add these redirect destinations using the same production origin:
   - `/api/auth/confirm`
   - `/reset-password`

## 2. Database migrations

Apply every committed SQL file under `supabase/migrations` to the intended project in filename order.

Use either:

- an authenticated Supabase CLI session linked to the intended project, or
- the Supabase SQL editor.

Confirm that the player-state table, row-level security policies, and compare-and-swap RPC exist after migration. Do not weaken RLS to solve application errors.

## 3. Vercel production environment

Add the four variable names listed in `.env.example` to the Production environment of the existing Vercel project:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ORIGIN`

`APP_ORIGIN` must be the final public HTTPS origin without an extra path. The service-role key is server-only and must never use a `VITE_` prefix.

Vercel environment changes apply only to a new deployment. Redeploy after adding or changing any variable.

## 4. Deployment

Deploy the canonical `main` branch to the existing Vercel project. Confirm that the production deployment is linked to the expected commit SHA and reaches `Ready` status.

## 5. Production smoke test

Run this sequence against the public production origin:

1. Open the site in a clean browser session and confirm no game is visible before authentication.
2. Register a new email/password account.
3. Follow the confirmation email and verify that sign-in succeeds.
4. Reload the page and verify that the authenticated session and canonical save remain available.
5. Request a password reset and verify delivery through the custom SMTP sender.
6. Sign in from two browsers, make progress in one, then issue a command in the older browser and verify that the newer server state replaces it.
7. Leave the account inactive and verify offline XP, gold, and equipment on return. Confirm the calculation caps at eight hours and no more than 20 drops.
8. Verify that gold, level, equipment, and chapter progress survive reload and another device.
9. Open Reset progress, type exact uppercase `RESET`, continue to the separate final panel, and reset permanently.
10. Verify the account still exists but the canonical save is back at level 1 with initial gold, equipment, and chapter state.
11. Confirm Escape, backdrop click, Cancel, and Go back never reset progress.
12. Sign out and confirm the game disappears behind the authentication screen.

Record only pass/fail results and the public deployment URL. Never record credentials or private account data.

## 6. Failure checks

When a deployment fails, copy the first concrete TypeScript or runtime error above the final `ELIFECYCLE` summary. Do not diagnose from the exit-code summary alone.

For authentication failures, verify URL configuration, SMTP, environment scope, and a fresh deployment before changing application policy. For state conflicts, preserve server-wins behavior rather than accepting a stale client snapshot.
