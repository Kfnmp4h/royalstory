# Royal Story — Milestone 6: Production backend design

## Purpose

Milestone 6 moves Royal Story from a client-only game to a deployable production service with real accounts, server-authoritative progress, safe offline rewards, and an irreversible-progress reset flow. The existing Vercel project is the production host and Supabase is the identity and database provider.

## Product requirements

- A first-time visitor sees registration and login rather than a demo character.
- Accounts use email and password, including email verification and password reset.
- An authenticated user remains signed in after a reload through a secure auth session. Game state is never stored in browser persistence, including cookies, localStorage, sessionStorage, IndexedDB, or filesystem storage.
- The server is the canonical source of truth. When the same account is used on multiple devices, the latest server version wins; a stale client must reload rather than overwrite newer data.
- Offline progress grants gold, XP, and equipment drops for at most eight elapsed hours and at most 20 equipment drops. Returned equipment is added directly to inventory and shown on a return screen.
- Saved gold is visible in the interface before spending is introduced.
- Reset keeps the account but clears progression, gold, and equipment. It requires the exact text `RESET` plus a separate, explicit final confirmation action.
- Supabase and Vercel secrets never enter Git, client bundles, logs, or source files.

## Architecture

The React/Phaser application remains a presentation and input layer. It calls versioned Vercel API endpoints over HTTPS. Vercel owns the authenticated session boundary, validates every command, applies gameplay rules using shared pure server modules, and persists the result in Supabase Postgres.

The browser never receives a Supabase service credential and never writes database rows directly. It holds only an HttpOnly, Secure, SameSite authentication-session cookie; it contains no game state. All game state is loaded from the API after authentication and remains in memory only while the page is open.

Supabase Auth provides email/password registration, verification, sign-in, sign-out, and password-reset flows. Production email delivery uses a customer-configured SMTP provider in Supabase. Supabase's default mail service is not used for production traffic.

Supabase Postgres stores one canonical player record per account. Row-level security restricts a user-owned record to its authenticated owner. Vercel holds the privileged server integration credentials as encrypted environment variables and uses them only in server functions.

## Saved state and concurrency

The canonical player record contains:

- account identifier;
- schema version for future migrations;
- monotonically increasing save version;
- last authoritative server timestamp;
- campaign, progression, combat, gold, and equipment state;
- the timestamp through which offline rewards have already been settled.

The server accepts commands, not arbitrary snapshots. Examples are campaign advancement, entering a battle, claiming a resolved reward, equipping an item, and reset. Each mutating request includes the save version held by the client. The database update succeeds only when that version still matches; success increments the version atomically. A mismatch returns the current canonical state with a stale-state response, and the client replaces its in-memory state before enabling another action.

The browser fetches the canonical state on sign-in, page load, focus restoration, and any stale-state response. It never retries a rejected mutation against a newer version automatically; it first renders the refreshed state so the player sees what changed.

## Offline rewards

When an authenticated state is loaded, the server calculates eligible elapsed time from server timestamps, clamps it to eight hours, and settles rewards exactly once by advancing the saved settlement timestamp in the same versioned write. It uses the player’s valid current farming context, the existing reward tables, and the existing equipment generator.

The settlement adds gold and XP to saved state, creates no more than 20 valid equipment drops, and inserts those drops into inventory. The API returns a structured offline-return result alongside the fresh player state. The client displays a dedicated return screen before normal play resumes. Reloading after settlement does not duplicate rewards.

## API boundary

The initial API surface is intentionally small:

- `POST /api/auth/sign-up`, `sign-in`, `sign-out`, `request-password-reset`, and `reset-password` manage account flows.
- `GET /api/player` returns the authenticated canonical state and, if applicable, a one-time offline-return result.
- `POST /api/player/commands` accepts a typed, validated game command plus expected save version and returns the resulting state or stale-state response.
- `POST /api/player/reset` accepts the expected version, `RESET` acknowledgement, and a distinct final-confirmation flag. It creates a fresh initial player state for the existing account through the same versioned persistence path.

Every endpoint returns generic authentication errors that do not reveal whether an email address exists. Requests are validated before gameplay logic or persistence. Server errors leave the previous saved state intact and return a recoverable message; the client can reload canonical state.

## Client experience

The app starts with a clear sign-up/sign-in screen. While an authenticated state is loading or synchronizing, action controls are disabled and a visible status explains that saved progress is being loaded. The game header always displays authoritative gold.

On an offline return, a modal-like return screen summarizes elapsed time, gold, XP, and each awarded equipment item. Closing it acknowledges presentation only; it does not create a second persistence write.

Settings include a destructive reset area. The final reset button remains disabled until the player has typed exactly `RESET`. Activating it opens a separate final confirmation step that states the consequence. Only that final explicit confirmation calls the reset endpoint.

## Database and migration strategy

All schema changes are represented by ordered SQL migration files committed to the repository. They create the player-state table, constraints, indexes, row-level security, update function or guarded update path, and any required server-side timestamps. No generated credentials, project identifiers intended to remain private, or live data are committed.

The saved state carries its own schema version. Server load and command code migrate recognized older saved documents to the current shape before use and persist the upgraded version through the guarded write. Unknown future schema versions fail safely without overwriting data.

## Configuration and production deployment

The repository contains an `.env.example` listing variable names only. Local development can use an untracked `.env.local`; it is configuration, not a game save. Production values are added in the Supabase and Vercel dashboards, not in chat or Git.

Vercel receives the Supabase project URL, server-only service credentials, session-cookie signing or encryption material where required by the chosen auth library, and public application origin as encrypted environment variables. Browser bundles receive none of those values. Supabase is configured with the deployed Vercel origin and password-reset/verification redirect URLs. The production SMTP provider is configured in Supabase before real users are invited.

After migrations and environment configuration are in place, the existing Vercel project is deployed from `main`. A production smoke test covers registration, verification, sign-in, reload persistence, two-device stale-state handling, offline reward settlement, reset confirmation, password reset, and a direct check that no game state appears in browser storage.

## Testing and acceptance evidence

Implementation adds focused tests for saved-state serialization and restoration, version conflicts, offline caps and idempotency, reset safeguards, command validation, and UI handling of loading, offline return, and stale-state recovery. Existing gameplay tests must continue to pass. Type checking and a production build must pass before publishing.

The final verification includes a source scan for browser game-state persistence and repository secret patterns, database migration review, API tests with mocked Supabase boundaries, and a manual production smoke test after the user configures Vercel and Supabase.

## Non-goals

This milestone does not add purchases, social features, a new spending system, analytics, admin tooling, or a separate game server. It creates the reliable production foundation required for later milestones.
