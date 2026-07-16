# RoyalStory

RoyalStory is a responsive campaign game: React presents Ari's progression and loadout, Phaser draws automatic battles, and TypeScript controllers own combat and campaign state.

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

## Milestone 6 production behavior

- Supabase sessions are server-managed.
- The Vercel API is the canonical state authority and uses optimistic versions for save commands.
- Browser clients use same-origin `/api` routes only, with no browser game persistence.
- The server applies bounded offline farming when canonical player state is loaded.
- Password recovery flows through `/api/auth/recover` and then `/reset-password`.

## Operations and versioning

See [the production setup guide](docs/production-setup.md) for deployment and operations.

`package.json` remains at version `0.0.0` because this project has no established release tag, changelog, or package-version convention.
