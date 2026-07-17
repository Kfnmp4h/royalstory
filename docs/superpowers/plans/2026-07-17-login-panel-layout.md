# Login Panel Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the live login panel lower, reveal more of the throne, and keep every login control safely inside the decorative frame without changing authentication behavior.

**Architecture:** Keep the existing React markup and assets unchanged. Add one focused stylesheet regression test, then make the smallest responsive CSS changes in `src/live-login.css` to define a safe inner content width, balanced vertical spacing, and lower viewport placement across desktop, mobile, and short-height desktop layouts.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 3.2, Vite 7, CSS.

## Global Constraints

- Modify presentation only; authentication behavior must remain unchanged.
- Keep the existing throne-room background and ornate panel frame assets.
- Do not modify `src/AuthRoot.tsx` unless a failing test proves a semantic hook is required.
- No new artwork, gameplay changes, unrelated refactors, or large rewrites.
- Preserve horizontal centering and prevent horizontal scrolling.

---

### Task 1: Specify the login layout contract

**Files:**
- Create: `src/live-login.test.ts`
- Test: `src/live-login.test.ts`

**Interfaces:**
- Consumes: the stylesheet text exported by the file system at `src/live-login.css`.
- Produces: a regression contract for lower panel placement, safe inner width, and responsive compact variants.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./live-login.css', import.meta.url), 'utf8');

describe('live login layout', () => {
  it('keeps the panel low and all controls inside a safe inner area', () => {
    expect(stylesheet).toContain('grid-template-rows: 1fr auto');
    expect(stylesheet).toContain('max-width: 100%');
    expect(stylesheet).toContain('box-sizing: border-box');
    expect(stylesheet).toContain('padding: 112px 58px 78px');
    expect(stylesheet).toContain('@media (max-width: 640px)');
    expect(stylesheet).toContain('@media (max-height: 760px) and (min-width: 641px)');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/live-login.test.ts`

Expected: FAIL because the stylesheet does not yet contain the new lower-placement grid contract and exact safe-area declarations.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/live-login.test.ts
git commit -m "test: specify safe login panel layout"
```

---

### Task 2: Implement the minimal responsive CSS fix

**Files:**
- Modify: `src/live-login.css:3-276`
- Test: `src/live-login.test.ts`

**Interfaces:**
- Consumes: existing `.auth-shell`, `.auth-panel`, input, button, mobile, and short-height selectors.
- Produces: a lower, centered, unclipped login panel whose controls remain within the decorative frame.

- [ ] **Step 1: Change the shell to reserve throne space above the panel**

Replace the shell layout declarations with:

```css
.auth-shell {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  padding: 18px 16px clamp(18px, 3vh, 34px);
  color: #2b1830;
  background:
    linear-gradient(180deg, rgb(4 2 8 / 8%), rgb(4 2 8 / 12%) 52%, rgb(4 2 8 / 54%) 100%),
    url('./assets/backgrounds/login/throne-room.webp') center center / cover no-repeat;
}
```

- [ ] **Step 2: Give the panel a safe internal content area**

Update the panel declarations to:

```css
.auth-panel {
  position: relative;
  display: grid;
  align-content: center;
  justify-self: center;
  width: min(92vw, 410px);
  min-height: 520px;
  max-width: 100%;
  gap: 10px;
  padding: 112px 58px 78px;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  color: #f5e9c8;
  background: url('./assets/ui/login/login-panel-frame.png') center / 100% 100% no-repeat;
  filter: drop-shadow(0 26px 34px rgb(0 0 0 / 68%));
  animation: royal-live-panel-in 650ms cubic-bezier(.2,.8,.2,1) both;
}
```

- [ ] **Step 3: Prevent controls from exceeding the inner area**

Add `max-width` and `box-sizing` to the existing control rule:

```css
.auth-panel input,
.auth-panel .primary-action {
  max-width: 100%;
  box-sizing: border-box;
}
```

- [ ] **Step 4: Tune mobile and short-height variants**

Use these responsive panel values:

```css
@media (max-width: 640px) {
  .auth-shell {
    padding: 14px 10px 12px;
    background-position: 50% center;
  }

  .auth-panel {
    width: min(94vw, 370px);
    min-height: 500px;
    padding: 104px 48px 76px;
  }
}

@media (max-height: 760px) and (min-width: 641px) {
  .auth-panel {
    width: min(88vw, 370px);
    min-height: 470px;
    padding: 94px 48px 68px;
    gap: 7px;
  }
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- src/live-login.test.ts`

Expected: PASS.

- [ ] **Step 6: Run complete verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, TypeScript exits successfully, and Vite produces a production build.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/live-login.css
git commit -m "fix: keep login form inside lowered panel"
```

---

## Self-review

- The plan covers lower placement, visible throne space, safe inner sizing, mobile layout, short-height desktop layout, and no horizontal overflow.
- No authentication or component logic changes are planned.
- Every implementation change is covered by the focused stylesheet regression test and the complete verification commands.
