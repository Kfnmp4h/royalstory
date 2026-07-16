# RoyalStory Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current account screen with a responsive royal throne-room login experience while preserving the existing Supabase sign-in, sign-up, password-reset, and recovery flows.

**Architecture:** Keep authentication state and Supabase calls inside `AuthRoot`, but extract the unauthenticated presentation into focused components. Build the scene from layered CSS/SVG assets so the background, braziers, fire, glow, particles, logo, and form can animate independently. Desktop receives the full scene; narrow screens hide nonessential layers and reduce motion.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Supabase JS, CSS animations, Vitest, Testing Library.

## Global Constraints

- Preserve all existing `authApi` and `playerApi` behavior.
- Support sign in, create account, forgot password, and reset-password recovery.
- Use separate visual layers rather than one flattened background image.
- Desktop uses the full throne-room composition; mobile uses a simplified responsive composition.
- The login panel uses a light ivory/stone surface against a dark purple-and-gold environment.
- Intro sequence duration should be about two seconds and must not block form interaction after completion.
- Respect `prefers-reduced-motion` by disabling decorative motion and shortening transitions.
- Keep all controls keyboard accessible with visible focus states and at least 44px touch targets.
- Do not add a guest-login flow.
- Do not change signed-in game UI beyond imports needed for the new auth presentation.

---

## File Structure

- Create `src/auth/RoyalAuthScene.tsx` — layered throne-room shell and decorative scene.
- Create `src/auth/RoyalAuthForm.tsx` — sign-in, sign-up, forgot-password, and recovery forms.
- Create `src/auth/RoyalStoryLogo.tsx` — accessible text/SVG logo independent from scene layers.
- Create `src/auth/authTypes.ts` — shared auth mode and form-state types.
- Create `src/auth/royal-auth.css` — all auth-only layout, responsive, and animation styles.
- Create `src/auth/RoyalAuthForm.test.tsx` — form behavior and accessibility tests.
- Create `src/AuthRoot.test.tsx` — integration tests for mode switching and API orchestration.
- Modify `src/AuthRoot.tsx` — delegate unauthenticated rendering to the new components.
- Modify `src/main.tsx` — import the auth stylesheet.
- Modify `src/styles.css` — remove or isolate obsolete auth selectors only if they exist; preserve game styles.

---

### Task 1: Define auth presentation interfaces

**Files:**
- Create: `src/auth/authTypes.ts`
- Test: `src/auth/RoyalAuthForm.test.tsx`

**Interfaces:**
- Produces: `AuthMode = 'sign-in' | 'sign-up' | 'forgot'`
- Produces: `RoyalAuthFormProps` with controlled values, busy/message state, mode callbacks, and submit callbacks.

- [ ] **Step 1: Write the failing type-driven component test scaffold**

Create `src/auth/RoyalAuthForm.test.tsx` importing `RoyalAuthForm` and rendering it with a complete `RoyalAuthFormProps` object. Assert that sign-in mode exposes email, password, submit, create-account, and forgot-password controls.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run src/auth/RoyalAuthForm.test.tsx`

Expected: FAIL because `RoyalAuthForm` and the shared types do not exist.

- [ ] **Step 3: Add the shared types**

Create `src/auth/authTypes.ts` with:

```ts
export type AuthMode = 'sign-in' | 'sign-up' | 'forgot';

export interface RoyalAuthFormProps {
  readonly mode: AuthMode;
  readonly email: string;
  readonly password: string;
  readonly busy: boolean;
  readonly message: string | null;
  readonly recovery: boolean;
  readonly invalidRecovery: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly onModeChange: (mode: AuthMode) => void;
  readonly onRequestAnotherReset: () => void;
}
```

- [ ] **Step 4: Commit the interface baseline**

```bash
git add src/auth/authTypes.ts src/auth/RoyalAuthForm.test.tsx
git commit -m "test: define royal auth form contract"
```

---

### Task 2: Build the accessible auth form

**Files:**
- Create: `src/auth/RoyalAuthForm.tsx`
- Modify: `src/auth/RoyalAuthForm.test.tsx`

**Interfaces:**
- Consumes: `RoyalAuthFormProps`
- Produces: `RoyalAuthForm(props): JSX.Element`

- [ ] **Step 1: Add tests for every mode**

Cover these exact behaviors:

- Sign-in heading and submit label.
- Sign-up heading and submit label.
- Forgot-password mode hides the password input.
- Recovery mode shows only the new-password field.
- Invalid recovery mode shows an alert and “Request another reset link”.
- Busy mode disables submit and changes its label.
- `message` renders in a live status region.
- All inputs have explicit labels and required attributes.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run src/auth/RoyalAuthForm.test.tsx`

Expected: FAIL because the component is not implemented.

- [ ] **Step 3: Implement the form component**

Use semantic `<form>`, `<label>`, `<input>`, and `<button>` elements. Keep the existing English account copy from `AuthRoot` unless the design spec explicitly overrides it. Use stable class names:

```txt
royal-auth-card
royal-auth-heading
royal-auth-form
royal-auth-field
royal-auth-primary
royal-auth-links
royal-auth-message
```

Mode-switch buttons must call `onModeChange` directly and must never submit the form.

- [ ] **Step 4: Run the focused test suite**

Run: `pnpm vitest run src/auth/RoyalAuthForm.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/RoyalAuthForm.tsx src/auth/RoyalAuthForm.test.tsx
git commit -m "feat: add accessible royal auth form"
```

---

### Task 3: Build the RoyalStory logo and layered scene

**Files:**
- Create: `src/auth/RoyalStoryLogo.tsx`
- Create: `src/auth/RoyalAuthScene.tsx`
- Create: `src/auth/royal-auth.css`

**Interfaces:**
- Produces: `RoyalStoryLogo({ compact?: boolean }): JSX.Element`
- Produces: `RoyalAuthScene({ children, loadingText? }): JSX.Element`

- [ ] **Step 1: Create the logo component**

Render “RoyalStory” as accessible text with decorative crown and gem elements marked `aria-hidden="true"`. Do not encode the game name only inside a background image.

- [ ] **Step 2: Create the scene component with independent layers**

Use this DOM ordering and stable classes:

```txt
royal-auth-scene
  royal-auth-backdrop
  royal-auth-architecture
  royal-auth-banner royal-auth-banner-left
  royal-auth-banner royal-auth-banner-right
  royal-auth-brazier royal-auth-brazier-left
    royal-auth-fire
    royal-auth-fire-glow
  royal-auth-brazier royal-auth-brazier-right
    royal-auth-fire
    royal-auth-fire-glow
  royal-auth-particles
  royal-auth-mist
  royal-auth-content
```

Decorative layers must use `aria-hidden="true"` and `pointer-events: none`.

- [ ] **Step 3: Implement desktop scene styling**

In `royal-auth.css`, build the environment with gradients, pseudo-elements, inline SVG backgrounds, and CSS shapes. Use dark violet, burgundy, antique gold, warm fire orange, and ivory. Keep the content layer above all decoration with explicit z-index tokens.

- [ ] **Step 4: Implement the two-second entrance sequence**

Sequence:

1. scene fades from black;
2. left and right fires ignite with a slight stagger;
3. logo descends and fades in;
4. logo receives one gold shimmer pass;
5. auth card rises and fades in.

Do not delay pointer interaction beyond the visible entrance.

- [ ] **Step 5: Implement continuous ambient animation**

Animate fire scale/shape, glow intensity, upward particles, and subtle mist drift. Avoid moving the entire screen or form.

- [ ] **Step 6: Implement mobile and reduced-motion rules**

At `max-width: 640px`:

- hide side banners and nonessential architecture details;
- reduce particle count;
- move braziers lower and partly offscreen;
- make the card nearly full width;
- keep logo and form readable without horizontal scrolling.

Under `prefers-reduced-motion: reduce`, stop particles, mist, shimmer, and fire transforms; retain static fire/glow artwork.

- [ ] **Step 7: Commit**

```bash
git add src/auth/RoyalStoryLogo.tsx src/auth/RoyalAuthScene.tsx src/auth/royal-auth.css
git commit -m "feat: add layered royal login scene"
```

---

### Task 4: Integrate the scene with AuthRoot

**Files:**
- Modify: `src/AuthRoot.tsx`
- Modify: `src/main.tsx`
- Create: `src/AuthRoot.test.tsx`

**Interfaces:**
- Consumes: existing `authApi` and `playerApi` methods unchanged.
- Produces: the same signed-in `App` flow and reset-progress behavior currently exposed by `AuthRoot`.

- [ ] **Step 1: Add integration tests with mocked APIs**

Test:

- existing session check still calls `playerApi.load`;
- sign in calls `authApi.signIn({ email, password })`;
- create account calls `authApi.signUp({ email, password })`;
- forgot password calls `authApi.requestPasswordReset(email)`;
- successful password recovery calls `authApi.updatePassword(password)` then `authApi.signOut()`;
- successful authentication calls `loadSession` and renders the game;
- errors retain the existing user-safe messages.

- [ ] **Step 2: Run tests and verify current failures**

Run: `pnpm vitest run src/AuthRoot.test.tsx`

Expected: FAIL until mocks and the new presentation integration are complete.

- [ ] **Step 3: Refactor AuthRoot without changing auth logic**

Import `AuthMode` from `src/auth/authTypes.ts`. Replace the two unauthenticated JSX blocks and checking-state JSX with `RoyalAuthScene` and `RoyalAuthForm`. Keep all submit functions, recovery URL handling, session loading, sign-out, reset-progress, and signed-in JSX behavior intact.

- [ ] **Step 4: Import auth CSS from the entrypoint**

Add:

```ts
import './auth/royal-auth.css';
```

in `src/main.tsx` after global styles.

- [ ] **Step 5: Run integration tests**

Run: `pnpm vitest run src/AuthRoot.test.tsx src/auth/RoyalAuthForm.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/AuthRoot.tsx src/main.tsx src/AuthRoot.test.tsx
git commit -m "feat: integrate royal login with Supabase auth"
```

---

### Task 5: Visual, responsive, and accessibility verification

**Files:**
- Modify: `src/auth/royal-auth.css`
- Modify: `src/auth/RoyalAuthScene.tsx`
- Modify: `src/auth/RoyalAuthForm.tsx`
- Modify: tests as required by discovered issues.

- [ ] **Step 1: Run automated verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Verify desktop layouts manually**

Run `pnpm dev` and inspect at 1920×1080, 1440×900, and 1280×720. Confirm the form remains visible without scrolling, both fires frame rather than overlap the card, and the logo is legible.

- [ ] **Step 3: Verify mobile layouts manually**

Inspect at 390×844 and 320×568. Confirm no horizontal overflow, 44px controls, readable messages, visible primary action, and simplified decorations.

- [ ] **Step 4: Verify keyboard and screen-reader semantics**

Tab through all controls in logical order. Confirm focus rings are never clipped, mode links are buttons, alerts/status messages announce correctly, and decorative layers are absent from the accessibility tree.

- [ ] **Step 5: Verify reduced motion**

Enable reduced motion in browser emulation. Confirm the page displays immediately with static fires and no repeated particle/mist movement.

- [ ] **Step 6: Check performance**

Confirm the scene uses no autoplay video, no JavaScript animation loop, and no oversized raster background. Ensure animations are limited primarily to transform and opacity.

- [ ] **Step 7: Final commit**

```bash
git add src/auth src/AuthRoot.tsx src/AuthRoot.test.tsx src/main.tsx src/styles.css
git commit -m "polish: finalize responsive royal login"
```

---

## Completion Criteria

- Existing Supabase authentication behavior passes integration tests.
- The full throne-room presentation appears on desktop.
- Mobile receives a simplified, usable version with no horizontal overflow.
- Fire, glow, particles, logo, and form animate as separate layers.
- Reduced-motion users receive a static presentation.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` all pass.
