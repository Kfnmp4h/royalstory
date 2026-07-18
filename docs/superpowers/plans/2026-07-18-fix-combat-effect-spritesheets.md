# Combat Effect PNG Spritesheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phaser load and play the existing RoyalStory combat effects by replacing unsupported SVG spritesheet URLs with same-dimension PNG spritesheets.

**Architecture:** Keep the event contract, controller, pooling, port, effect keys, and animation keys unchanged. Rasterize each project-owned horizontal SVG into an equal-size transparent PNG, then change only manifest file extensions.

**Tech Stack:** TypeScript, Vitest, Phaser 3, Vite public assets, headless Chrome for one-time rasterization.

## Global Constraints

- Use only the committed original RoyalStory art; add no external or MapleStory assets.
- Do not change combat outcomes, save format, APIs, Supabase, authentication, Vercel configuration, or local-persistence behavior.
- Use TDD, small commits, full verification, and a deployed Vercel console smoke-check.

---

### Task 1: Specify raster sprite-sheet requirements

**Files:**
- Modify: `src/game/phaser/combatPresentation/effectManifest.test.ts`
- Create: `docs/superpowers/plans/2026-07-18-fix-combat-effect-spritesheets.md`

- [ ] **Step 1: Write the failing test**

Change all five expected URLs to `.png`. Add a `PNG_SIGNATURE` buffer of `[137, 80, 78, 71, 13, 10, 26, 10]`, read each `public/<manifest url>` as a Buffer, and assert both its signature and `readUInt32BE(16/20)` dimensions equal `{ width: frameWidth * frameCount, height: frameHeight }`.

- [ ] **Step 2: Verify RED**

Run `pnpm exec vitest run src/game/phaser/combatPresentation/effectManifest.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`.

Expected: failure because the manifest names SVG files and PNG sheets are absent.

- [ ] **Step 3: Commit**

Run `git add src/game/phaser/combatPresentation/effectManifest.test.ts docs/superpowers/plans/2026-07-18-fix-combat-effect-spritesheets.md` then `git commit -m "test: require raster combat effect sheets"`.

### Task 2: Supply native-size PNG sheets and use them

**Files:**
- Create: `public/assets/combat/slash-basic.png` (144x48)
- Create: `public/assets/combat/impact-basic.png` (96x32)
- Create: `public/assets/combat/impact-critical.png` (192x48)
- Create: `public/assets/combat/enemy-death.png` (192x48)
- Create: `public/assets/combat/death-particles.png` (128x32)
- Modify: `src/game/phaser/combatPresentation/effectManifest.ts`
- Test: `src/game/phaser/combatPresentation/effectManifest.test.ts`
- Test: `src/game/phaser/combatPresentation/combatAssets.test.ts`

- [ ] **Step 1: Rasterize assets**

Use isolated headless Chrome `Page.captureScreenshot` with `omitBackground: true` at each SVG's native dimensions. Preserve every frame's ordering and pixel geometry.

- [ ] **Step 2: Write minimal implementation**

Replace only each manifest `url` extension, for example `url: 'assets/combat/slash-basic.png'`. Do not change any key, frame count, frame size, frame rate, origin, scale, or animation key.

- [ ] **Step 3: Verify GREEN**

Run `pnpm exec vitest run src/game/phaser/combatPresentation/effectManifest.test.ts src/game/phaser/combatPresentation/combatAssets.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`.

Expected: both tests pass and `preloadCombatEffects()` still calls `spritesheet()` with unchanged metadata.

- [ ] **Step 4: Commit**

Run `git add public/assets/combat/*.png src/game/phaser/combatPresentation/effectManifest.ts` then `git commit -m "fix: load combat effects from PNG spritesheets"`.

### Task 3: Verify production behavior

**Files:**
- Verify only: `src/game/phaser/combatPresentation/effectManifest.test.ts`
- Verify only: `src/game/phaser/combatPresentation/combatAssets.test.ts`

- [ ] **Step 1: Run repository verification**

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check origin/main..HEAD`.

Expected: all tests/typecheck/build pass; build copies all five PNGs into `dist/assets/combat/`; the pre-existing Vite chunk-size advisory may remain.

- [ ] **Step 2: Push and smoke-check Vercel**

After review and a clean tree, push the verified branch to `main`. In an isolated authenticated headless browser, wait through multiple attacks and assert there are no `Failed to process file ... spritesheet` or `Texture ... not found` diagnostics for the five effect keys.

## Self-review

- Task 1 proves the missing raster capability; Task 2 fixes only owned assets and URLs; Task 3 proves build and deployed rendering diagnostics.
- Every effect retains its existing dimensions and animation contract.
