# RoyalStory Combat Sandbox

RoyalStory Milestone 2 is a local, responsive campaign sandbox. React provides the page and campaign controls, Phaser draws the battle scene, and a pure TypeScript engine owns combat state.

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

## Milestone 3 features

- Automatic XP from farming enemies, breakthrough Sentinels, and chapter bosses.
- Deterministic level progression from 1 to 200 with overflow XP.
- ATK, DEF, and max-HP scale from one central balance entrypoint and affect live combat.
- A responsive Hero panel shows level, XP, ATK, DEF, and HP while Phaser combat continues.
- Central equipment metadata defines 14 slots, item levels 1–200, and five rarities for Milestone 5.

## Milestone 3 boundaries

Progression exists only in memory and resets on reload. This milestone has no browser persistence, accounts, server syncing, offline progress, skills, item generation, inventory, or currencies.

All visuals are original and code-drawn.
