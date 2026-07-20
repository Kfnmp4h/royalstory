# Battle and Equipment Navigation Tabs Design

## Goal

Introduce top-level navigation with two tabs, `Battle` and `Equipment`, so equipment management has a dedicated view while the active battle continues uninterrupted.

## Scope

The first navigation release contains exactly two tabs:

- `Battle` — the existing campaign, hero progression, Phaser battle scene, combat status, and battle controls.
- `Equipment` — Ari's loadout, all equipment slots, inventory, item comparison, item actions, and `Equip Best`.

No additional tabs, routes, URL state, or navigation dependencies are included.

## Navigation behavior

`Battle` is selected by default. The tab bar is rendered directly below the existing page header.

The navigation uses accessible tab semantics:

- container: `role="tablist"`
- controls: `role="tab"`
- active state: `aria-selected`
- relationships: `aria-controls` and matching panel IDs
- panels: `role="tabpanel"`
- keyboard navigation: Left Arrow and Right Arrow move focus and selection between tabs

The tab state is local React state:

```ts
type AppTab = 'battle' | 'equipment';
```

React Router is not introduced and changing tabs does not alter the URL.

## Phaser lifecycle

The Battle panel remains mounted while Equipment is selected. It is hidden with the native `hidden` attribute instead of conditional unmounting.

This preserves the existing Phaser controller and prevents tab changes from restarting combat, destroying the renderer, resetting visual presentation state, or creating an additional battle instance.

The existing page-visibility pause behavior remains unchanged. Selecting Equipment does not pause gameplay.

## Component boundaries

`App.tsx` continues to own:

- canonical player record
- Phaser controller lifecycle
- server command dispatch
- selected top-level tab
- status, notices, and server errors

Equipment presentation is extracted to:

```text
src/components/EquipmentTab.tsx
```

`EquipmentTab` receives data and command callbacks through props. It does not access the player API, Supabase, Campaign controller, or Phaser controller directly.

The component owns only equipment-view interaction state that is specific to its UI, including the selected inventory item.

## Equipment behavior

All existing equipment functionality is preserved:

- equipped slots render the same item information
- inventory remains sorted according to the existing snapshot order
- selecting an item shows the existing comparison
- equip and equipment commands keep their current payloads and expected save version behavior
- `Equip Best` remains disabled while a server command is pending
- rarity styling and stat formatting remain unchanged

Moving the UI must not change equipment calculations, power values, item comparison, command types, saves, drops, or progression.

## Styling

Add focused styles for the top-level tab bar, selected tab, focus-visible state, and tab panels. Reuse existing typography, spacing, panel, button, rarity, inventory, and equipment styles.

The navigation must remain usable on desktop and narrow screens. No broad visual redesign is part of this work.

## Testing

Add focused React tests proving:

1. `Battle` is selected initially.
2. The Battle panel is visible initially.
3. The Equipment panel is hidden initially.
4. Clicking `Equipment` shows Equipment and hides Battle.
5. Clicking `Battle` restores Battle without creating a second Phaser renderer.
6. Arrow-key navigation moves between the two tabs.
7. Existing equipment commands still use the same typed server commands.
8. Unmounting the application still destroys the Phaser renderer exactly once.

Run the focused tests, full test suite, typecheck, build, and verify the resulting Vercel production deployment.

## Constraints

- Follow strict RED → GREEN → verification.
- Commit the failing navigation tests separately from implementation.
- Do not change gameplay, combat timing, Campaign progression, equipment formulas, save data, API behavior, Supabase architecture, or Vercel configuration.
- Do not add React Router or another navigation package.
- Do not broadly rewrite `App.tsx`; extract only the equipment UI needed for this boundary.
- Do not destroy or recreate Phaser when switching tabs.
