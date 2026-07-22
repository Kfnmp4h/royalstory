# RoyalStory Navigation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the long game page into a default Battle tab and a separate Equipment tab while keeping automatic combat running continuously.

**Architecture:** `App` remains the stateful owner of Phaser, server commands, and transient selected-item/tab state. New focused UI components render the accessible navigation, a shared hero summary, Battle content, and Equipment content; both tab panels stay mounted and only their visibility changes. Equipment bonus presentation reads the existing `EquipmentSnapshot.totals` without changing calculations or persistence.

**Tech Stack:** React 19, TypeScript 5, Vite 7, Vitest 3, Testing Library, Phaser 3, existing CSS.

## Global Constraints

- Base the work on `origin/main`; do not modify unrelated dirty worktrees.
- Do not add backend endpoints, Supabase changes, API calls, save fields, URLs, or browser persistence.
- Keep `Battle` as the default tab after every reload; selected-tab state is React memory only.
- Keep the Phaser host mounted independently of the active tab. Changing tabs must not destroy or pause the automatic battle.
- Preserve existing `startBreakthrough`, `startBoss`, `equipBest`, and `equip` command payloads and their `expectedVersion` values.
- Display all `EQUIPMENT_STAT_KEYS`, including `+0`, in the Equipment bonus view. Preserve `%` for `criticalRate`, `criticalDamage`, `attackSpeed`, `damage`, `bossDamage`, and `normalDamage`.
- Follow the existing blue/gold pixel-inspired styling, focus treatment, and `max-width: 639px` mobile breakpoint.
- Use TDD: make each named test fail first, implement only enough to pass it, run the focused test and typecheck, then commit the task.
- After all tasks, run `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check origin/main..HEAD`, and browser QA before merging.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/components/GameNavigation.tsx` | Two-button accessible tab list and `GameTab` public type. |
| `src/components/GameNavigation.test.tsx` | Selected state, tab/panel relationships, and change callback behaviour. |
| `src/components/HeroStatsPanel.tsx` | Shared progression, effective primary stats, and hero power summary. |
| `src/components/HeroStatsPanel.test.tsx` | Shared hero summary values and max-level rendering. |
| `src/components/EquipmentBonusStats.tsx` | All eleven equipment-total rows and stat formatting. |
| `src/components/EquipmentBonusStats.test.tsx` | Complete zero-inclusive stat grid and percentage formatting. |
| `src/components/BattleTab.tsx` | Campaign controls, shared stats, persistent battle host, and diagnostics. |
| `src/components/EquipmentTab.tsx` | Shared stats, bonus grid, loadout, inventory, comparison, and equip callbacks. |
| `src/components/EquipmentTab.test.tsx` | Equipment selection and callback contracts independent of `App`. |
| `src/App.tsx` | Owns transient tab state and composes the mounted panels without changing game/server logic. |
| `src/App.test.tsx` | App-level tab lifecycle and existing campaign-command regression tests. |
| `src/navigationStyles.test.ts` | Static CSS contract for desktop tabs, mobile fixed navigation, and bottom safe-area padding. |
| `src/styles.css` | Navigation, panel visibility, bonus-grid, desktop, and mobile styles. |

## Task 1: Accessible navigation primitive

**Files:**
- Create: `src/components/GameNavigation.tsx`
- Create: `src/components/GameNavigation.test.tsx`

**Interfaces:**
- Produces `export type GameTab = 'battle' | 'equipment'`.
- Produces `GameNavigation({ activeTab, onTabChange }: { activeTab: GameTab; onTabChange: (tab: GameTab) => void }): JSX.Element`.
- Consumed later by `App` and the tab panel IDs `battle-panel` / `equipment-panel`.

- [ ] **Step 1: Write failing component tests**

```tsx
it('marks Battle as selected and relates each tab to its panel', () => {
  render(<GameNavigation activeTab="battle" onTabChange={vi.fn()} />);

  expect(screen.getByRole('tab', { name: 'Battle' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Battle' })).toHaveAttribute('aria-controls', 'battle-panel');
  expect(screen.getByRole('tab', { name: 'Equipment' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByRole('tab', { name: 'Equipment' })).toHaveAttribute('aria-controls', 'equipment-panel');
});

it('requests Equipment when its tab is clicked', () => {
  const onTabChange = vi.fn();
  render(<GameNavigation activeTab="battle" onTabChange={onTabChange} />);

  fireEvent.click(screen.getByRole('tab', { name: 'Equipment' }));
  expect(onTabChange).toHaveBeenCalledWith('equipment');
});

it('moves to Equipment with the ArrowRight key from Battle', () => {
  const onTabChange = vi.fn();
  render(<GameNavigation activeTab="battle" onTabChange={onTabChange} />);

  fireEvent.keyDown(screen.getByRole('tab', { name: 'Battle' }), { key: 'ArrowRight' });
  expect(onTabChange).toHaveBeenCalledWith('equipment');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/GameNavigation.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`  
Expected: FAIL because `GameNavigation` does not yet exist.

- [ ] **Step 3: Implement the minimal navigation component**

```tsx
import type { KeyboardEvent } from 'react';

export type GameTab = 'battle' | 'equipment';

const tabs: readonly { readonly id: GameTab; readonly label: string; readonly panelId: string }[] = [
  { id: 'battle', label: 'Battle', panelId: 'battle-panel' },
  { id: 'equipment', label: 'Equipment', panelId: 'equipment-panel' },
];

export function GameNavigation({ activeTab, onTabChange }: {
  readonly activeTab: GameTab;
  readonly onTabChange: (tab: GameTab) => void;
}) {
  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const targetIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (targetIndex === null) return;
    event.preventDefault();
    onTabChange(tabs[targetIndex].id);
  };
  return <nav className="game-navigation" aria-label="Game sections"><div role="tablist" aria-label="Game sections">
    {tabs.map((tab, index) => <button key={tab.id} id={`${tab.id}-tab`} role="tab" type="button"
      aria-selected={activeTab === tab.id} aria-controls={tab.panelId}
      className={activeTab === tab.id ? 'is-active' : undefined}
      onClick={() => onTabChange(tab.id)} onKeyDown={(event) => selectAdjacentTab(event, index)}>{tab.label}</button>)}
  </div></nav>;
}
```

- [ ] **Step 4: Run focused verification and typecheck**

Run: `pnpm exec vitest run src/components/GameNavigation.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1 && pnpm typecheck`  
Expected: 3 tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/GameNavigation.tsx src/components/GameNavigation.test.tsx
git commit -m "feat: add accessible game navigation"
```

## Task 2: Shared hero summary and complete equipment bonus grid

**Files:**
- Create: `src/components/HeroStatsPanel.tsx`
- Create: `src/components/HeroStatsPanel.test.tsx`
- Create: `src/components/EquipmentBonusStats.tsx`
- Create: `src/components/EquipmentBonusStats.test.tsx`

**Interfaces:**
- Consumes `ProgressionSnapshot` from `src/game/progression/progressionTypes.ts` and `EquipmentSnapshot` / `EquipmentTotals` from `src/game/equipment/equipmentTypes.ts`.
- Produces `HeroStatsPanel({ progression, equipment, levelUpMessage })` for both tabs.
- Produces `EquipmentBonusStats({ totals }: { totals: EquipmentTotals })` for Equipment only.

- [ ] **Step 1: Write failing stat presentation tests**

```tsx
it('renders effective primary stats and hero power', () => {
  render(<HeroStatsPanel progression={progression} equipment={equipment} levelUpMessage={null} />);
  expect(screen.getByText('Level 1 / 200')).toBeInTheDocument();
  expect(screen.getByText('ATK')).toBeInTheDocument();
  expect(screen.getByText(String(equipment.effectiveStats.attack))).toBeInTheDocument();
  expect(screen.getByText(String(equipment.heroPower))).toBeInTheDocument();
});

it('renders every equipment stat, including a zero bonus', () => {
  render(<EquipmentBonusStats totals={emptyTotals} />);
  expect(screen.getByRole('heading', { name: 'Equipment bonuses' })).toBeInTheDocument();
  expect(screen.getAllByText('+0')).toHaveLength(5);
  expect(screen.getAllByText('+0%')).toHaveLength(6);
  expect(screen.getByText('Critical Rate')).toBeInTheDocument();
});

it('formats percentage bonuses with a percent sign', () => {
  render(<EquipmentBonusStats totals={{ ...emptyTotals, criticalRate: 12, attack: 4 }} />);
  expect(screen.getByText('+12%')).toBeInTheDocument();
  expect(screen.getByText('+4')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/HeroStatsPanel.test.tsx src/components/EquipmentBonusStats.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`  
Expected: FAIL because neither component exists.

- [ ] **Step 3: Implement presentational components from existing snapshot fields**

```tsx
// EquipmentBonusStats.tsx
const percentageStats = new Set<EquipmentStatKey>([
  'criticalRate', 'criticalDamage', 'attackSpeed', 'damage', 'bossDamage', 'normalDamage',
]);

export function EquipmentBonusStats({ totals }: { readonly totals: EquipmentTotals }) {
  return <section className="equipment-bonus-panel" aria-label="Equipment bonuses">
    <h2>Equipment bonuses</h2><dl className="equipment-bonus-grid">
      {EQUIPMENT_STAT_KEYS.map((key) => <div key={key}><dt>{statLabels[key]}</dt>
        <dd>{totals[key] >= 0 ? '+' : ''}{totals[key]}{percentageStats.has(key) ? '%' : ''}</dd></div>)}
    </dl>
  </section>;
}
```

```tsx
export function HeroStatsPanel({ progression, equipment, levelUpMessage }: {
  readonly progression: ProgressionSnapshot | undefined;
  readonly equipment: EquipmentSnapshot | undefined;
  readonly levelUpMessage: string | null;
}) {
  if (!progression) return <p>Loading hero progression…</p>;
  const stats = equipment?.effectiveStats ?? progression.stats;
  const isMaxLevel = progression.level === 200;
  return <section className="hero-panel" aria-label="Hero progression">
    <div className="hero-level-row"><p>Level {progression.level} / 200</p><p>{isMaxLevel ? 'MAX' : `${progression.xp} / ${progression.xpToNextLevel} XP`}</p></div>
    <progress aria-label="Experience" max={isMaxLevel ? 1 : progression.xpToNextLevel} value={isMaxLevel ? 1 : progression.xp} />
    <dl className="hero-stats"><div><dt>ATK</dt><dd>{stats.attack}</dd></div><div><dt>DEF</dt><dd>{stats.defense}</dd></div><div><dt>HP</dt><dd>{stats.maxHp}</dd></div><div><dt>Total Power</dt><dd>{equipment?.heroPower ?? 0}</dd></div></dl>
    {levelUpMessage ? <p className="level-up-message" role="status">{levelUpMessage}</p> : null}
  </section>;
}
```

- [ ] **Step 4: Run focused verification and typecheck**

Run: `pnpm exec vitest run src/components/HeroStatsPanel.test.tsx src/components/EquipmentBonusStats.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1 && pnpm typecheck`  
Expected: 4 focused tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/HeroStatsPanel.tsx src/components/HeroStatsPanel.test.tsx src/components/EquipmentBonusStats.tsx src/components/EquipmentBonusStats.test.tsx
git commit -m "feat: add shared hero and equipment stat views"
```

## Task 3: Compose mounted Battle and Equipment panels in App

**Files:**
- Create: `src/components/BattleTab.tsx`
- Create: `src/components/EquipmentTab.tsx`
- Create: `src/components/EquipmentTab.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- `BattleTab` consumes `CampaignSnapshot | null`, `RefObject<HTMLDivElement | null>`, `serverBusy`, status/error data, and `onStartBreakthrough` / `onStartBoss` callbacks.
- `EquipmentTab` consumes `ProgressionSnapshot | undefined`, `EquipmentSnapshot | undefined`, selected item ID, and `onSelectItem`, `onEquipBest`, `onEquip(itemId)` callbacks.
- `App` owns `const [activeTab, setActiveTab] = useState<GameTab>('battle')` and renders both `role="tabpanel"` sections permanently.

- [ ] **Step 1: Write failing App and EquipmentTab tests**

```tsx
it('starts on Battle, switches to Equipment, and keeps the Phaser controller alive', () => {
  renderApp();
  expect(screen.getByRole('tab', { name: 'Battle' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: 'Battle' })).not.toHaveAttribute('hidden');

  fireEvent.click(screen.getByRole('tab', { name: 'Equipment' }));

  expect(screen.getByRole('tabpanel', { name: 'Equipment' })).not.toHaveAttribute('hidden');
  expect(screen.getByRole('tabpanel', { name: 'Battle', hidden: true })).toHaveAttribute('hidden');
  expect(battleGame.destroy).not.toHaveBeenCalled();
  expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
});

it('keeps an Equipment selection when switching away and back', () => {
  const item: EquipmentItem = { id: 'item-1', slot: 'Hat', level: 1, rarity: 'Normal', name: 'Royal Cap', mainStats: { attack: 1, defense: 0, maxHp: 0 }, substats: [], power: 1 };
  const state = createInitialPlayerSaveState();
  const recordWithItem: PlayerApiRecord = { ...record, state: { ...state, campaign: { ...state.campaign, equipment: { ...state.campaign.equipment, inventory: [item], nextItemNumber: 2 } } } };
  record = recordWithItem;
  renderApp();
  fireEvent.click(screen.getByRole('tab', { name: 'Equipment' }));
  fireEvent.click(screen.getByRole('button', { name: /Royal Cap/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Battle' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Equipment' }));
  expect(screen.getByRole('button', { name: /Royal Cap/ })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps equip callbacks typed and scoped to the selected item', () => {
  const controller = createEquipmentController(() => 0.5);
  controller.rollDrop('farming', 1);
  const equipment = controller.getSnapshot({ attack: 18, defense: 2, maxHp: 120 });
  const item = equipment.inventory[0]!;
  const onSelectItem = vi.fn();
  const onEquip = vi.fn();
  render(<EquipmentTab progression={progression} equipment={equipment} serverBusy={false} selectedItemId={item.id} onSelectItem={onSelectItem} onEquipBest={vi.fn()} onEquip={onEquip} dropMessage={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Equip selected' }));
  expect(onEquip).toHaveBeenCalledWith(item.id);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/App.test.tsx src/components/EquipmentTab.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`  
Expected: FAIL because tabs/panels and extracted components do not exist.

- [ ] **Step 3: Extract the existing markup without altering command logic**

```tsx
// App.tsx, directly after other UI state:
const [activeTab, setActiveTab] = useState<GameTab>('battle');

// App.tsx, after the header:
<GameNavigation activeTab={activeTab} onTabChange={setActiveTab} />
<section id="battle-panel" className="tab-panel" role="tabpanel" aria-labelledby="battle-tab" hidden={activeTab !== 'battle'}>
  <BattleTab snapshot={snapshot} hostRef={hostRef} serverBusy={serverBusy} statusLabel={statusLabel} error={error} levelUpMessage={levelUpMessage}
    onStartBreakthrough={() => void issueCommand({ type: 'startBreakthrough', expectedVersion: record.saveVersion })}
    onStartBoss={() => void issueCommand({ type: 'startBoss', expectedVersion: record.saveVersion })} />
</section>
<section id="equipment-panel" className="tab-panel" role="tabpanel" aria-labelledby="equipment-tab" hidden={activeTab !== 'equipment'}>
  <EquipmentTab progression={progression} equipment={equipment} serverBusy={serverBusy} selectedItemId={selectedItemId}
    onSelectItem={setSelectedItemId} onEquipBest={() => void issueCommand({ type: 'equipBest', expectedVersion: record.saveVersion })}
    onEquip={(itemId) => void issueCommand({ type: 'equip', expectedVersion: record.saveVersion, itemId })} dropMessage={dropMessage} />
</section>
```

Move the campaign panel, hero summary, battle card, and diagnostics into `BattleTab`. Move the equipment panel and its `EquipmentSummary`, item comparison, and drop-message rendering into `EquipmentTab`. Keep `hostRef`, the `createBattleGame` effect, visibility subscription, `issueCommand`, sync timer, and all `PlayerCommand` creation in `App`. Pass command-specific callbacks that preserve the existing payloads exactly:

```tsx
onStartBreakthrough={() => void issueCommand({ type: 'startBreakthrough', expectedVersion: record.saveVersion })}
onStartBoss={() => void issueCommand({ type: 'startBoss', expectedVersion: record.saveVersion })}
onEquipBest={() => void issueCommand({ type: 'equipBest', expectedVersion: record.saveVersion })}
onEquip={(itemId) => void issueCommand({ type: 'equip', expectedVersion: record.saveVersion, itemId })}
```

- [ ] **Step 4: Run focused verification and typecheck**

Run: `pnpm exec vitest run src/App.test.tsx src/components/EquipmentTab.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1 && pnpm typecheck`  
Expected: App lifecycle, tab switch, campaign command, equipment callback, and persistence-guard tests pass; TypeScript exits 0.

- [ ] **Step 5: Commit the task**

```bash
git add src/App.tsx src/App.test.tsx src/components/BattleTab.tsx src/components/EquipmentTab.tsx src/components/EquipmentTab.test.tsx
git commit -m "feat: split battle and equipment screens"
```

## Task 4: Responsive visual treatment and regression verification

**Files:**
- Create: `src/navigationStyles.test.ts`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- CSS classes consumed by earlier tasks: `game-navigation`, `is-active`, `tab-panel`, `equipment-bonus-panel`, and `equipment-bonus-grid`.
- The 639px breakpoint keeps existing mobile behaviour and adds only navigation/safe-area rules.

- [ ] **Step 1: Write failing CSS and regression tests**

```ts
import styles from './styles.css?raw';

it('defines the desktop navigation and active pixel-style treatment', () => {
  expect(styles).toMatch(/\.game-navigation\s*\{/);
  expect(styles).toMatch(/\.game-navigation .*\.is-active/);
  expect(styles).toMatch(/\.equipment-bonus-grid\s*\{/);
});

it('keeps mobile navigation fixed and reserves a safe bottom area', () => {
  const mobile = styles.slice(styles.indexOf('@media (max-width: 639px)'));
  expect(mobile).toMatch(/\.game-navigation\s*\{[\s\S]*position:\s*fixed/);
  expect(mobile).toMatch(/\.app-shell\s*\{[\s\S]*padding-bottom/);
});
```

Add an App regression assertion that the source still excludes `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, direct Supabase usage, and selected-tab URL logic.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/navigationStyles.test.ts src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`  
Expected: FAIL because the new navigation and bonus-grid styles are absent.

- [ ] **Step 3: Add focused CSS only**

```css
.game-navigation { display: flex; justify-content: center; }
.game-navigation [role="tablist"] { display: grid; width: min(100%, 32rem); grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.game-navigation [role="tab"] { min-height: 44px; border: 2px solid rgb(231 202 131 / 45%); border-radius: 10px; color: #d9e2f5; background: #101a33; font: inherit; font-weight: 850; cursor: pointer; }
.game-navigation [role="tab"].is-active { border-color: #fff1bd; color: #101a33; background: #ffd66b; box-shadow: inset 0 -3px 0 rgb(87 67 22 / 45%); }
.tab-panel[hidden] { display: none; }
.equipment-bonus-panel { display: grid; gap: 10px; padding: clamp(14px, 3vw, 20px); border: 1px solid rgb(231 202 131 / 35%); border-radius: 14px; background: rgb(24 34 62 / 92%); }
.equipment-bonus-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }

@media (max-width: 639px) {
  .app-shell { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
  .game-navigation { position: fixed; right: 0; bottom: 0; left: 0; z-index: 10; padding: 8px 16px calc(8px + env(safe-area-inset-bottom)); }
  .equipment-bonus-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

Use concrete project colours (`#101a33`, `#ffd66b`, `#fff1bd`, and existing translucent navy surfaces) rather than adding a dependency or a new theme system. Do not use transitions that violate the existing reduced-motion rule.

- [ ] **Step 4: Run complete automated verification**

Run: `pnpm test && pnpm typecheck && pnpm build && git diff --check origin/main..HEAD`  
Expected: all tests pass, TypeScript exits 0, Vite production build exits 0, and `git diff --check` produces no output. Record any pre-existing Vite chunk-size advisory without treating it as a failure.

- [ ] **Step 5: Perform manual visual QA**

Run: `pnpm dev -- --host 127.0.0.1`  
Expected: the local app serves successfully. Verify at desktop and 390px-wide mobile viewport:

1. Battle is the initial tab and has campaign controls, hero summary, canvas, and diagnostics.
2. Equipment displays the same hero summary, all eleven bonus rows, slots, inventory, and comparison.
3. The mobile tab bar remains visible without covering the last Equipment control.
4. Switching tabs does not recreate the Phaser canvas, stop the status from running, or lose the selected item.
5. Keyboard focus reaches both tabs and the active state is announced correctly.

- [ ] **Step 6: Commit the task**

```bash
git add src/styles.css src/navigationStyles.test.ts src/App.test.tsx
git commit -m "style: add responsive battle navigation"
```

## Final delivery checklist

- [ ] Re-read `docs/superpowers/specs/2026-07-18-navigation-ui-design.md` and verify every Goal, Scope, UX, architecture, data-flow, and non-goal item is covered by Tasks 1–4.
- [ ] Request a fresh code review for `origin/main..HEAD`; fix all critical and important findings before publication.
- [ ] Verify the working tree is clean and that the branch can fast-forward from the current `origin/main`.
- [ ] Push the reviewed commits, merge only with the user-approved integration method, and verify the deployed Vercel page serves the new UI.
- [ ] Production QA: sign in with an authorized test account, exercise both tabs, start a Breakthrough or Boss action from Battle, select/equip an item in Equipment, and confirm the battle remains active after switching views.
