# RoyalStory Milstolpe 2: Stages och bossar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ge RoyalStory en komplett och originalskriven 36-kapitelskampanj med farming, breakthrough, bossar och ett verifierbart avslutningsläge.

**Architecture:** En ren `campaignController` äger kapitel- och mötesövergångar och komponerar den befintliga `combatEngine` per möte. En skrivskyddad kapitelkatalog äger originalinnehåll och balans. Phaser läser kampanjens snapshot för att rita striden, medan React visar status och skickar de enda två tillåtna kommandona.

**Tech Stack:** TypeScript 5, React 19, Phaser 3, Vitest 3, Testing Library, Vite 7.

## Global Constraints

- Implementera enbart Milstolpe 2; lägg inte till XP, levels, valutor, utrustning, skills, sparning, konton eller offline-progress.
- Behåll Ari som fördefinierad testkaraktär och all befintlig synlighetspausfunktionalitet.
- Använd 36 originalskrivna kapitel, fiender, bossar och kodritade Phaser-visuals; importera inga externa bildresurser och använd inga namn eller figurer från andra spel.
- Endast `farming`, `breakthrough`, `boss-ready`, `boss` och `campaign-complete` får vara kampanjlägen.
- Ogiltiga kommandon och dubbeltryckningar är idempotenta och får inte ändra state.
- Ingen del av spelet får använda `localStorage`, `sessionStorage`, `IndexedDB`, cookies eller filsystemet för kampanjdata; sidomladdning börjar om från kapitel 1.
- Samtliga nya spelvärden ligger i en central kampanjdefinitionsmodul; stridsmotorn får inte bero på React, Phaser eller DOM.
- Använd test-first: varje produktionsändring börjar med ett test som först observeras falla.
- Kör `& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'` om `pnpm` saknas på PATH.
- Efter varje avslutad och verifierad uppgift: committa och pusha till `Kfnmp4h/royalstory`.

---

## Planerad filstruktur

```text
src/
  game/
    campaign/
      campaignTypes.ts          # Publika kampanj- och möteskontrakt
      campaignDefinitions.ts    # 36 kapitel, originalnamn och central balans
      campaignDefinitions.test.ts
      campaignController.ts     # Ren state machine ovanpå combatEngine
      campaignController.test.ts
      campaignJourney.test.ts   # Deterministisk simulering kapitel 1–36
    phaser/
      BattleScene.ts            # Renderar CampaignSnapshot och egna kapitelteman
      battleGame.ts              # Phaser-fasad som exponerar kampanjkommandon
      battleGame.test.ts
  App.tsx                        # Kampanjpanel och kommandoknappar
  App.test.tsx
  styles.css
README.md
```

## Delade kontrakt

```ts
export type CampaignMode =
  | 'farming'
  | 'breakthrough'
  | 'boss-ready'
  | 'boss'
  | 'campaign-complete';

export type EncounterKind = 'farming' | 'breakthrough' | 'boss';

export interface EncounterVisual {
  name: string;
  color: number;
  accentColor: number;
  scale: number;
}

export interface EncounterDefinition {
  kind: EncounterKind;
  visual: EncounterVisual;
  balance: CombatBalance;
}

export interface ChapterDefinition {
  number: number;
  name: string;
  backgroundColor: number;
  farming: EncounterDefinition;
  breakthrough: EncounterDefinition;
  boss: EncounterDefinition;
}

export interface CampaignSnapshot {
  mode: CampaignMode;
  chapter: ChapterDefinition;
  unlockedChapter: number;
  encounter: EncounterDefinition | null;
  combat: CombatSnapshot | null;
}

export interface CampaignController {
  advance(elapsedMs: number): CombatEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  startBreakthrough(): void;
  startBoss(): void;
  getSnapshot(): CampaignSnapshot;
}

export function createCampaignController(
  chapters?: readonly ChapterDefinition[],
): CampaignController;
```

### Task 1: Definiera kapitelkatalog och publika kampanjkontrakt

**Files:**
- Create: `src/game/campaign/campaignTypes.ts`
- Create: `src/game/campaign/campaignDefinitions.ts`
- Create: `src/game/campaign/campaignDefinitions.test.ts`

**Interfaces:**
- Consumes: `CombatBalance` från `src/game/types.ts` och `COMBAT_BALANCE` från `src/game/balance.ts`.
- Produces: samtliga kontrakt ovan, `CHAPTERS`, `getChapter(number)`, och `createEncounterBalance(chapter, kind)`.

- [ ] **Step 1: Skriv de fallerande katalogtesterna**

```ts
import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter } from './campaignDefinitions';

describe('CHAPTERS', () => {
  it('contains 36 ordered original chapters with every encounter type', () => {
    expect(CHAPTERS).toHaveLength(36);
    expect(CHAPTERS.map((chapter) => chapter.number)).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
    expect(CHAPTERS[0]).toMatchObject({
      name: 'Whisperwood',
      farming: { kind: 'farming' },
      breakthrough: { kind: 'breakthrough' },
      boss: { kind: 'boss' },
    });
    expect(CHAPTERS.at(-1)?.name).toBe('Lightrest Summit');
  });

  it('returns immutable encounter values and rejects invalid chapter numbers', () => {
    const chapter = getChapter(12);
    expect(Object.isFrozen(chapter)).toBe(true);
    expect(chapter.boss.balance.enemy.maxHp).toBeGreaterThan(chapter.farming.balance.enemy.maxHp);
    expect(() => getChapter(0)).toThrow('Unknown chapter: 0');
    expect(() => getChapter(37)).toThrow('Unknown chapter: 37');
  });
});
```

- [ ] **Step 2: Kör testet och bekräfta den förväntade modulupplösningsförlusten**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/game/campaign/campaignDefinitions.test.ts
```

Expected: FAIL eftersom `campaignDefinitions` saknas.

- [ ] **Step 3: Implementera kontrakt och central katalog**

Skapa `campaignTypes.ts` med de delade kontrakten. I `campaignDefinitions.ts`, använd exakt denna kapitelordning:

```ts
const CHAPTER_NAMES = [
  'Whisperwood', 'Lantern Marsh', 'Bramble Burrow', 'Sunroot Grove',
  'Ember Ridge', 'Tideglass Shore', 'Moonmoss Hollow', 'Copper Canopy',
  'Mistbell Fen', 'Starfall Orchard', 'Thornwake Vale', 'Cinderpine Pass',
  'Gilded Thicket', 'Cloudfern Rise', 'Hollowbloom Garden', 'Crystalfall Grotto',
  'Galevine Cliffs', 'Silverreed Basin', 'Ashenwild Trail', 'Wispwater Crossing',
  'Verdant Spire', 'Duskpetal Fields', 'Saffron Hollow', 'Lumenwood Run',
  'Stormcap Heights', 'Mossfire Glade', 'Rainsong Ravine', 'Brightbriar Wilds',
  'Twilight Copse', 'Kingshade Vale', 'Auroroot Terrace', 'Frostfern Reach',
  'Dawnspark Basin', 'Crownleaf Sanctuary', 'Radiant Keep', 'Lightrest Summit',
] as const;

const makeBalance = (chapter: number, kind: EncounterKind): CombatBalance => {
  const multiplier = kind === 'farming' ? 1 : kind === 'breakthrough' ? 2 : 3;
  return Object.freeze({
    ...COMBAT_BALANCE,
    player: Object.freeze({ ...COMBAT_BALANCE.player }),
    enemy: Object.freeze({
      id: 'enemy',
      name: '',
      maxHp: 72 + chapter * 6 * multiplier,
      damage: 2 + Math.floor(chapter / 12),
      attackIntervalMs: 1_300,
    }),
  });
};
```

Derivera egna fiendenamn från kapitelnamnet (`Whisperwood Sprig`, `Whisperwood Warden`), färger från ett återkommande eget färgspann och `scale: 1` för farming/breakthrough respektive `scale: 1.3` för boss. Frys varje kapitel, varje möte och arrayen. `getChapter` ska kasta `new Error(\`Unknown chapter: ${number}\`)` när numret saknas.

- [ ] **Step 4: Kör katalogtestet och hela befintliga sviten**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/game/campaign/campaignDefinitions.test.ts
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
```

Expected: PASS; 36 kapitel och äldre Milstolpe 1-tester är gröna.

- [ ] **Step 5: Commit och push**

```powershell
git add src/game/campaign/campaignTypes.ts src/game/campaign/campaignDefinitions.ts src/game/campaign/campaignDefinitions.test.ts
git commit -m "feat: define RoyalStory campaign chapters"
git push
```

### Task 2: Implementera den rena kampanj-state-motorn

**Files:**
- Create: `src/game/campaign/campaignController.ts`
- Create: `src/game/campaign/campaignController.test.ts`

**Interfaces:**
- Consumes: `createCombatEngine`, `CHAPTERS`, `getChapter`, och kampanjkontrakten från Task 1.
- Produces: `createCampaignController(): CampaignController`.

- [ ] **Step 1: Skriv fallerande övergångstester**

```ts
import { describe, expect, it } from 'vitest';
import { createCampaignController } from './campaignController';

describe('createCampaignController', () => {
  it('starts in chapter one farming and permits exactly one breakthrough command', () => {
    const campaign = createCampaignController();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', unlockedChapter: 1, chapter: { number: 1 } });
    campaign.startBreakthrough();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'breakthrough', encounter: { kind: 'breakthrough' } });
    campaign.startBreakthrough();
    expect(campaign.getSnapshot().mode).toBe('breakthrough');
  });

  it('returns a failed breakthrough to farming and a won breakthrough to boss-ready', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    campaign.advance(200_000);
    expect(['farming', 'boss-ready']).toContain(campaign.getSnapshot().mode);
  });

  it('does not advance combat or campaign while paused', () => {
    const campaign = createCampaignController();
    campaign.pause();
    campaign.advance(60_000);
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', combat: { activeRuntimeMs: 0, paused: true } });
  });

  it('rejects malformed campaign definitions before a battle starts', () => {
    expect(() => createCampaignController([])).toThrow('Campaign must contain 36 ordered chapters');
  });
});
```

Add a deterministic helper in the test that calls `advance(100)` until a requested mode appears; use it to assert breakthrough win → `boss-ready`, boss win → chapter 2 farming, boss loss → chapter 1 farming, and final boss win → `campaign-complete`.

- [ ] **Step 2: Kör testet och bekräfta saknad kontrollermodul**

Run: `pnpm test -- src/game/campaign/campaignController.test.ts`

Expected: FAIL resolving `./campaignController`.

- [ ] **Step 3: Implementera state machine utan UI-beroenden**

Implementera dessa regler exakt:

```ts
const activeModes: ReadonlySet<CampaignMode> = new Set(['farming', 'breakthrough', 'boss']);

const startEncounter = (definition: EncounterDefinition, nextMode: CampaignMode) => {
  encounter = definition;
  engine = createCombatEngine(definition.balance);
  mode = nextMode;
};

const returnToFarming = () => startEncounter(chapter.farming, 'farming');
```

`advance` delegerar bara till motorn när `activeModes.has(mode)`. För `farming` ignoreras fiendedöd, så samma fiende återuppstår enligt combatEngine. För `breakthrough` gäller `death enemy` som seger och sätter `mode = 'boss-ready'`; `death player` ersätter mötet med farming. För `boss` gäller `death enemy` som seger: kapitel 1–35 ökar `unlockedChapter`, väljer nästa kapitel och startar farming, medan kapitel 36 sätter `mode = 'campaign-complete'` och `encounter = null`. `death player` återställer farming. `startBreakthrough` och `startBoss` returnerar tidigt i fel läge.

`createCampaignController(chapters = CHAPTERS)` måste före första mötet kontrollera exakt 36 kapitel, ordningen 1–36 samt alla tre mötesdefinitioner; annars kastar den `new Error('Campaign must contain 36 ordered chapters')`. `getSnapshot` returnerar nya objekt men refererar till de frysta definitionerna. `pause`/`resume` delegerar alltid till den aktuella motorn när ett möte finns; avslutad kampanj returnerar tomma händelser.

- [ ] **Step 4: Kör enhets- och regressionssviten**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/game/campaign/campaignController.test.ts
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
```

Expected: PASS; kampanjkommandon är idempotenta och pausad tid ändrar inte state.

- [ ] **Step 5: Commit och push**

```powershell
git add src/game/campaign/campaignController.ts src/game/campaign/campaignController.test.ts
git commit -m "feat: add deterministic campaign controller"
git push
```

### Task 3: Koppla kampanjen till Phaser-scenen

**Files:**
- Modify: `src/game/phaser/battleGame.ts`
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `CampaignController`, `CampaignSnapshot`, och `EncounterVisual` från Task 2.
- Produces: `BattleController.startBreakthrough(): void`, `BattleController.startBoss(): void`, och `BattleStatus { snapshot: CampaignSnapshot; state: 'running' | 'paused' }`.

- [ ] **Step 1: Utöka Phaser-fasadtestet först**

```ts
expect(() => controller.startBreakthrough()).not.toThrow();
expect(setCampaignCommand).toHaveBeenLastCalledWith('breakthrough');
expect(() => controller.startBoss()).not.toThrow();
expect(setCampaignCommand).toHaveBeenLastCalledWith('boss');
```

Mocka `BattleScene.prototype.startBreakthrough` och `BattleScene.prototype.startBoss` som `setCampaignCommand`-spioner. Uppdatera mockad status till en kampanjsnapshot med `mode`, `chapter`, `encounter`, och `combat`.

- [ ] **Step 2: Kör testet och bekräfta att de nya metoderna saknas**

Run: `pnpm test -- src/game/phaser/battleGame.test.ts`

Expected: FAIL eftersom `BattleController` och `BattleScene` saknar kampanjkommandon.

- [ ] **Step 3: Byt scenens ägda motor mot en kampanjkontroller**

I `BattleScene`, skapa `private readonly campaign = createCampaignController()` och ersätt alla direkta `engine`-anrop med `campaign`. Använd `campaign.getSnapshot()` för status. Implementera:

```ts
startBreakthrough(): void {
  this.campaign.startBreakthrough();
  this.renderCampaign(this.campaign.getSnapshot());
  this.publishStatus();
}

startBoss(): void {
  this.campaign.startBoss();
  this.renderCampaign(this.campaign.getSnapshot());
  this.publishStatus();
}
```

`renderCampaign` ska känna igen ett ändrat `encounter.visual.name`, förstöra föregående fiendekontainer och hälsografik, rita om fienden med `visual.color`, `visual.accentColor`, `visual.scale` och namn, och ändra scenens bakgrund med kapitlets `backgroundColor`. Bossar måste bli visuellt större än farming-fiender. Återanvänd Ari och befintliga skadesiffror/animationer. När `campaign-complete` visas en centrerad text `Lightrest Summit restored` och inga fler `advance`-anrop ändrar scenen.

I `battleGame.ts`, vidarebefordra nya kontrollerkommandon till den registrerade `battleScene`-instansen och behåll den befintliga säkra pause-before-Phaser-pause-ordningen.

- [ ] **Step 4: Kör Phaser-regressioner**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/game/phaser/battleGame.test.ts
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
```

Expected: PASS; Phaser-fasaden skickar rätt kampanjkommando och tidigare lifecycle-test fortsätter passera.

- [ ] **Step 5: Commit och push**

```powershell
git add src/game/phaser/BattleScene.ts src/game/phaser/battleGame.ts src/game/phaser/battleGame.test.ts
git commit -m "feat: render campaign encounters in Phaser"
git push
```

### Task 4: Visa kampanjstatus och kommandon i React

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: den utökade `BattleStatus` och `BattleController` från Task 3.
- Produces: responsiv kampanjpanel med tillgänglig breakthrough- eller bosskontroll.

- [ ] **Step 1: Skriv de fallerande UI-testerna**

```tsx
it('shows chapter farming and starts a breakthrough from the campaign control', () => {
  render(<App />);
  expect(screen.getByText('Chapter 1 / 36')).toBeInTheDocument();
  expect(screen.getByText('Whisperwood')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));
  expect(battleGame.startBreakthrough).toHaveBeenCalledOnce();
});

it('shows the boss action only after a breakthrough win', () => {
  render(<App />);
  act(() => callbacks.onStatus(bossReadyStatus));
  expect(screen.getByRole('button', { name: 'Challenge boss' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Start breakthrough' })).not.toBeInTheDocument();
});

it('has no persistence APIs in the application source', async () => {
  const source = await import('./App?raw');
  expect(source.default).not.toMatch(/localStorage|sessionStorage|indexedDB|document\\.cookie/);
});
```

Add `startBreakthrough` and `startBoss` mocks to the current `battleGame` hoist. Define `bossReadyStatus` with `mode: 'boss-ready'`, `chapter.number: 1`, and `combat` snapshot from the current running fixture.

- [ ] **Step 2: Kör UI-testet och observera saknade kampanjfält**

Run: `pnpm test -- src/App.test.tsx`

Expected: FAIL eftersom den gamla statusen inte innehåller `snapshot.mode` eller `snapshot.chapter`.

- [ ] **Step 3: Implementera en tillgänglig kampanjpanel och responsiv CSS**

I `App.tsx`, härled `campaign = status?.snapshot` och rendera en `<section aria-label="Campaign progress">` före battle-kortet. Visa `Chapter {chapter.number} / 36`, namn, ett mötesnamn och en kort fast instruktion per mode. Rendera bara en knapp:

```tsx
{campaign?.mode === 'farming' ? (
  <button type="button" onClick={() => controllerRef.current?.startBreakthrough()}>
    Start breakthrough
  </button>
) : campaign?.mode === 'boss-ready' ? (
  <button type="button" onClick={() => controllerRef.current?.startBoss()}>
    Challenge boss
  </button>
) : null}
```

Utöka `BattleController`-mockkontraktet i testet. I CSS, lägg till `.campaign-panel` med hög kontrast, `display: grid`, en knapp på minst `44px` höjd och en mobilregel som behåller panelen inom sidans bredd. Behåll den befintliga diagnostiken som ren testinformation, men byt etiketten `Defeated Mosslings` till `Defeated enemies`.

- [ ] **Step 4: Kör UI-, typ- och byggverifiering**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/App.test.tsx
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' typecheck
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
```

Expected: PASS; kampanjpanelen skapar inte en andra Phaser-instans och saknar lagrings-API:er.

- [ ] **Step 5: Commit och push**

```powershell
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add campaign controls to battle UI"
git push
```

### Task 5: Verifiera den kompletta 36-kapitelsresan och dokumentera den

**Files:**
- Create: `src/game/campaign/campaignJourney.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `createCampaignController` från Task 2.
- Produces: deterministiskt acceptanstest för Milstolpe 2 och uppdaterade körinstruktioner.

- [ ] **Step 1: Skriv det fallerande acceptanstestet**

```ts
import { describe, expect, it } from 'vitest';
import { createCampaignController } from './campaignController';

const advanceUntil = (campaign: ReturnType<typeof createCampaignController>, predicate: () => boolean) => {
  for (let tick = 0; tick < 20_000 && !predicate(); tick += 1) campaign.advance(100);
  expect(predicate()).toBe(true);
};

describe('campaign journey', () => {
  it('lets the deterministic test profile complete chapters 1 through 36', () => {
    const campaign = createCampaignController();
    for (let chapter = 1; chapter <= 36; chapter += 1) {
      campaign.startBreakthrough();
      advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
      campaign.startBoss();
      advanceUntil(campaign, () => campaign.getSnapshot().mode !== 'boss');
      const snapshot = campaign.getSnapshot();
      if (chapter < 36) expect(snapshot).toMatchObject({ mode: 'farming', chapter: { number: chapter + 1 } });
    }
    expect(campaign.getSnapshot().mode).toBe('campaign-complete');
  });
});
```

- [ ] **Step 2: Kör testet och bekräfta att den fulla resan ännu inte är implementerad**

Run: `pnpm test -- src/game/campaign/campaignJourney.test.ts`

Expected: FAIL tills controller och katalog klarar samtliga 36 övergångar.

- [ ] **Step 3: Lägg till dokumentation utan sparningspåståenden**

Ersätt Milstolpe 1-funktionslistan i `README.md` med en Milstolpe 2-lista som nämner 36 originalkapitel, farming, breakthrough, bossutmaningar, original kodritade visuals och att omladdning återställer testprofilen. Lägg till raden: `RoyalStory stores no campaign data locally in Milestone 2.` Behåll kommandona `pnpm test`, `pnpm typecheck`, och `pnpm build`.

- [ ] **Step 4: Kör slutlig verifiering**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' typecheck
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
git diff --check
```

Expected: alla tester, typkontroll, bygge och diffkontroll passerar. Kontrollera också manuellt i browsern att 360 px bred vy inte får horisontell rullning, att kampanjknappen växlar efter breakthrough och att dold/synlig flik pausar/återupptar utan progression under pausen.

- [ ] **Step 5: Commit och push**

```powershell
git add src/game/campaign/campaignJourney.test.ts README.md
git commit -m "test: verify complete RoyalStory campaign journey"
git push
```
