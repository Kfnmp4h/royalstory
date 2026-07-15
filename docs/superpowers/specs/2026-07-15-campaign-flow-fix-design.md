# RoyalStory: fix för breakthrough- och bossflöde

## Syfte

Åtgärda GitHub issue #1 så att farming fortsätter när en Sentinel har besegrats. Bossupplåsning ska vara separat från det aktiva kampanjläget.

## Modell

`CampaignMode` innehåller endast `farming`, `breakthrough`, `boss` och `campaign-complete`. Det tidigare inaktiva läget `boss-ready` tas bort.

`CampaignSnapshot` får `bossUnlocked: boolean`. Det beskriver om kapitlets boss kan startas medan farming fortsätter i bakgrunden.

## Regler

- Nytt kapitel börjar i `farming` med `bossUnlocked: false`.
- `startBreakthrough()` fungerar endast i farming när bossen inte är upplåst.
- Sentinel-vinst sätter `bossUnlocked: true` och startar om samma kapitels farming-möte.
- Sentinel-förlust sätter `bossUnlocked: false` och startar om samma kapitels farming-möte.
- `startBoss()` fungerar endast i farming när `bossUnlocked` är true.
- Bossförlust behåller `bossUnlocked: true` och startar om samma kapitels farming-möte.
- Bossvinst i kapitel 1–35 låser nästa kapitel, återställer `bossUnlocked: false` och startar nästa kapitels farming-möte.
- Bossvinst i kapitel 36 går till `campaign-complete` med `encounter` och `combat` satta till `null`.
- Ogiltiga startkommandon ändrar aldrig state.
- Pausad tid får inte ändra kampanj- eller stridsstate.

## UI och rendering

- I farming utan upplåst boss visas **Start breakthrough**.
- I farming med upplåst boss visas **Challenge boss** och en status som förklarar att bossen är upplåst medan farming fortsätter.
- Phaser fortsätter rita farming-fienden efter Sentinel-vinst och växlar till boss först när spelaren startar bossutmaningen.

## Testning

Regressionstester ska täcka Sentinel-vinst/förlust, bossförlust/vinst, idempotenta kommandon, fortsatt farming efter Sentinel-vinst, React-knappens rätta etikett samt att den fullständiga 36-kapitelsresan fortfarande når `campaign-complete`.

Ingen lokal persistens, inga externa tillgångar och inga Milstolpe 3-system läggs till i fixen.
