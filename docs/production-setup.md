# RoyalStory production setup

This guide contains operational steps only. Never place credentials, environment values, user records, or session tokens in GitHub, browser code, logs, screenshots, or chat messages.

## 1. Supabase authentication

In the intended Supabase project:

1. Enable Email/password authentication.
2. Require email confirmation for new accounts.
3. Configure a custom SMTP sender before inviting production users. Supabase's default email service is intended for development and has restrictive delivery limits.
4. Review production authentication rate limits.
5. Open **Authentication → URL Configuration**.
6. Set **Site URL** exactly to:

   `https://royalstory-sigma.vercel.app`

7. Add these exact entries to **Redirect URLs**:

   - `https://royalstory-sigma.vercel.app/api/auth/confirm`
   - `https://royalstory-sigma.vercel.app/api/auth/recover`

   Optional development and preview entries should be added separately. Never leave localhost as the production Site URL.

8. Open **Authentication → Email Templates → Reset Password**. The reset link must use `{{ .RedirectTo }}` rather than `{{ .SiteURL }}` so the `redirectTo` value supplied by RoyalStory is preserved. When editing a custom template, keep Supabase's required token or confirmation-link variables intact.
9. Apply the same `{{ .RedirectTo }}` check to the confirmation email template.

A password-reset email must ultimately send the browser to:

`https://royalstory-sigma.vercel.app/api/auth/recover?code=...`

The recovery callback exchanges the one-time Supabase code for a secure server-managed session and then redirects the browser to `/reset-password`. Do not add a browser Supabase client to handle this exchange.

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

`APP_ORIGIN` must be the final public HTTPS origin without an extra path. The current auth routes also derive redirects from the incoming HTTPS request so preview deployments do not fall back to localhost. The service-role key is server-only and must never use a `VITE_` prefix.

Vercel environment changes apply only to a new deployment. Redeploy after adding or changing any variable.

## 4. Deployment

Deploy the canonical `main` branch to the existing Vercel project. Confirm that the production deployment is linked to the expected commit SHA and reaches `Ready` status.

## 5. Production smoke test

Run this sequence against the public production origin:

1. Open the site in a clean browser session and confirm no game is visible before authentication.
2. Register a new email/password account.
3. Follow the confirmation email and verify that sign-in succeeds.
4. Reload the page and verify that the authenticated session and canonical save remain available.
5. Request a password reset. Before opening it, confirm the email link begins with `https://royalstory-sigma.vercel.app/api/auth/recover` and does not contain localhost. Follow the link, choose a new password, and verify that the recovery session is logged out afterward.
6. Sign in with the new password and verify the canonical save remains available.
7. Sign in from two browsers, make progress in one, then issue a command in the older browser and verify that the newer server state replaces it.
8. Leave the account inactive and verify offline XP, gold, and equipment on return. Confirm the calculation caps at eight hours and no more than 20 drops.
9. Verify that gold, level, equipment, and chapter progress survive reload and another device.
10. Open Reset progress, type exact uppercase `RESET`, continue to the separate final panel, and reset permanently.
11. Verify the account still exists but the canonical save is back at level 1 with initial gold, equipment, and chapter state.
12. Confirm Escape, backdrop click, Cancel, and Go back never reset progress.
13. Sign out and confirm the game disappears behind the authentication screen.

Record only pass/fail results and the public deployment URL. Never record credentials or private account data.

## 6. Failure checks

When a deployment fails, copy the first concrete TypeScript or runtime error above the final `ELIFECYCLE` summary. Do not diagnose from the exit-code summary alone.

For authentication failures, verify URL configuration, email-template use of `RedirectTo`, SMTP, environment scope, and a fresh deployment before changing application policy. For state conflicts, preserve server-wins behavior rather than accepting a stale client snapshot.
