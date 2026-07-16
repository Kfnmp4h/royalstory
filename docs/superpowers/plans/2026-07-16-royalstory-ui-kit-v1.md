# RoyalStory UI Kit v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared RoyalStory visual foundation used by the login screen: design tokens, reusable panel/button/input/divider components, scalable logo and ornament assets, and an illustrated throne-room scene with separate animated layers.

**Architecture:** Introduce a small `src/ui` design-system boundary whose components consume shared CSS custom properties instead of raw values. Keep the illustrated environment in `public/art/royalstory/`, while React owns accessible content and CSS owns decorative animation. Refactor the existing royal login to consume the UI kit without changing Supabase authentication behavior.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, CSS custom properties, SVG, WebP/PNG, Vitest, Testing Library.

## Global Constraints

- Use the approved stylized mobile-MMORPG direction.
- Preserve all existing `authApi`, `playerApi`, Supabase, reset-password, session-loading, sign-out, and signed-in game behavior.
- Use the canonical palette from `docs/superpowers/specs/2026-07-16-royalstory-ui-kit-design.md`.
- New components must consume shared tokens instead of copying raw values.
- Gold is reserved for primary actions, selected states, premium emphasis, and important framing.
- Main panel radii must stay between 16 and 24 pixels; small controls between 8 and 12 pixels.
- All touch controls must be at least 44 pixels high.
- Decorative artwork must be excluded from the accessibility tree.
- Information must not rely on color alone.
- Respect `prefers-reduced-motion` with static equivalents.
- Desktop may show full ornament and environmental depth; mobile must simplify nonessential layers.
- Do not add inventory, equipment, shop, or combat-specific UI behavior in this plan.
- Do not add autoplay video or JavaScript animation loops.

---

## File Structure

- Create `src/ui/tokens/royal-tokens.css` — canonical colors, spacing, radii, shadows, typography, z-index, and timing tokens.
- Create `src/ui/types.ts` — shared variant types.
- Create `src/ui/RoyalPanel.tsx` — reusable framed panel.
- Create `src/ui/RoyalButton.tsx` — primary, secondary, destructive, and text-action buttons.
- Create `src/ui/RoyalInput.tsx` — labeled accessible input with hint and error regions.
- Create `src/ui/RoyalDivider.tsx` — crown/gem divider ornament.
- Create `src/ui/RoyalBrandMark.tsx` — full, stacked, crown-only, and monochrome brand variants.
- Create `src/ui/royal-components.css` — component styling that only consumes tokens.
- Create `src/ui/RoyalPanel.test.tsx` — panel semantics and variants.
- Create `src/ui/RoyalButton.test.tsx` — button variants and behavior.
- Create `src/ui/RoyalInput.test.tsx` — labels, errors, and accessibility behavior.
- Create `src/ui/RoyalBrandMark.test.tsx` — accessible logo text and decorative exclusions.
- Create `public/art/royalstory/logo-full.svg` — horizontal wordmark.
- Create `public/art/royalstory/logo-stacked.svg` — stacked wordmark.
- Create `public/art/royalstory/crown-mark.svg` — compact crown mark.
- Create `public/art/royalstory/crown-mark-mono.svg` — one-color mark.
- Create `public/art/royalstory/ornament-corner.svg` — reusable corner ornament.
- Create `public/art/royalstory/ornament-divider.svg` — reusable divider ornament.
- Create `public/art/royalstory/login-throne-room.svg` — illustrated stylized throne-room background.
- Create `public/art/royalstory/brazier.svg` — reusable brazier shell.
- Modify `src/auth/RoyalAuthScene.tsx` — consume the new environment and brand components.
- Modify `src/auth/RoyalAuthForm.tsx` — consume `RoyalPanel`, `RoyalButton`, `RoyalInput`, and `RoyalDivider`.
- Modify `src/auth/royal-auth.css` — keep scene composition and animation only; remove duplicated component styling.
- Modify `src/main.tsx` — load token and component styles before auth styles.
- Modify existing auth tests as needed without changing auth behavior assertions.

---

### Task 1: Add canonical design tokens

**Files:**
- Create: `src/ui/tokens/royal-tokens.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces CSS custom properties under `:root` with the prefixes `--royal-color-`, `--royal-space-`, `--royal-radius-`, `--royal-shadow-`, `--royal-motion-`, `--royal-font-`, and `--royal-z-`.

- [ ] **Step 1: Add a token smoke test through the existing app build**

Add these imports to `src/main.tsx` before component-specific styles:

```ts
import './ui/tokens/royal-tokens.css';
import './ui/royal-components.css';
```

Do not create `royal-components.css` yet; the first build must fail because both files are missing.

- [ ] **Step 2: Run typecheck/build and verify failure**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: FAIL with unresolved CSS imports.

- [ ] **Step 3: Create the token file**

Create `src/ui/tokens/royal-tokens.css` with these exact canonical color tokens:

```css
:root {
  --royal-color-purple-900: #24122f;
  --royal-color-purple-700: #4b245f;
  --royal-color-purple-500: #75408a;
  --royal-color-gold-700: #a97825;
  --royal-color-gold-500: #d6a943;
  --royal-color-gold-300: #f1d477;
  --royal-color-ivory-100: #fff9e9;
  --royal-color-ivory-300: #eaddbf;
  --royal-color-ivory-500: #c9b78f;
  --royal-color-crimson-700: #6f203a;
  --royal-color-crimson-500: #a83b55;
  --royal-color-moonlight-500: #7c9fd1;
  --royal-color-fire-500: #f29a32;
  --royal-color-fire-300: #ffd36b;
  --royal-color-ink-900: #211728;
  --royal-color-ink-100: #fff8ea;

  --royal-space-1: 4px;
  --royal-space-2: 8px;
  --royal-space-3: 12px;
  --royal-space-4: 16px;
  --royal-space-5: 20px;
  --royal-space-6: 24px;
  --royal-space-8: 32px;
  --royal-space-10: 40px;

  --royal-radius-control: 10px;
  --royal-radius-panel: 20px;
  --royal-radius-modal: 24px;

  --royal-shadow-panel: 0 24px 70px rgb(15 7 22 / 52%);
  --royal-shadow-control: 0 8px 18px rgb(67 35 10 / 24%);
  --royal-shadow-focus: 0 0 0 4px rgb(117 64 138 / 28%);

  --royal-motion-press: 100ms;
  --royal-motion-hover: 160ms;
  --royal-motion-panel: 350ms;
  --royal-motion-screen: 1200ms;

  --royal-font-display: Georgia, "Times New Roman", serif;
  --royal-font-interface: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --royal-z-backdrop: -30;
  --royal-z-environment: -20;
  --royal-z-effects: -10;
  --royal-z-content: 10;
  --royal-z-overlay: 100;
}
```

Create an empty `src/ui/royal-components.css` so imports resolve.

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/ui/tokens/royal-tokens.css src/ui/royal-components.css
git commit -m "feat: add RoyalStory design tokens"
```

---

### Task 2: Define shared UI variants and build RoyalPanel

**Files:**
- Create: `src/ui/types.ts`
- Create: `src/ui/RoyalPanel.tsx`
- Create: `src/ui/RoyalPanel.test.tsx`
- Modify: `src/ui/royal-components.css`

**Interfaces:**
- Produces `RoyalPanelVariant = 'default' | 'dark' | 'modal' | 'compact' | 'legendary'`.
- Produces `RoyalPanel({ variant, title, children, className }): JSX.Element`.

- [ ] **Step 1: Write failing panel tests**

Create `src/ui/RoyalPanel.test.tsx` and verify:

```tsx
render(<RoyalPanel title="Account">Content</RoyalPanel>);
expect(screen.getByRole('region', { name: 'Account' })).toBeInTheDocument();
expect(screen.getByText('Content')).toBeInTheDocument();

render(<RoyalPanel variant="legendary">Reward</RoyalPanel>);
expect(screen.getByText('Reward').closest('section')).toHaveClass('royal-panel--legendary');
```

Also verify that a panel without `title` has no forced region role.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run src/ui/RoyalPanel.test.tsx
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement types and component**

Create `src/ui/types.ts`:

```ts
export type RoyalPanelVariant = 'default' | 'dark' | 'modal' | 'compact' | 'legendary';
export type RoyalButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text';
export type RoyalBrandVariant = 'full' | 'stacked' | 'crown' | 'mono';
```

Create `src/ui/RoyalPanel.tsx` with a generated heading id from `useId()`. Use `<section role="region" aria-labelledby={id}>` only when `title` exists. Render decorative corners as four `span` elements with `aria-hidden="true"`.

- [ ] **Step 4: Add token-driven panel CSS**

Add classes:

```txt
royal-panel
royal-panel__title
royal-panel__corner
royal-panel--default
royal-panel--dark
royal-panel--modal
royal-panel--compact
royal-panel--legendary
```

Use only token values for canonical colors, radii, shadows, spacing, and motion. The layered border must use a dark outer edge, gold midline, and light inner bevel.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run src/ui/RoyalPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/types.ts src/ui/RoyalPanel.tsx src/ui/RoyalPanel.test.tsx src/ui/royal-components.css
git commit -m "feat: add reusable royal panel"
```

---

### Task 3: Build RoyalButton

**Files:**
- Create: `src/ui/RoyalButton.tsx`
- Create: `src/ui/RoyalButton.test.tsx`
- Modify: `src/ui/royal-components.css`

**Interfaces:**
- Consumes `RoyalButtonVariant`.
- Produces a button forwarding all native `ButtonHTMLAttributes<HTMLButtonElement>`.

- [ ] **Step 1: Write failing button tests**

Test exact behavior:

```tsx
render(<RoyalButton variant="primary">Enter</RoyalButton>);
expect(screen.getByRole('button', { name: 'Enter' })).toHaveClass('royal-button--primary');

render(<RoyalButton variant="destructive" disabled>Reset</RoyalButton>);
expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();

render(<RoyalButton variant="text" type="button">Forgot password?</RoyalButton>);
expect(screen.getByRole('button', { name: 'Forgot password?' })).toHaveAttribute('type', 'button');
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm vitest run src/ui/RoyalButton.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement RoyalButton**

Default `variant` to `primary`. Merge custom `className` without dropping the stable classes `royal-button` and `royal-button--${variant}`. Do not override an explicit `type`; otherwise default to `button`.

- [ ] **Step 4: Add token-driven button CSS**

Primary uses gold gradient and ink text. Secondary uses ivory/purple with gold border. Destructive uses crimson. Text variant has transparent background and underlined hover/focus treatment. Every variant must have `min-height: 44px`, visible `:focus-visible`, disabled styling, 80–120ms press movement, and 120–180ms hover transitions.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run src/ui/RoyalButton.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/RoyalButton.tsx src/ui/RoyalButton.test.tsx src/ui/royal-components.css
git commit -m "feat: add royal button variants"
```

---

### Task 4: Build RoyalInput

**Files:**
- Create: `src/ui/RoyalInput.tsx`
- Create: `src/ui/RoyalInput.test.tsx`
- Modify: `src/ui/royal-components.css`

**Interfaces:**
- Produces `RoyalInput` with props `label`, optional `hint`, optional `error`, and all native input attributes except `id` remains optional.

- [ ] **Step 1: Write failing input tests**

Test:

```tsx
render(<RoyalInput label="Email" type="email" required />);
expect(screen.getByLabelText('Email')).toBeRequired();

render(<RoyalInput label="Password" error="Password is required" />);
const input = screen.getByLabelText('Password');
expect(input).toHaveAttribute('aria-invalid', 'true');
expect(screen.getByRole('alert')).toHaveTextContent('Password is required');
expect(input.getAttribute('aria-describedby')).toBeTruthy();
```

Verify hint text is connected through `aria-describedby` when no error exists.

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm vitest run src/ui/RoyalInput.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement RoyalInput**

Use `useId()` when no explicit id is supplied. Render an explicit `<label htmlFor>`. Give the error precedence over hint in `aria-describedby`. Do not store local value state.

- [ ] **Step 4: Add token-driven input CSS**

Use ivory surface, dark ink text, antique-gold border, purple focus border, external tokenized focus ring, 44px minimum height, and readable error text that is not communicated by color alone.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run src/ui/RoyalInput.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/RoyalInput.tsx src/ui/RoyalInput.test.tsx src/ui/royal-components.css
git commit -m "feat: add accessible royal input"
```

---

### Task 5: Build brand mark and divider primitives

**Files:**
- Create: `src/ui/RoyalBrandMark.tsx`
- Create: `src/ui/RoyalDivider.tsx`
- Create: `src/ui/RoyalBrandMark.test.tsx`
- Create: `public/art/royalstory/logo-full.svg`
- Create: `public/art/royalstory/logo-stacked.svg`
- Create: `public/art/royalstory/crown-mark.svg`
- Create: `public/art/royalstory/crown-mark-mono.svg`
- Create: `public/art/royalstory/ornament-divider.svg`
- Create: `public/art/royalstory/ornament-corner.svg`
- Modify: `src/ui/royal-components.css`

**Interfaces:**
- Consumes `RoyalBrandVariant`.
- Produces `RoyalBrandMark({ variant, className }): JSX.Element`.
- Produces `RoyalDivider({ label? }): JSX.Element`.

- [ ] **Step 1: Write failing brand tests**

Test that every brand variant exposes the accessible name `RoyalStory`, while all decorative SVG or image nodes are `aria-hidden="true"`. Verify that the visible fallback wordmark text remains in the DOM so brand text is not only embedded in an asset.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm vitest run src/ui/RoyalBrandMark.test.tsx
```

Expected: FAIL because the components and assets do not exist.

- [ ] **Step 3: Create original SVG assets**

Create four logo variants using original vector geometry:

- crown silhouette with three broad points;
- central diamond-shaped purple gemstone;
- gold body with dark lower edge and light upper highlight;
- no embedded bitmap;
- no text as the only accessible brand representation.

Create divider and corner assets with symmetrical scrollwork and a central gem mount. Keep silhouettes readable at 24px.

- [ ] **Step 4: Implement RoyalBrandMark and RoyalDivider**

`RoyalBrandMark` must map variants to the matching asset path and render a visible text fallback. `RoyalDivider` renders the ornament asset as decorative and optional readable label text.

- [ ] **Step 5: Add component CSS**

Add responsive sizing, gold shimmer limited to the full and stacked logo, static treatment under reduced motion, and dark/ivory surface compatibility.

- [ ] **Step 6: Run focused tests and build**

Run:

```bash
pnpm vitest run src/ui/RoyalBrandMark.test.tsx
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/RoyalBrandMark.tsx src/ui/RoyalDivider.tsx src/ui/RoyalBrandMark.test.tsx src/ui/royal-components.css public/art/royalstory
git commit -m "feat: add RoyalStory brand assets"
```

---

### Task 6: Create the illustrated login art pack

**Files:**
- Create: `public/art/royalstory/login-throne-room.svg`
- Create: `public/art/royalstory/brazier.svg`
- Modify: `src/auth/RoyalAuthScene.tsx`
- Modify: `src/auth/royal-auth.css`

**Interfaces:**
- Produces a static illustrated environment asset with no interactive content.
- Keeps fire, glow, embers, mist, brand, and form as separate DOM/CSS layers.

- [ ] **Step 1: Add scene asset references before the files exist**

Update `RoyalAuthScene.tsx` to render:

```tsx
<img className="royal-auth-environment" src="/art/royalstory/login-throne-room.svg" alt="" aria-hidden="true" />
```

Use `/art/royalstory/brazier.svg` inside both brazier containers. Keep existing flame and glow spans separate.

- [ ] **Step 2: Run build and verify failure**

Run:

```bash
pnpm build
```

Expected: build may pass because public paths are runtime-resolved; manually verify the preview shows broken assets before creating them.

- [ ] **Step 3: Create the throne-room illustration**

The SVG must contain these visible scene groups, from back to front:

```txt
moonlit windows
rear wall and throne alcove
large central throne
pale stone columns
purple and crimson banners
gold architectural trim
central crimson carpet
foreground floor and stair edges
```

The composition must leave a calm, high-contrast area around the centered login card. Use softened vector shading, broad silhouettes, and no photorealistic texture.

- [ ] **Step 4: Create the brazier illustration**

The brazier SVG must have a wide bowl, thick silhouette, antique-gold trim, dark forged-metal body, and no baked-in flame. The animated flames remain separate CSS layers.

- [ ] **Step 5: Refactor auth scene CSS**

Remove CSS-drawn architecture that duplicates the illustration. Retain only composition, fire, glow, embers, mist, entrance, slow 1–2% environment zoom, mobile simplification, and reduced-motion behavior. Use token variables wherever a canonical value exists.

- [ ] **Step 6: Verify desktop and mobile scene manually**

Run `pnpm dev` and inspect:

```txt
1920×1080
1440×900
1280×720
390×844
320×568
```

Confirm the environment frames the form, no brazier overlaps the card, the throne remains visible, and no horizontal scrolling occurs.

- [ ] **Step 7: Commit**

```bash
git add public/art/royalstory/login-throne-room.svg public/art/royalstory/brazier.svg src/auth/RoyalAuthScene.tsx src/auth/royal-auth.css
git commit -m "feat: add illustrated royal login art pack"
```

---

### Task 7: Refactor the auth form onto the UI kit

**Files:**
- Modify: `src/auth/RoyalAuthForm.tsx`
- Modify: `src/auth/RoyalAuthForm.test.tsx`
- Modify: `src/auth/royal-auth.css`

**Interfaces:**
- Consumes `RoyalPanel`, `RoyalButton`, `RoyalInput`, and `RoyalDivider`.
- Preserves the existing `RoyalAuthFormProps` contract and all auth mode behavior.

- [ ] **Step 1: Strengthen existing form tests**

Add assertions that:

- primary submit action uses `royal-button--primary`;
- mode-switch actions use `royal-button--text`;
- the form is inside a `royal-panel`;
- email and password fields remain explicitly labeled;
- forgot mode still hides password;
- recovery and invalid-recovery behavior remains unchanged.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run src/auth/RoyalAuthForm.test.tsx
```

Expected: FAIL because the current form does not consume the UI kit.

- [ ] **Step 3: Refactor the form**

Replace local panel, button, and field markup with the shared components. Preserve submit callbacks, mode callbacks, form semantics, busy labels, live regions, validation attributes, and existing user-facing copy.

- [ ] **Step 4: Remove duplicated auth component CSS**

Delete auth-specific definitions for card frame, generic buttons, and generic inputs. Keep only layout rules unique to the login screen.

- [ ] **Step 5: Run auth and UI tests**

Run:

```bash
pnpm vitest run src/auth/RoyalAuthForm.test.tsx src/ui/RoyalPanel.test.tsx src/ui/RoyalButton.test.tsx src/ui/RoyalInput.test.tsx src/ui/RoyalBrandMark.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/auth/RoyalAuthForm.tsx src/auth/RoyalAuthForm.test.tsx src/auth/royal-auth.css
git commit -m "refactor: use RoyalStory UI kit in login form"
```

---

### Task 8: Integrate the brand mark into the login scene

**Files:**
- Modify: `src/auth/RoyalAuthScene.tsx`
- Delete: `src/auth/RoyalStoryLogo.tsx`
- Modify: imports/tests that reference the old component.

**Interfaces:**
- Consumes `RoyalBrandMark`.
- Removes the duplicate auth-only logo implementation.

- [ ] **Step 1: Replace the old logo in tests and scene markup**

Use:

```tsx
<RoyalBrandMark variant="stacked" className="royal-auth-brand" />
```

Ensure no test imports `RoyalStoryLogo` after this change.

- [ ] **Step 2: Run focused tests and verify failure where imports remain**

Run:

```bash
pnpm vitest run src/auth src/ui
```

Expected: FAIL until all imports are updated.

- [ ] **Step 3: Remove the old component and update imports**

Delete `src/auth/RoyalStoryLogo.tsx`. Update all references to use `RoyalBrandMark`.

- [ ] **Step 4: Run focused tests and build**

Run:

```bash
pnpm vitest run src/auth src/ui
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth src/ui
git commit -m "refactor: centralize RoyalStory brand mark"
```

---

### Task 9: Final accessibility, responsiveness, and regression verification

**Files:**
- Modify only files required by discovered issues.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Verify auth regressions manually**

Test against the configured Supabase project:

```txt
sign in
create account
forgot password
password recovery route
invalid recovery route
sign out
session restore
```

Expected: behavior and user-safe messages match the pre-UI-kit implementation.

- [ ] **Step 3: Verify keyboard and screen-reader behavior**

Confirm:

```txt
logical tab order
visible focus ring on every control
44px minimum controls
panel headings label regions
errors use role=alert
status messages use live regions
decorative assets do not enter the accessibility tree
brand name remains available as text
```

- [ ] **Step 4: Verify responsive layouts**

Inspect the five required viewport sizes. Confirm full desktop decoration, simplified mobile decoration, no horizontal overflow, and visible primary action without clipped content.

- [ ] **Step 5: Verify reduced motion**

Enable reduced motion and confirm environment zoom, shimmer, embers, mist, and fire transforms stop while static artwork remains visible.

- [ ] **Step 6: Verify asset and animation performance**

Confirm:

```txt
no autoplay video
no JavaScript animation loop
no oversized transparent raster background
SVG assets have descriptive filenames
ambient animation primarily uses transform and opacity
```

- [ ] **Step 7: Update the pull request summary**

Document the new token layer, shared components, brand assets, illustrated throne room, auth refactor, verification results, and any manual test limitations.

- [ ] **Step 8: Final commit**

```bash
git add src/ui src/auth src/main.tsx public/art/royalstory docs/superpowers
git commit -m "polish: finalize RoyalStory UI Kit v1"
```

---

## Completion Criteria

- Canonical RoyalStory tokens are available globally.
- Login UI uses shared panel, button, input, divider, and brand primitives.
- The full, stacked, crown-only, and monochrome brand variants exist.
- The login environment uses an original illustrated throne-room asset.
- Fire, glow, embers, mist, logo, and form remain separate layers.
- Desktop and mobile layouts follow the approved visual hierarchy.
- Reduced-motion users receive static equivalents.
- Existing authentication behavior remains unchanged.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.
