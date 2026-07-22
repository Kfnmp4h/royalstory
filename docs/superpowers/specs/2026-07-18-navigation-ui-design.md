# RoyalStory navigation UI design

**Date:** 2026-07-18  
**Status:** Approved for planning

## Goal

Replace the single long game screen with two focused, responsive tabs:

- **Battle** is the default screen and contains the campaign controls, hero summary, Phaser battle, and combat diagnostics.
- **Equipment** contains the existing loadout, inventory, comparison, and equip controls, plus the same hero summary and a complete equipment-bonus stat view.

The automatic battle must continue while the player views Equipment.

## Scope and constraints

- Add only the Battle and Equipment navigation UI; do not add inventory/equipment functionality beyond its presentation.
- Preserve the existing campaign commands, combat rules, save schema, server API, authentication, and save/sync behaviour.
- Do not use local storage, session storage, cookies, or URL persistence for the selected tab. Battle is the default after a reload.
- Continue using the project’s original RoyalStory visual language and existing responsive CSS patterns.

## User experience

### Navigation

The game header is followed by a two-item tab list:

- **Battle** is selected initially.
- **Equipment** reveals the equipment workspace.
- On desktop, the tab list appears beneath the header.
- On mobile, it is fixed at the bottom with safe-area-aware page padding so it never covers controls or inventory content.

Tabs use the existing blue-and-gold palette with a pixel-inspired active state. They follow the tab accessibility pattern: `role="tablist"`, tab buttons with `aria-selected` and `aria-controls`, keyboard focus, and panels with `role="tabpanel"`.

### Battle tab

Battle groups the information needed while fighting:

1. Campaign chapter and Breakthrough/Boss action.
2. Compact hero progression and primary combat stats.
3. The existing Phaser battle canvas.
4. Runtime, attacks, defeats, and error diagnostics.

### Equipment tab

Equipment provides a dedicated loadout workspace:

1. The same compact hero progression and primary stat summary used by Battle.
2. An **Equipment bonuses** grid listing every member of `EQUIPMENT_STAT_KEYS`, including zero-value bonuses. Percentage stats retain their `%` suffix; flat stats use their existing labels.
3. The existing equipment slots, `Equip Best` action, inventory, selected-item comparison, manual equip action, and drop message.

The hero summary uses the current effective values. The bonus grid reads `equipment.totals`, so it shows exactly the contribution from equipped items without changing any combat calculation.

## Component architecture

`App` remains the owner of the Phaser controller, server command function, battle status, and transient UI state. It adds a transient `activeTab: 'battle' | 'equipment'` state only.

Presentation is separated into focused components:

- `GameNavigation` renders the accessible tabs and reports a requested tab.
- `HeroStatsPanel` renders the shared progression/primary-stat block from existing snapshot data.
- `BattleTab` renders campaign controls, `HeroStatsPanel`, battle host, and diagnostics.
- `EquipmentTab` renders `HeroStatsPanel`, the equipment-bonus grid, and the existing equipment UI.

Both panels remain mounted after the app starts. The inactive panel is hidden from layout and assistive technology but is not unmounted. The Phaser host and controller are therefore created independently of `activeTab`; changing tabs must neither destroy nor pause the battle. Existing visibility handling continues to pause only when the document is hidden.

The existing selected-item state remains in `App`, so selection and comparison survive switching away from Equipment and back during the same session.

## Data flow and failure behaviour

No new API call, command, persistent field, or backend behaviour is introduced.

- Existing snapshot data flows from `App` to both tab components.
- Campaign and equipment actions call the existing `issueCommand` function unchanged.
- Existing loading, server-busy, error, stale-save, and offline-reward messages render in their current contexts.
- If snapshot data has not loaded, each tab retains a concise loading state rather than rendering incomplete stats.

## Testing strategy

Use TDD for each behavioural change. Tests will verify:

- Battle is the initial selected tab.
- Tab buttons expose the correct selected state and panel association.
- Tab switches reveal only the requested panel to users while keeping both React panels mounted.
- Battle host/controller lifecycle is unaffected by a tab switch.
- The shared hero summary renders in both views.
- The Equipment bonus grid contains all `EQUIPMENT_STAT_KEYS`, including zero bonuses, with correct labels and percentage formatting.
- Existing Breakthrough/Boss, Equip Best, selected-item, and manual-equip behaviours retain their current command payloads.
- Mobile and desktop navigation CSS has the expected layout and safe bottom padding.

Run the focused component tests during each task, then the complete test suite, TypeScript check, and production build before delivery.

## Non-goals

- Additional gameplay tabs, routing, URL deep links, or persistent selected-tab preference.
- Equipment upgrades, inventory redesign, new item mechanics, or backend additions.
- Any change to combat simulation, Phaser presentation events, or player-save format.
