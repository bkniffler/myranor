# Implementierungsstatus (Myranor Aufbausystem) – Engine `rulesVersion = v1`

Quelle der Regeln: `docs/reference/Aufbausystem.md` (Kernsystem) + Projektkontext `docs/design/concept.md`.

Dieses Dokument ist die **Coverage-/Abweichungsübersicht**: Was ist in der Engine **implementiert**, was **fehlt**, und welche **Interpretationen** gelten – damit Playtests belastbar auswertbar sind.

## Legende

- ✅ Implementiert (Engine verhält sich regeltextnah)
- 🟡 Teilweise implementiert (vereinfachter Scope oder nur Teil-Effekte)
- ❌ Nicht implementiert
- 🧩 Interpretation (Regeltext unklar → Entscheidung dokumentiert)

## Scope (v1)

- ✅ **Kern-Aufbausystem**: Rundenablauf, Markt, Abschnitts-Ereignisse, Aktionen **1–4 & 6**
- ❌ **Aktion 5 „Politische Schritte“**: explizit nicht im Scope
- ❌ **„Erweiterte Aufbausysteme → Das Erste Lager“** (Nomisma/Nahrung/Tiere/KK/Werkzeuge/None/Oktrale): nicht modelliert (eigener Ruleset-Kandidat)

## Code-Orte (v1)

- Engine/Reducer: `src/core/engine/engine.ts`
- State/Types: `src/core/domain/types.ts`
- Defaults/Basiswerte: `src/core/rules/v1.ts`
- Materialkatalog (typed RM/SM): `src/core/rules/materials_v1.ts`
- Marktsystem (2d6): `src/core/rules/market_v1.ts`
- Ereignisse (Tabelle + Roll-Logik): `src/core/rules/eventTable_v1.ts`, `src/core/rules/events_v1.ts`
- Ereignis-Modifikatoren (DC/Steuern/Markt): `src/core/rules/eventModifiers_v1.ts`

## Startbedingungen

Quelle: `docs/reference/Aufbausystem.md` → „Startbedingungen“ (Kernsystem).

- ✅ Starter-Domäne (`DomainTier: "starter"`) inkl. Basisertrag (2 AK, 4 RM)
- ✅ 2 permanente Arbeitskraft (`holdings.permanentLabor = 2`)
- ✅ Kleine Werkstatt zu Beginn (`workshop-starter`, zählt nicht als Domänen-Facility-Slot)
- ✅ Kleiner städtischer Besitz, verpachtet (`city-starter`, `mode: "leased"`)
- ✅ Startgold: 4
- ✅ Start-Aktionen: 2 Aktionen/Runde + 1 freie Einrichtungs-/Ausbauaktion (`campaign.rules`)

Quelle: `docs/reference/Aufbausystem.md` → „Das Erste Lager“.

- ❌ Startressourcen Nomisma/Nahrung/Tiere/KK/Werkzeuge sind nicht im Engine-State (nicht Teil `v1`)

## Ressourcenmodell

- ✅ Gold: `PlayerEconomy.gold` (+ `pending.gold` für „nächste Runde“)
- ✅ Arbeitskraft (AK): `PlayerTurn.laborAvailable` (Reset in Phase `reset`)
- ✅ Einfluss: `PlayerTurn.influenceAvailable` (Reset in Phase `reset`)
- ✅ Rohmaterial/Sondermaterial (typed): `PlayerEconomy.inventory.raw|special` (`materialId -> count`)
- ✅ Permanente Arbeitskraft (handelbar): `PlayerHoldings.permanentLabor`
- ✅ Permanenter Einfluss (als dauerhafter Basis-Zuwachs): `PlayerHoldings.permanentInfluence`

## Rundenablauf

Quelle: `docs/reference/Aufbausystem.md` → „Die Runde“.

- ✅ Phasenmodell: `maintenance → actions → conversion → reset`

### Maintenance

- ✅ Einkommen (regeltextnah für Kernposten, teils vereinfacht):
  - Domänen: RM-Ertrag (typed, aktuell grob auf `raw.wood`/`raw.grainVeg` gesplittet)
  - Stadtbesitz (verpachtet): Gold + Einfluss + AK gemäß Tier
  - Ämter: Gold oder Einfluss je `yieldMode` (Hausregel: kleines Amt `2 Gold` statt `4`)
  - Pächter/Anhänger/Klienten: +1 Gold je Stufe (wenn nicht in Unruhe)
  - Unterweltcircel: Gold/Einfluss je Stufe×HQ-Stufe (gemäß Regeltext), sofern nicht in Unruhe
  - Handelsunternehmungen: Ertrag (SM oder SM→Gold) + zusätzliche Marktsysteme
- ✅ Unterhalt ab Runde 2:
  - Domänen, Stadtbesitz (Eigenproduktion), Organisationen, Handelsunternehmungen, Truppen
  - Werkstätten/Lager: werden nur „unterhalten“, wenn Gold/AK reichen (sonst in der Runde inaktiv)
  - Arbeitskraft-Unterhalt: 1 RM je 4 AK (wenn RM fehlen: 🧩 v1-Interpretation → effektive AK sinken)
- 🟡 Nichtzahlung von Gold/Einfluss-Unterhalt bei Posten ist aktuell als **negativer Goldstand** möglich (kein „Abschalten“/Kündigen modelliert).

### Conversion

- ✅ Werkstatt-Konversion RM→SM (4:1, Kapazitäten je Werkstatt)
- ✅ Lagerung: nur in unterhaltenen Lagern, Kapazität pro Lager × `storageCapacityMultiplier` (Default: 2×)
- ✅ Auto-Konversion am Rundenende:
  - RM→Gold: Standard 4:1 (Food-RM bei Hungersnot 3:1)
  - SM→Gold: 1 SM = 2 Gold
- ✅ Nicht gelagerte Restbestände verfallen

### Reset

- ✅ Reset der Pools (AK/Einfluss) auf Basis der Holdings
- ✅ Event 3 (Seuche): -1 AK je 2 „Follower-Level“ (≈ 500 Personen) pro Abschnitt (regeltextnah)

## Markt (Marktsystem)

Quelle: `docs/reference/Aufbausystem.md` → „Marktsystem“.

- ✅ Pro Runde: je 1× Rohmaterial- und Sondermaterial-Tabelle (2d6)
- ✅ Typed-Matching: Markt-Modifikator pro Investment über `material.marketGroup`
- ✅ Zusätzliche Märkte durch Handelsunternehmungen: je Stufe 1 eigener Markt (`trade-<id>-<n>`)
- ✅ Geldgewinn (Verkauf/Kauf) kann einen Markt wählen (`marketInstanceId`)
- ✅ Handelsunternehmung im Modus `trade` nutzt den **besten** eigenen Handelsmarkt für die investierten SM
- 🧩 Event-Sale-Boni (z.B. „+1d6 für Magiekomponenten“) sind aktuell als **flacher Bonus pro Verkauf-Aktion** modelliert (nicht pro Investment)

## Loyalität / Anhänger / Klienten / Pächter

Quelle: `docs/reference/Aufbausystem.md` → „Pächter, Anhänger und Untertanen“.

- ✅ Modell: `FollowersState = { levels, loyalty, inUnrest }` an Domäne/Stadt/Organisation
- ✅ Erträge (wenn nicht `inUnrest`):
  - +1 AK je Stufe (über Basispool)
  - +1 Gold je Stufe (Maintenance)
  - Domänen zusätzlich +1 einfaches RM je Stufe (typed, abhängig von Domänen-Spezialisierung; grob gemappt)
- ✅ Caps:
  - Domänen: 2/4/8 Stufen (klein/mittel/groß)
  - Stadtbesitz: 2/3/4 Stufen (klein/mittel/groß)
  - Unterwelt: 2/4/6 Stufen (2×Tier)
  - Kult: 2/4/8 Stufen
  - Collegien: 1/2/3 Stufen
- ✅ Unruhe: `levels > 0 && loyalty <= 2` → Posten-Erträge/Pools fallen aus (v1-Mechanik)
- 🧩 Abwanderung: Regeltext nennt Abwanderung, aber keine Tick-Regel → v1: solange `loyalty <= 2` verliert die Gruppe **1 Stufe pro Runde**
- ✅ Ereignis-Interaktionen (Auszug):
  - Hungersnot: Food-RM/SM werden als Upkeep verbraucht; bei Mangel `loyalty -2`
  - Gute Ernte/Feiertage/Unheilvolle/Sehr gutes Jahr: LO- und Stufenänderungen (Abschnittsstart)
  - Aufstand/Erbe der Achäer: Loyalitätsprobe (Abschnittsstart) → LO-Malus
  - Plünderung/Überfälle: Stufenverluste (regeltextnah)
- ❌ Spezielle Loyalitäts-Aktionen/Fazilitäten (z.B. „Loyalität sichern“) sind noch nicht als eigene Commands modelliert

## Aktionen (ohne Politische Schritte)

### 1) Einflussgewinn (`GainInfluence`)

- ✅ Temporär (1 Gold → 4 Einfluss, Erfolgsstaffel)
- ✅ Permanent (2 Gold → 1 permanenter Einfluss, Erfolgsstaffel)
- ✅ DC-Mods: Besitz-/Amt-Größe, Kult-Stufe, Events (z.B. Säuberung/Inspektion)
- ✅ Caps gemäß Regeltext (temporär 4/6/8/12; permanent: 🧩 v1-Interpretation „2 + Summe Tier-Ränge Ämter+Organisationen“)
- ✅ Bonusaktionen:
  - Große Ämter: +1 Bonusaktion Einflussgewinn je großem Amt
  - Großer Kult: +1 Bonusaktion Einflussgewinn

### 2) Geldgewinn (`MoneyLend`, `MoneySell`, `MoneyBuy`)

- ✅ Geldverleih: DC 14, Auszahlung nächste Runde, Cap 2/4/6/10 je Handelsunternehmungs-Tier
- ✅ Verkauf: DC 14, Verkauf von RM/SM/permanenter AK, Cap 3 + (2×TradeTierSum) + (DomainTierSum)
- 🟡 Kauf: implementiert (Preis-/Erfolgsstaffel ist teilweise 🧩 Interpretation, Regeltext spezifiziert nur „Geschafft“ eindeutig)
- ✅ Bonusaktionen: Großes Handelscollegium → 1 Bonusaktion Geldgewinn/Runde

### 3) Materialgewinn (`GainMaterials`)

- ✅ Domänenverwaltung: DC 10, Cap 4×Domänen-Tier, targetId erforderlich bei mehreren Domänen
- ✅ Werkstattaufsicht: DC 12, Cap 2×Werkstatt-Tier, targetId erforderlich bei mehreren Werkstätten
- ✅ Bonusaktionen: Großes Handwerkscollegium → 1 Bonusaktion Materialgewinn/Runde

### 4) Gewinn permanenter Posten (`Acquire*`, `RecruitTroops`, `AcquireTenants`)

- ✅ Domäne/Stadtbesitz/Ämter: DC gemäß Regeltext, Kosten + Erfolgs-Kostenmodifikatoren
- ✅ Organisationen (Unterwelt/Spion/Kult/Collegien): Stufenaufbau, HQ-Anforderung (Stadtbesitz-Tier ≥ Orga-Tier)
- ✅ Handelsunternehmungen: DC 10, 🧩 Kaufkosten v1-Interpretation (20/40/80 Gold)
- ✅ Truppen: Kosten (Gold/Einfluss/SM) + Events (z.B. Musterung), Cap-Regeln (v1-Interpretation)
- ✅ Pächter/Anhänger anwerben: Kosten + Erfolgs-Kostenmodifikatoren, Cap-Regeln

### 6) Einrichtungen errichten/ausbauen (Sonderaktion)

- ✅ Starter-Domäne ausbauen (`UpgradeStarterDomain`)
- ✅ Domänen-Spezialisierung setzen (Landwirtschaft/Tierzucht/Forst/Bergbau) – Kosten teils 🧩 vereinfacht
- ✅ Werkstatt/Lager bauen & upgraden (inkl. Slot-/Kapazitätsregeln, Fachkraft-Voraussetzungen für größere Werkstätten)
- 🟡 Allgemeine/Besondere Einrichtungen (`BuildFacility`) sind aktuell **generisch** (`general.*` / `special.*`) mit Goldkosten nach Tier; viele konkrete Kosten/Effekte fehlen

## Ereignisse (Ereignistabellen)

Quelle: `docs/reference/Aufbausystem.md` → „Ereignistabellen“.

- ✅ Pro Abschnitt (5 Runden): 2× Event (2d20), ohne Doppelungen
- ✅ Meta-Rolls werden einmalig gespeichert (z.B. Denera-Aufruhr-Trigger, Market-Deltas, Räuber/Piraten)

**Event-Coverage (2–40)**

- ✅ 2 Hungersnot: Food-RM 3:1 (Auto-Convert) + Fütterung/LO -2 + Sale-Bonus
- ✅ 3 Seuche: Werkstatt-Unterhalt +1 AK, -AK pro Follower-Level, Sale-Bonus Medizin
- ✅ 4 Kriegssteuer: +5 Gold/Runde + Einmalabgabe pro Amt + Sale-Bonus Waffen/Rüstung
- ✅ 5 Aufstand: Loyalitätsprobe Stadt-Klienten (Abschnittsstart) + Sale-Bonus Waffen/Rüstung
- ✅ 6 Kultüberprüfung: Trigger+Verbergen-Check, Einfluss- und Anhänger-Verlust + Kirchenaufsicht (🟡 nicht spezialisiert) +6 Einfluss
- ✅ 7 Zahlungsengpässe: Amts-Gold halbiert, Geldverleih-DC +4
- ✅ 8 Dürresommer: Landwirtschaft/Tierzucht halbiert (1 Runde) + Facility-Schaden (1 Runde, vereinfachte Abbildung) + Sale-Bonus Food
- ✅ 9 Bautätigkeit: Werkstatt-Unterhalt +1 Gold + Sale-Boni Baumaterial
- ✅ 10 Stagnation: teure Marktwerte -1d4, Handelsunternehmungen halbiert, Sell/Lend DC +2
- ✅ 11 Gute Ernte: Landwirtschaft +8 RM, Food-Markt -1, LO +1 + Pächter-Kosten halbiert
- ✅ 12 Säuberung: Influence-DC -2 (🟡 Amtsverluste/Curia/Hof-Spezialisierung nicht modelliert)
- ✅ 13 Handelszusammenbruch: Geldverleih halbiert, Handelsunternehmung-Upkeep +4/Tier, Facility-Kosten (Trade) halbiert (1 Runde)
- 🟡 14 Magischer Unfall: Sale-Bonus Magie + vereinfachter Facility-Schaden; Artefakt-Kaufchance nicht modelliert
- 🟡 15 Unwetter: Sell-DC +1 + vereinfachter Facility-Schaden; Schiffe nicht modelliert
- 🟡 16 Räuber/Piraten: Räuber-Variante (RM-Diebstahl) implementiert; Piraten/Schiffe nicht modelliert; Sell-DC +2
- ✅ 17 Pässe/Söldner: Handelsunternehmungen halbiert; teure SM +2 Marktwert; Söldner-Rekrutierung halbiert
- ✅ 18 Korruptionsuntersuchung: Amts-Einfluss halbiert + +2 Einfluss/Stufe (Unterwelt/Spion/Kult)
- 🟡 19 (Fliegender Basar): teure SM -1d6 Marktwert (weitere Effekte ggf. fehlen)
- 🟡 20 Alchemistischer Unfall: Sale-Bonus Alchemie + Werkstatt-Upkeep +1 Gold + Schaden (Abschnittsstart, max 1) implementiert
- 🟡 21 (Neues Bergwerk): Metall-RM Markt -1d4 (weitere Effekte ggf. fehlen)
- ✅ 22 Offener Konflikt: Handelsunternehmung-Upkeep +3/Tier (weitere Hofamt-Effekte nicht spezialisiert)
- ✅ 23 Erhöhte Steuereinnahmen: Amts-Gold +2/Tier, Facility-Kosten (Amt general.*) ×2
- ✅ 24 Religiöse Feiertage: Kult +6 Einfluss, LO +1
- 🟡 25 Musterung: Truppenkosten ×2 (Abstellen/Verfügbarkeit von Söldnern nicht modelliert) + Sale-Bonus Food/Rüstung
- 🟡 26 Nachbarn: Handelsunternehmung halbiert + Spion +4 Einfluss + Angriffsgefahr/DC+2 (Domänenangriffe ✅; Schiffe/Handelsschiffe ❌)
- 🟡 27 Aufruhr Denera: Handwerkscollegium -AK/Stufe + Werkstatt-Upkeep +Gold/Stufe + vereinfachter Facility-Schaden
- ✅ 28 Unheilvolle: LO Kult +1, sonst -1; (Cammern-Zauberkraft nicht modelliert) + Denera-Trigger (Meta)
- ✅ 29 Magische Bestien: Verteidigungsprobe oder -4 RM Ertrag (regeltextnah)
- 🟡 30 Feuersbrunst: vereinfachter Facility-Schaden + Stadtbesitz-Kaufchance -50% (1 Runde) + Sale-Bonus Baumaterial
- ✅ 31 Aufschwung: +1 Gold pro 2 Investitionen (Lend/Sell) + Sale-Bonus Luxus
- ✅ 32 Landflucht: -AK pro Pächter (1 Runde) + Unterwelt/Handwerk +AK/Stufe
- ✅ 33 Warenüberschuss: Handelsunternehmungen Bonus +2 Gold/Tier oder +1 SM/Tier (Modusabhängig) + teure SM Markt -1d4
- 🟡 34 Achäer: Magische SM (+4) + Kult-Zauberkraft + LO-Probe Land + -AK pro 2 Pächterstufen (Trigger)
- ✅ 35 Hedonismus: teure SM Markt +2d6 + Kult +6 Einfluss + Denera-Trigger (Meta)
- 🟡 36 Großes Bauprojekt: Baumaterial Markt +2d4 (Langzeitprojekte nicht modelliert)
- ✅ 37 Plünderung: Angriffe auf (unverteidigte) Domänen inkl. RM-/Pächter-Verlust + Söldner +6 Einfluss
- 🟡 38 Wunder: Trigger für Kult +6 Einfluss/+6 Gold pro Stufe (Gasthäuser etc nicht modelliert)
- 🟡 39 Provinzinspektion: Influence-DC -4; Politische Abwehrprobe/Effekte nicht modelliert (Aktion 5 out of scope)
- ✅ 40 Sehr gutes Jahr: Domänen-Ertrag +50% (1 Runde) + Landwirtschaft +8 (4 Runden) + Pächter +1 Stufe + LO +2 + Food-Markt -1d4

## Visibility / Logs

- ✅ Alle Events haben `visibility` (public vs private pro Player)
- ✅ `PublicLogEntryAdded` existiert; Simulation kann es unterdrücken (`emitPublicLogs: false`)
