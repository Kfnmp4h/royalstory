# RoyalStory Combat Sandbox

RoyalStory Milestone 1 is a local, responsive combat sandbox that proves the automatic battle loop, recovery rules, and browser visibility handling. React provides the page and diagnostics, Phaser draws the battle scene, and a pure TypeScript engine owns combat state.

## Requirements

- Node.js 24
- pnpm 11

## Run locally

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite.

## Verification commands

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Milestone 1 features

- Responsive side-view battle scene with Ari and Mossling.
- Automatic attacks, health changes, damage feedback, death, enemy replacement, and player resurrection.
- Page Visibility API integration that pauses hidden-tab combat without granting offline progress.
- Live running, paused, runtime, attack, defeat, and error diagnostics.
- Deterministic unit, integration, lifecycle, and ten-minute simulation coverage.

## Milestone 1 boundaries

This milestone intentionally excludes stages, progression, skills, equipment, persistent settings or saves, backend services, accounts, and offline rewards. It does not include character creation, imported game assets, or later-milestone systems.

All current visuals are original, code-drawn placeholders.
