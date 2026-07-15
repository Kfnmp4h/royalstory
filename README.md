# RoyalStory Equipment Sandbox

RoyalStory Milestone 5 is a responsive campaign and equipment sandbox. React presents Ari's progression and loadout, Phaser draws the automatic battles, and pure TypeScript controllers own combat, campaign, and equipment state.

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

## Milestone 5 features

- Automatic XP from farming enemies, breakthrough Sentinels, and chapter bosses across 36 chapters.
- Deterministic level progression from 1 to 200 with overflow XP and live ATK, DEF, and Max HP growth.
- Equipment drops with Normal, Rare, Epic, Unique, and Legendary rarities.
- Fourteen fixed slots: Hat, Cape, Top, Shoulder, Bottom, Belt, Gloves, Shoes, Ring, Ring 2, Necklace, Eye, Face, and Earring.
- Every item has ATK, DEF, and Max HP main stats plus rarity-based substats.
- All approved equipment stats affect live combat, including Accuracy, Evasion, critical hits, Attack Speed, Damage, Boss Monster Damage, and Normal Monster Damage.
- A Character First interface with effective hero stats, Total Power, inventory comparison, manual equip, and Equip Best.
- Accessible visual feedback for new drops, misses, and critical hits.

## Session-only equipment

Progression, equipment, and inventory exist only in memory for the current browser session and reset on reload. Permanent saving is planned for Milestone 6. The current milestone does not use browser storage, cookies, filesystem saves, accounts, server syncing, or offline progress.

Milestone 5 does not include currencies, skills, item deletion, enhancement, or permanent persistence. All visuals are original and code-drawn.
