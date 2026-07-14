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

## Milestone 2 features

- 36 original chapters, each with a farming encounter, a breakthrough challenge, and a boss challenge.
- Progress from farming through breakthrough and boss encounters to unlock the next chapter.
- Original code-drawn visuals for the campaign and combat scene; no external game assets are used.
- The deterministic test profile exists only in memory. Reloading resets it to the first chapter.

## Milestone 2 boundaries

This milestone has no persistent storage: it does not provide saves, accounts, online syncing, XP, rewards, or offline progress. It also does not include skills, equipment, character creation, imported game assets, or later-milestone systems.

All visuals are original and code-drawn.
