# Character Creation Name Design

## Goal

Require every authenticated RoyalStory account to create a character name before entering the game, without changing gameplay or existing progression.

## Scope

The first character-creation release contains exactly one choice: the character name.

The name must:

- contain 3–16 characters
- contain only letters and digits
- be globally unique across all accounts
- be compared case-insensitively for uniqueness
- preserve the player's chosen capitalization for display

There is no class choice, appearance choice, forbidden-word list, confirmation screen, or name-changing feature in this release.

## Entry flow

The authentication shell continues to load the authenticated player's save as it does today. It also loads the player's character profile.

The resulting UI state is:

1. No authenticated session: show the existing sign-in, sign-up, or password-recovery interface.
2. Authenticated session with no character profile: show character creation.
3. Authenticated session with a character profile: show the game immediately.

Both new accounts and existing accounts without a profile must complete character creation. Existing save progression remains untouched while character creation blocks access to the game UI.

After successful profile creation, the application transitions directly into the game without an intermediate confirmation screen.

## Data model

Store profile data separately from versioned gameplay state in a new Supabase table:

```sql
public.player_profiles
```

The table contains:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `character_name text not null`
- `normalized_name text not null unique`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`character_name` preserves the display form selected by the player. `normalized_name` is the lowercase form used for uniqueness, so names such as `Haval`, `haval`, and `HAVAL` conflict.

Database constraints enforce the final invariants, including length, allowed characters, and uniqueness. Client and server validation provide faster and clearer feedback but are not the source of truth.

## Security and ownership

Enable row-level security on `player_profiles`.

Authenticated players may read only their own profile. Profile creation must bind the row to the authenticated user's ID and must not allow one player to create or replace another player's profile.

Profile creation is one-time in this release. The public client API exposes no update or delete operation. The schema keeps `updated_at` so a later, separately designed name-change feature can be added without restructuring profile storage.

## Server boundary

Add a focused profile API rather than extending gameplay commands or embedding profile fields in `PlayerSaveState`.

The API supports:

- loading the current authenticated user's profile
- creating the current authenticated user's profile

Creation returns explicit outcomes suitable for the UI:

- created successfully
- name already taken
- invalid name
- unauthorized session
- service unavailable

The server normalizes and validates the submitted name before inserting. A unique database constraint resolves races where two clients attempt to claim the same normalized name concurrently.

## Client components and state

`AuthRoot` remains the top-level coordinator for session-gated views. It owns the loaded player record and loaded profile state.

Add a focused character-creation component, for example:

```text
src/components/CharacterCreation.tsx
```

The component receives submission state and a creation callback through props. It does not access Supabase, gameplay controllers, or the player-save API directly.

The screen contains:

- RoyalStory branding consistent with the existing auth shell
- a clear character-name heading and brief instruction
- one text input with a 16-character maximum
- one primary creation button
- inline validation and server error feedback
- the existing sign-out option so a player is not trapped in the flow

Submitting is disabled while a request is in progress. Invalid local input is rejected without a network request. A taken name keeps the entered value so the player can edit it.

## Validation behavior

The canonical rule is equivalent to:

```text
^[A-Za-z0-9]{3,16}$
```

Leading or trailing whitespace is not silently accepted as part of a valid name. The UI may trim accidental outer whitespace before validating and submitting, but spaces within a name remain invalid.

Error messages distinguish at least:

- too short or too long
- unsupported characters
- name already taken
- session expired
- temporary service failure

No availability check runs on every keystroke. Availability is decided on submission to avoid additional race-prone requests.

## Existing-account migration behavior

No profile rows are automatically generated for existing users.

On their next authenticated load, existing users with a save but no profile are routed to character creation. Their `player_states` row and all existing progression remain unchanged. Once profile creation succeeds, the already loaded save is used to enter the game normally.

Offline progression synchronization should not be applied repeatedly while the player remains on the character-creation screen. The implementation should preserve the existing load/sync semantics and avoid creating duplicate offline-reward presentation when profile creation completes.

## Error handling

If profile loading fails temporarily, do not assume the profile is missing and do not show character creation. Show a retryable account-loading error instead.

If the session expires during profile creation, return to the existing signed-out state with a clear message.

If database uniqueness rejects the insert, map that failure to the user-facing “name already taken” result rather than a generic service error.

All other unexpected backend failures produce a generic retryable error without modifying the player save.

## Testing

Follow strict RED → GREEN → verification with small commits.

Add focused tests proving:

1. A signed-out visitor still sees the existing authentication flow.
2. An authenticated user with a profile enters the game directly.
3. An authenticated user without a profile sees character creation instead of the game.
4. Existing progression remains loaded and unchanged while character creation is required.
5. Names shorter than 3 or longer than 16 characters are rejected.
6. Names containing spaces, punctuation, or other unsupported characters are rejected.
7. Valid letter-and-digit names are submitted.
8. Case-insensitive duplicates are reported as taken.
9. Successful creation transitions directly into the game.
10. A temporary profile-load failure is not treated as a missing profile.
11. Session expiry returns the user to sign-in.
12. Repeated submission is prevented while creation is pending.
13. The database migration enforces ownership, validation, and normalized-name uniqueness.
14. Existing auth, player-save, reset-progress, offline-return, Phaser lifecycle, and gameplay tests remain unchanged and passing.

Verification includes focused tests, the full test suite, typecheck, production build, and deployment verification.

## Constraints

- Do not modify gameplay rules, combat timing, campaign progression, equipment behavior, save versions, or existing player progression.
- Do not place character profile fields inside `PlayerSaveState`.
- Do not automatically assign temporary names.
- Do not add profanity filtering in this release.
- Do not add name changing in this release.
- Do not add class or appearance selection.
- Do not perform broad rewrites of `AuthRoot` or the player-save service.
- Database uniqueness remains the final authority for global name ownership.
