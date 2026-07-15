# RoyalStory Milstolpe 3: progression

## Syfte

Milstolpe 3 ska göra den befintliga testkaraktären starkare genom automatisk XP, level-up och statskalning. En uppgradering ska påverka pågående och kommande strider direkt och deterministiskt.

Milstolpen omfattar XP, level 1–200, ATK, DEF, max-HP, central balansdata och en kompakt progressionsvy. Den omfattar inte skills, utrustning, valutor, konton, serversparning, offline-progress eller lokal persistens.

## Vald arkitektur

Progression byggs som en fristående, ren TypeScript-modul. Den äger spelarens level, XP och härledda grundstats men känner inte till React eller Phaser.

Kampanjkontrollern samordnar progression och strid:

1. Ett besegrat monster ger XP exakt en gång utifrån kapitel och mötestyp.
2. Progressionsmodulen använder XP:n, genomför alla level-ups och behåller överflödig XP.
3. Kampanjkontrollern applicerar nya stats på den aktiva stridsmotorn.
4. När ett nytt farming-, breakthrough- eller bossmöte skapas används alltid spelarens aktuella stats.
5. Kampanjsnapshoten innehåller en fryst progressionssnapshot som React kan visa.

Progression läggs inte i kampanj- eller stridsmotorns interna state. Modulerna kommunicerar genom tydliga snapshots och kommandon så att skills och utrustning senare kan bidra med egna statkällor utan att level-systemet behöver skrivas om.

## Progressionsmodell

Den publika snapshoten innehåller:

- `level`: heltal mellan 1 och 200.
- `xp`: aktuell XP inom nivån.
- `xpToNextLevel`: XP som krävs för nästa nivå; `0` vid level 200.
- `totalXp`: all giltig XP som har tjänats in upp till leveltaket.
- `stats`: `attack`, `defense` och `maxHp`.

Level-up sker automatiskt. En stor XP-belöning kan ge flera levels i samma uppdatering. Överflödig XP följer med till nästa nivå. Vid level 200 stannar `xp` och `xpToNextLevel` på `0`; ytterligare XP ändrar inte snapshoten.

Progressionsmodulen tar endast emot ändlig, positiv heltals-XP. Noll, negativa tal, decimaler, `NaN` och oändliga värden avvisas utan stateändring.

## Central balans

Balans organiseras i frysta, domänspecifika moduler som återexporteras från en gemensam ingång. Progressionsmodulen innehåller level- och XP-kurvor, medan befintlig strids- och fiendebalans flyttas bakom samma centrala ingång. Den första testkurvan är:

- Maxlevel: `200`.
- Level 1: `18 ATK`, `2 DEF`, `120 max-HP`.
- Per level: `+2 ATK`, `+1 DEF`, `+8 max-HP`.
- XP till nästa level: `50 + (level - 1) × 25`.
- Farming-XP: `10 + (chapter - 1) × 2`.
- Breakthrough-XP: `40 + (chapter - 1) × 8`.
- Boss-XP: `100 + (chapter - 1) × 20`.

Formlerna returnerar heltal och valideras för samtliga levels 1–200 och kapitel 1–36. Kampanjens befintliga fiendevärden fortsätter vara centralt definierade.

Den centrala ingången innehåller även beslutad utrustningsmetadata: `14` platser, item level `1–200` och rariteterna Normal, Rare, Epic, Unique och Legendary i den ordningen. Milstolpe 3 genererar eller utrustar inga föremål; huvudstatsintervall och rarity-multiplikatorer införs tillsammans med det faktiska utrustningssystemet i Milstolpe 5, eftersom produktkravet uttryckligen lämnar dessa värden ospecificerade tills dess.

## Stridsintegration

ATK ersätter spelarens nuvarande fasta skadevärde. DEF läggs till stridsmodellens combatant-kontrakt. Deterministisk grundskada blir:

`max(1, attacker.attack - defender.defense)`

Fiender får `0 DEF` i Milstolpe 3, men fältet finns i den centrala mötesbalansen så framtida balans inte kräver ett nytt stridskontrakt.

När spelaren levlar under en aktiv strid uppdateras ATK och DEF före nästa attack. Max-HP höjs omedelbart, och aktuell HP ökar med exakt samma delta som max-HP ökade. Level-up är därför inte en full läkning och kan inte sänka aktuell HP. Attacktimers, fiendens HP, pausstatus och räknare bevaras.

XP delas ut för fiendedöd i farming, breakthrough och boss. Spelardöd ger ingen XP. En redan behandlad död eller pausad tid kan inte ge dubbla belöningar. Vid Sentinel- eller bossvinst appliceras XP och eventuella level-ups innan nästa möte skapas, så det nya mötet alltid använder de nya statsen.

## UI och återkoppling

Den befintliga spelvyn får en kompakt Hero-panel som visar:

- `Level N / 200`.
- Aktuell XP och XP till nästa level samt en tillgänglig progressbar.
- ATK, DEF och max-HP.

Panelen uppdateras från kampanjsnapshoten utan att skapa en andra spelinstans. Vid level-up visas ett kort meddelande, `Level N reached`, och det senaste värdet ersätter ett äldre meddelande om flera levels nås snabbt. Meddelandet försvinner automatiskt. Striden och kampanjknapparna fortsätter fungera medan panelen visas.

Vid level 200 visar panelen `MAX` i stället för nästa XP-krav och progressbaren är full.

## Felhantering och gränser

- Ogiltig progression- eller balansdata avvisas innan en kampanj startar.
- Publika snapshots är nya yttre objekt och får inte ge konsumenter möjlighet att mutera intern state.
- Progression ändras endast av validerade fiendedödar från den auktoritativa kampanjkontrollern.
- Dold eller pausad flik får varken flytta stridstid eller dela ut XP.
- Omladdning återställer testprofilen till level 1; ingen `localStorage`, `sessionStorage`, IndexedDB, cookie eller filbaserad sparning används.
- Ingen XP, level eller stat kan överskrida de centrala gränserna.

## Teststrategi

Unit tests ska bevisa:

- Startsnapshot, varje statformel och XP-krav för gränsvärdena level 1 och 200.
- En level-up, flera samtidiga level-ups, överflödig XP och exakt leveltak.
- Avvisning av ogiltig XP utan mutation.
- DEF-formeln och minsta skada `1`.
- Liveuppdatering av ATK, DEF och max-HP med bevarade timers, fiende-HP, pausstatus och räknare.

Integrationstester ska bevisa:

- Farming-, breakthrough- och bossdöd ger rätt XP exakt en gång.
- Spelardöd och pausad tid ger ingen XP.
- Level-up påverkar nästa attack och kan ändra utgången av en strid.
- Sentinel-/bossövergångar skapar nästa möte med uppdaterade stats.
- Den fullständiga 36-kapitelsresan fungerar fortfarande.
- React visar level, XP, ATK, DEF, max-HP, level-up-meddelande och leveltaket korrekt.
- Phaser behåller samma scen och fortsätter animera medan progressionssnapshoten ändras.

Slutverifieringen omfattar hela testsuiten, TypeScript-kontroll, produktionsbygge, diffkontroll och en källkodssökning som bekräftar att ingen lokal persistens har lagts till.

## Klart när

Milstolpe 3 är klar när den fördefinierade testkaraktären kan tjäna XP från alla tre mötestyper, levla deterministiskt upp till level 200 och omedelbart få högre ATK, DEF och max-HP som förändrar stridsresultatet, samtidigt som all progression förblir minnesbaserad och hela kampanjresan fortsätter fungera.
