# RoyalStory Milstolpe 2: Stages och bossar – designspecifikation

## Syfte

Bygg en komplett, testbar kampanj med 36 kapitel ovanpå Milstolpe 1:s automatiska stridsmotor. Spelaren farmar i ett kapitel, startar ett valfritt breakthrough, utmanar därefter kapitlets boss och låser upp nästa kapitel vid seger. En balanserad testprofil ska kunna slutföra kapitel 1–36 utan utvecklargenvägar i gränssnittet.

Milstolpen innehåller inte XP, nivåer, valutor, utrustning, skills, sparning, konton eller offline-belöningar.

## Produktregler

- Farming är det normala aktiva läget och fortsätter automatiskt mot samma vanliga fiende.
- Knappen **Starta breakthrough** är tillgänglig endast under farming.
- Ett vunnet breakthrough gör bossutmaningen tillgänglig i samma kapitel.
- Knappen **Utmana bossen** är tillgänglig endast efter ett vunnet breakthrough.
- En breakthrough- eller bossförlust återställer farming i samma kapitel. Inget kapitel låses eller förloras.
- En bossvinst låser upp nästa kapitel och startar farming där direkt.
- Efter seger över kapitel 36:s boss visas ett permanent avslutningsläge. Ingen ny strid startas automatiskt.
- Pågående möten kan inte startas igen via ett andra knapptryck.
- Befintlig synlighetspaus fortsätter gälla: dold flik för inte fram strid eller kampanjläge.

## Originalinnehåll

Allt innehåll är originalskrivet och kodritat. Inga namn, figurer, miljöer eller resurser från MapleStory eller andra spel används.

Kapitlen är: Whisperwood, Lantern Marsh, Bramble Burrow, Sunroot Grove, Ember Ridge, Tideglass Shore, Moonmoss Hollow, Copper Canopy, Mistbell Fen, Starfall Orchard, Thornwake Vale, Cinderpine Pass, Gilded Thicket, Cloudfern Rise, Hollowbloom Garden, Crystalfall Grotto, Galevine Cliffs, Silverreed Basin, Ashenwild Trail, Wispwater Crossing, Verdant Spire, Duskpetal Fields, Saffron Hollow, Lumenwood Run, Stormcap Heights, Mossfire Glade, Rainsong Ravine, Brightbriar Wilds, Twilight Copse, Kingshade Vale, Auroroot Terrace, Frostfern Reach, Dawnspark Basin, Crownleaf Sanctuary, Radiant Keep, and Lightrest Summit.

Varje kapitel definierar en originell farming-fiende och en originell boss. Deras namn, färgtema och beskrivningar ägs av den centrala kapitelkatalogen. Fiendeformer ritas med Phaser-primitiver och text; inga importerade bildfiler behövs.

## Arkitektur

### Ansvarsgränser

- `combatEngine` fortsätter vara en ren och återanvändbar motor för attackintervall, skada, död, återupplivning och paus.
- `campaignDefinitions` innehåller de 36 kapitlens skrivskyddade data och all Milstolpe 2-balans.
- `campaignController` äger kampanjläget, skapar rätt stridsmöte, tar emot stridens händelser och exponerar en immutabel kampanjsnapshot.
- Phaser-scenen ritar den aktuella fienden, bakgrunden och stridsfeedbacken från snapshots och händelser.
- React visar kampanjstatus, tillgängliga kommandon och kampanjfel samt skickar användarens kommandon till kampanjkontrollern.

### Kampanjlägen

`farming`, `breakthrough`, `boss-ready`, `boss`, och `campaign-complete` är de enda tillåtna kampanjlägena.

Kampanjkontrollern exponerar `advance`, `pause`, `resume`, `startBreakthrough`, `startBoss`, och `getSnapshot`. Startkommandon är idempotenta: de gör inget när mötet redan pågår eller när läget inte tillåter kommandot.

### Mötesdata och testbalans

Varje kapitel innehåller tre möteskonfigurationer: farming, breakthrough och boss. Alla numeriska värden ligger i en central balansmodul. Värdena är deterministiska och skalas mellan kapitel så att testprofilen klarar farming, breakthrough och boss i ordning från kapitel 1 till 36. Stridens resultat beror inte på React, Phaser, DOM, tidtagare eller slump.

## Gränssnitt

Battle-vyn visar ovanför stridsscenen:

- `Kapitel X / 36` och kapitlets namn.
- Aktuellt möte: Farming, Breakthrough, Boss redo, Boss eller Kampanj klar.
- En kort instruktionsrad som förklarar nästa möjliga steg.
- Exakt en situationsanpassad kontroll: **Starta breakthrough** eller **Utmana bossen**.

Kontrollen är minst 44 × 44 CSS-pixlar och avaktiveras när den inte är giltig. På mobil visas den under scenen utan horisontell rullning. På desktop ligger den i den befintliga statusytan.

Scenen växlar egen bakgrundston och fiendesiluett mellan kapitlen. En boss är tydligt större och har en mer framträdande färg än kapitlets farming-fiende. Milstolpe 1:s Ari behålls som den fördefinierade testkaraktären.

## Felhantering

- Ogiltiga kapitel- eller mötesdefinitioner avvisas när kontrollern skapas och rapporteras som ett begripligt kampanjfel i UI:t.
- Ogiltiga kommandon ändrar aldrig state.
- Ett stridsfel fortsätter använda befintlig felrapportering i React; senast giltiga kampanjsnapshot behålls i minnet.
- Ingen lokal eller serverbaserad sparning införs. En omladdning återställer därför testprofilen till kapitel 1.

## Testning och acceptans

Enhets- och integrationstester ska täcka:

- Den kompletta katalogen med exakt 36 kapitel, tre möteskonfigurationer per kapitel och originalnamn.
- Tillåtna och otillåtna kampanjövergångar, inklusive idempotenta dubbelkommandon.
- Breakthrough-vinst, breakthrough-förlust, bossvinst, bossförlust och avslutningsläget efter kapitel 36.
- Att pausad tid inte kan förändra kampanj- eller stridsläge.
- Att React visar rätt kapitel, status och kontroll för varje kampanjläge.
- Att Phaser får uppdaterade visuella metadata när ett nytt möte börjar.
- En deterministisk genomspelning med testprofilen från kapitel 1 till 36.

Milstolpen är godkänd när testprofilen kan nå kampanjens avslutningsläge, inga ogiltiga övergångar är möjliga och samtliga automatiserade tester, typkontroll och produktionsbygge passerar.

## Avgränsningar

Milstolpe 2 ska inte lägga till progression, belöningar, inventory, skills, manuella attacker, utvecklarpanel, konton, sparning, offline-progress, externa tillgångar eller funktioner från senare milstolpar.
