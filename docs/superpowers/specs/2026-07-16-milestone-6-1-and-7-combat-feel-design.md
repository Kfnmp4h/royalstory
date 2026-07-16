# RoyalStory Milestone 6.1 and 7 Design

## Scope

This document defines two consecutive releases:

1. **Milestone 6.1 — Production cleanup**
2. **Milestone 7 — Pixel-art combat feel**

Milestone 6.1 must finish and pass verification before Milestone 7 gameplay work begins.

## Milestone 6.1 — Production cleanup

### Goals

- Remove temporary password-recovery diagnostics.
- Keep the permanent `/reset-password` SPA rewrite.
- Preserve all working authentication, Resend, Supabase, Vercel-domain, and cloud-save behavior.
- Verify the production deployment before starting Milestone 7.

### Changes

- Remove the temporary `password-reset redirect diagnostic` logging from the password-reset request route.
- Remove other temporary auth troubleshooting logs or comments introduced during Milestone 6.
- Retain the Vercel rewrite that serves `/reset-password` through `index.html`.
- Check production-facing docs for obsolete localhost instructions or temporary troubleshooting steps.
- Do not change the Supabase schema, RLS policies, CAS save RPC, SMTP configuration, or redirect architecture unless a test exposes a defect.

### Verification

Automated checks:

- Unit tests pass.
- Typecheck passes.
- Production build passes.

Production smoke checks:

- Account creation and email confirmation.
- Sign in and sign out.
- Password-reset email delivery and full password update flow.
- Authenticated save/load.
- Offline reward restoration.
- `/api/player` remains unauthorized without a session.

## Milestone 7 — Pixel-art combat feel

### Product goal

Make each combat exchange readable, responsive, and rewarding while keeping combat simulation deterministic and separate from presentation.

The visual direction is original RoyalStory pixel art with energetic timing inspired by classic side-scrolling RPGs, without copying protected game assets.

### Included features

- Pixel-art slash animations.
- Pixel-art impact animations.
- Dedicated critical-hit effect.
- Enemy death animation.
- Floating damage numbers for normal hits, critical hits, and misses.
- Smooth delayed HP-bar response.
- Light camera shake for strong impacts.
- Small death-particle burst.

### Asset strategy

Milestone 7 uses project-owned placeholder pixel-art sprite sheets sized and timed like production assets. These placeholders must be replaceable through asset configuration without changing combat logic.

Required effect families:

- `slash-basic`
- `impact-basic`
- `impact-critical`
- `enemy-death`
- `death-particles`

Each sprite sheet has explicit frame dimensions, frame count, frame rate, origin, scale, and playback key in one asset manifest.

### Architecture

#### Combat domain

The existing combat simulation remains authoritative. It emits presentation events only after combat outcomes are resolved.

Presentation events:

- `attack_started`
- `hit_landed`
- `critical_hit_landed`
- `attack_missed`
- `health_changed`
- `enemy_defeated`

Events contain stable data such as actor ID, target ID, damage, critical flag, resulting health, and simulation timestamp. Visual systems must never alter damage, timing, drops, progression, or save state.

#### Combat presentation controller

A dedicated presentation controller consumes combat events and coordinates:

- sprite animation playback,
- hit flashes,
- floating text,
- HP-bar tween targets,
- camera shake,
- death sequencing.

The controller owns short-lived visual state and cleans it up when effects complete.

#### Asset manifest

A single typed manifest maps effect keys to sprite-sheet metadata. Phaser loading and animation creation are generated from this manifest to avoid duplicated frame definitions.

#### Damage numbers

Damage numbers use pooled display objects to avoid continuous allocations. They rise, ease out, fade, and return to the pool. Critical numbers use a distinct scale and animation treatment; misses show `MISS`.

#### HP bars

HP bars have two layers:

- immediate current-health layer,
- delayed damage layer that eases toward the new value.

This is presentation only. The numeric health value is always sourced from combat state.

#### Death sequence

When an enemy is defeated:

1. The final impact effect plays.
2. The enemy enters a non-interactive death state.
3. The death sprite animation and particles play.
4. The visual enemy is removed.
5. Existing progression and reward flow continues unchanged.

### Timing targets

- Attack anticipation: brief and readable.
- Impact effect begins on the authoritative hit event.
- Normal hit camera shake: none or nearly imperceptible.
- Critical hit camera shake: short and restrained.
- Damage number lifetime: under one second.
- Death sequence: fast enough not to slow idle progression.

Exact timings will be centralized as presentation constants and tuned during QA.

### Error handling and degradation

- Missing optional effect assets must fall back to a simple flash and damage number rather than stop combat.
- Asset loading failures are reported once with the missing effect key.
- Presentation-event consumers ignore events for entities that no longer exist.
- Reduced-motion support disables camera shake and lowers movement intensity while retaining readable feedback.

### Testing

Unit tests:

- Combat results produce the correct presentation-event types.
- Critical and miss events select the correct effect keys.
- HP-bar interpolation never exceeds valid bounds.
- Damage-number pooling reuses and releases objects.
- Death events cannot trigger duplicate removal.

Integration tests:

- Normal hit sequence.
- Critical-hit sequence.
- Miss sequence.
- Enemy defeat sequence.
- Rapid attacks do not leak visual objects.
- Effects do not change deterministic combat results.

Manual QA:

- Effects align visually with hit timing.
- Damage numbers remain readable at common resolutions.
- Camera shake is comfortable.
- Idle progression speed is unchanged.
- Desktop production build remains stable during extended combat.

## Delivery order

### 6.1

1. Remove diagnostics.
2. Run tests, typecheck, and build.
3. Deploy and smoke-test production.

### 7.1 — Foundation

1. Presentation-event contract.
2. Typed asset manifest.
3. Effect loading and animation registration.
4. Slash, impact, and enemy-death playback.

### 7.2 — Feedback systems

1. Floating damage numbers.
2. Critical and miss treatments.
3. HP-bar interpolation.
4. Camera shake.
5. Death particles.

### 7.3 — Tuning and release verification

1. Timing and scale tuning.
2. Reduced-motion behavior.
3. Leak and long-session testing.
4. Production deployment and smoke test.

## Acceptance criteria

Milestone 6.1 is accepted when diagnostics are removed and all automated and production smoke checks pass.

Milestone 7 is accepted when normal hits, critical hits, misses, health changes, and enemy defeats each have distinct, synchronized pixel-art feedback; presentation does not affect combat outcomes; tests and production build pass; and extended combat shows no persistent visual-object growth.
