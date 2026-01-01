# Regeln (Engine v1) — implemented

Status: implemented (v1)

Dieses Dokument beschreibt die **tatsächlich in der Engine umgesetzten Regeln** (`rulesVersion = v1`).

- Soll-Source-of-Truth: `docs/rules/soll/aufbausystem.md`
- Soll-Facilities (Detailkatalog): `docs/rules/soll/facilities.md`
- Tabellen/Listen (v1): `docs/rules/tables/*`
- Facilities-Katalog (v1): `docs/rules/facilities/catalog.md`
- Coverage/Abweichungen: `docs/dev/implementation-status.md`

## Scope (v1)

Enthalten:
- Rundenablauf (Phasen), Markt, Ereignisse (Abschnitte), Aktionen, Scoring/Playtests.
- Politische Schritte (v1-light): `KW/AS/N`, `Information`, Gegenreaktionen.
- Loyalität (v1): `LO 0–6`, Aufruhr/Abwanderung, LO-Proben.
- Fachkräfte (v1): Anwerben-Check + 2w6/1w20 Tabellen + Trait-Effekte (v1-Interpretation).

Nicht (vollständig) enthalten:
- Der vollständige Soll-Facilities-/Spezialisierungs-Katalog (v1 hat viele Platzhalter/vereinfachte Effekte; siehe `docs/rules/facilities/catalog.md`).
- Privatbastionen (Soll ist WIP; v1 hat nur ein v1-light Modell für persönliche Einrichtungen, siehe unten).

## Rundenablauf (v1)

Phasen: `maintenance → actions → conversion → reset`

Beim Übergang `maintenance → actions` passieren (in dieser Reihenfolge):
1. **Markt-Roll** (nur am Markt-Abschnittsstart)
2. **Ereignis-Roll** (nur am Ereignis-Abschnittsstart)
3. **Neider-Gegenreaktion** (wenn `N >= 3/6/9`, Spieler wählt Gold oder Einfluss)
4. **Income/Upkeep** wird berechnet und als Event angewandt

Zusatz (v1): **Langzeitvorhaben (Bauzeit)** – einige Einrichtungen starten als Projekt statt sofort gebaut zu werden:
- Start: `BuildFacility` zahlt die **erste** Bau-Runde (AK/ZK) sofort; die restlichen Runden laufen als Projekt weiter.
- Fortschritt: im Maintenance (vor Werkstatt/Lager-Unterhalt), solange AK/ZK verfügbar sind; sonst pausiert das Projekt.
- Abschluss: im Übergang `maintenance → actions` (Facility ist dann in `actions` verfügbar).
- Event 36: verdoppelt Bau-Arbeitskosten (AK) pro Bau-Runde.

### Markt-Abschnitte (v1)

- Dauer: **4 Runden**
- Start-Runden: **R1, R5, R9, …** (`(round-1) % 4 === 0`)
- Gewürfelt wird pro Marktinstanz:
  - `1×` Rohmaterial-Tabelle (2d6)
  - `1×` Sondermaterial-Tabelle (2d6)
- Marktinstanzen:
  - immer: `local` (Lokaler Markt)
  - zusätzlich: pro Handelsunternehmung eigene Instanzen (siehe „Handelsunternehmungen“)

### Ereignis-Abschnitte (v1)

- Dauer: **4 Runden**
- Start-Runden: **R2, R6, R10, …** (`round >= 2 && (round-2) % 4 === 0`)
- Pro Abschnitt: **2× Event** (2d20, ohne Doppelungen)
- Details: `docs/rules/tables/events.md`

## Checks & Erfolgsstufen (v1)

### Check-Bonus (Attributsmodifikator)

- Startwerte pro Spieler: `influence=3`, `money=3`, `materials=3`
- Progression: `effectiveCheck = base + floor((round-1)/6)`
  - R1–6: `+0`
  - R7–12: `+1`
  - R13–18: `+2`

### Investitions-DC-Modifikator (Standard)

- `+4` DC bei Investitionen `>= 4`
- `+8` DC bei Investitionen `>= 8`

(Einige Aktionen haben abweichende Schwellen, z.B. Politische Schritte: Loyalität sichern.)

### Erfolgsstufen

- `veryGood`: `>= DC + 10`
- `good`: `>= DC + 5`
- `success`: `>= DC`
- `poor`: `>= DC - 5`
- `fail`: `< DC - 5`

## Startbedingungen (v1)

Start-Ressourcen:
- Gold: `4`
- Information: `0`
- Inventar: leer
- Checks: `3/3/3`

Start-Holdings:
- Domäne: `domain-starter` (`tier=starter`, `rawPicks=[raw.grain]`)
- Stadtbesitz: `city-starter` (`tier=small`, `tenure=owned`, `mode=leased`)
- Werkstatt: `workshop-starter` (`tier=small`, Domäne, `raw.grain → special.pulpellen`)
- Lager: `storage-starter` (`tier=small`, Domäne)
- Amt: `office-starter` (`tier=small`, `yieldMode=influence`, `specialization.kind=cityAdministration`)
- Permanente AK: `2`
- Permanente Einflussquelle: `0`
- Truppen: leer (`troops.loyalty = 2`)

Hinweis (Slots/Caps):
- `workshop-starter` und `storage-starter` zählen **nicht** gegen Domänen-Slots/Caps (Startpaket-Ausnahme).

## Privatbastionen / Persönliche Einrichtungen (v1-light)

Privatbastionen sind im Soll noch WIP; v1 bildet deshalb nur ein **leichtes** Modell ab:

- Storage: `holdings.personalFacilities`
- Bau: `BuildFacility` mit `location.kind=personal`
  - Facility-Key muss `general.<tier>.personal.*` oder `special.<tier>.personal.*` sein.
- Slots: max. `6` persönliche Einrichtungen pro Spieler.
- Effekte:
  - geben Einfluss/Runde wie andere Facilities (siehe `docs/rules/facilities/catalog.md`)
  - erhöhen das Fachkräfte-Cap um `+1` pro persönlicher Einrichtung

## Ressourcenmodell (v1)

- Gold: `economy.gold` (kann durch Umwandlung **Bruchteile** enthalten)
- Information: `economy.information` (persistent)
- Temporäre Pools (pro Runde):
  - Arbeitskraft: `turn.laborAvailable`
  - Einfluss: `turn.influenceAvailable`
- Inventar:
  - Rohmaterial: `inventory.raw[materialId]`
  - Sondermaterial: `inventory.special[materialId]`
- Pending: `economy.pending.*` (z.B. Geldverleih-Auszahlung nächste Runde)
- Politik: `politics.kw`, `politics.as`, `politics.n`

## Einkommen & Unterhalt (Maintenance, v1)

Unterhalt wird ab **Runde 2** berechnet.

### Einkommen (Auszug, v1)

- Domänen: `AK` + `RM` nach Tier (siehe `src/core/rules/v1.ts`)
- Stadtbesitz (verpachtet / `mode=leased`): `AK + Einfluss + Gold` nach Tier
- Ämter: `Gold oder Einfluss` nach Tier/`yieldMode`
- Pächter/Anhänger/Klienten (Levels): `+1 Gold` pro Level (wenn nicht in Unruhe)
- Handelsunternehmungen:
  - `produce`: erzeugt Sondermaterial (v1: `special.simpleTools`, `small/medium/large = 2/3/6`)
  - `trade`: investiert Sondermaterial aus dem Inventar (`1/2/4`) und erzeugt Gold (`4/10/24`, inkl. Markt/Event)

### Fixer Unterhalt (Auszug, v1)

- Domänen-Gold-Unterhalt: `small/medium/large = 2/4/8`
- Stadtbesitz Eigenproduktion (`mode=production`): `2/4/8`
- Stadtbesitz `tenure=pacht`: zusätzlich `+1 Gold` pro Runde
- Organisationen:
  - underworld: `+1 Gold` + `+1 AK` pro Tier-Rang
  - spy: `+2 Gold` pro Tier-Rang
  - cult: `+1 Gold` pro Tier-Rang
  - collegium*: `+2 Gold` pauschal (v1)
- Handelsunternehmungen (v1): `small/medium/large = (2G+1AK) / (5G+2AK) / (6G+4AK)`
- Truppen (v1): je nach Typ/Stufe (siehe `src/core/engine/engine.ts`)
- Fachkräfte (v1): `simple/experienced/master = 1/3/5 Gold` pro Runde

### Allgemeiner Unterhalt (Nahrung/Gold, v1)

Ab Runde 2 wird zusätzlich benötigt:
- `ceil(Arbeitskraft / 4)` Nahrungseinheiten
- `ceil(offene Kampfkraft / 2)` Nahrungseinheiten
- `Follower-Level` Nahrungseinheiten (Pächter + Anhänger/Klienten)

Bezahlung:
- zuerst aus `food`-getaggten Roh-/Sondermaterialien,
- fehlender Rest wird als `+1 Gold` pro Einheit abgerechnet.

## Slots & Caps (v1)

### Einrichtungsplätze (Facilities)

- Domäne: `2 * Tier-Rang` (starter: `0`)
- Stadtbesitz: `small/medium/large = 2/3/4`
- Amt: `2/3/4`
- Organisation: `2 * Tier-Rang`
- Handelsunternehmung: `2 * Tier-Rang`
- Werkstatt-Facility-Slots: `1/2/3` (small/medium/large)

### Werkstatt/Lager Produktions-Caps

Domäne:
- small: `1× small`
- medium: `1× medium`
- large: `1× small + 1× medium`
- `large` Werkstätten/Lager sind auf Domänen nicht erlaubt

Stadtbesitz (`mode=production`):
- Produktions-Caps (Werkstatt oder Lager; belegen **keine** Stadtbesitz-Einrichtungsplätze):
  - small: `2× small` **oder** `1× medium`
  - medium: `1× small + 1× medium`
  - large: `1× large + 1× medium`

## Conversion (v1)

Reihenfolge in `conversion`:
1. Werkstätten wandeln automatisch um (nur wenn unterhalten):
   - small: bis `8 RM → 2 SM` (4:1)
   - medium: bis `12 RM → 3 SM`
   - large: bis `24 RM → 6 SM`
2. Lagerung (nur wenn unterhalten): bis Kapazität
3. Autoumwandlung des Rests:
   - RM: `count / divisor` Gold (Standard `divisor=4`, Events können abweichen) + `floor(count/4) * saleBonusGold`
   - SM: `count * 2` Gold + `floor(count/4) * saleBonusGold`
   - verbleibende AK/Einfluss-Pools: `AK/4` und `Einfluss/4` Gold

Hinweis:
- Gold aus Umwandlung kann Bruchteile enthalten (z.B. `2 RM → 0.5 Gold`).

## Aktionen (v1, Überblick)

Action-Economy:
- Standard: `2` Aktionen pro Runde (`actionsPerRound`)
- Zusätzlich: `1` freie Einrichtungsausbau-Action pro Runde (`freeFacilityBuildsPerRound`)
- Standardaktionen dürfen in der Runde nicht doppelt denselben **canonical action key** nutzen.

Details zu einzelnen Aktionen/Commands stehen in `src/core/commands/types.ts` und `src/core/engine/engine.ts`.

### Einflussgewinn (`GainInfluence`)

- `temporary`: `1 Gold` pro Investition → `4` temporärer Einfluss (Erfolgsskala modifiziert)
- `permanent`: `2 Gold` pro Investition → `1` permanenter Einfluss (akkumuliert)
- DC: Grund `12`; Investitionsgröße: ab `8` Investitionen `+4 DC`, ab `12` Investitionen `+8 DC` (DC-Senkungen gesamt max. `-4`)

### Geldgewinn (`MoneyLend`, `MoneySell`, `MoneyBuy`, `MoneySellBuy`)

- Geldverleih: `2 Gold` pro Investition; Auszahlung als `pending.gold` nächste Runde (DC 14 + Invest)
- Verkauf/Kauf: Markt-Modifier + Event-Modifier + `saleBonusGold` werden berücksichtigt
- `MoneySellBuy`: Verkauf + Kauf in einer Aktion (Kaufware steht erst nächste Runde zur Verfügung)

### Materialgewinn (`GainMaterials`)

- `domainAdministration`: kostet AK; DC Grund `10` (+4/+8 ab `8/12` Investitionen); Output verteilt auf Domänen-`rawPicks`
- `workshopOversight`: kostet AK; DC Grund `12` (+4/+8 ab `8/12` Investitionen); Output folgt Werkstatt-Setup + Refinement

### Posten & Upgrades (Auszug)

- `AcquireDomain` (30/80/140 Gold; DC 10 + Tier + AS-Mod)
- `AcquireCityProperty` (12/25/60 Gold; `tenure=pacht`: halbe Kosten & DC -2; DC 10/8 + Tier + AS-Mod)
- `AcquireOffice` (Gold/Einfluss Mix; DC 14 + Tier + AS-Mod; kleine Ämter cap dynamisch)
- `AcquireOrganization` (pro Kind stufenweise; HQ-Anforderung über Stadtbesitz-Tier)
- `AcquireTradeEnterprise` (v1: 20/40/80 Gold; DC 10 + Tier + AS-Mod)
- `AcquireTenants` (Kosten abhängig von Ort/Org-Kind; Cap abhängig von Tier)
- `RecruitTroops` (Kosten je Typ; Event 25 kann verdoppeln)
- `UpgradeStarterDomain` (8 Gold + 4 AK)

### Einrichtungen (v1)

- `BuildFacility`: `general.*` / `special.*` sind in v1 meist generisch (Kosten/Slots/Influence); Details: `docs/rules/facilities/catalog.md`
- `BuildWorkshop` / `UpgradeWorkshop`: benötigen ggf. Fachkräfte (für medium/large)
- `BuildStorage` / `UpgradeStorage`
- Spezieller Key (v1):
  - `special.medium.artisanAlley`: Stadtbesitz-Einrichtung, kostet `2× special.specialTools` (kein Gold), konvertiert Materialien automatisch in der Umwandlungsphase (siehe `docs/rules/facilities/catalog.md`)

Hinweis (Caps, v1):
- Werkstätten/Lager im Stadtbesitz (Eigenproduktion) belegen **keine** Einrichtungsplätze des Stadtbesitzes; die Cap läuft separat über die Produktions-Caps (siehe oben).

### Politische Schritte (`PoliticalSteps`, v1)

- Ressourcen:
  - `KW` (Konsequenzenwert), `AS` (Ansehen), `N` (Neider), `Information`
- `convertInformation`: `1 Info → 2 Gold` oder `4 Einfluss`
- `damageDefend` / `manipulate` / `loyaltySecure`:
  - DC `14` + Investitionsmod (+4/+8) + `KW`-DC-Mod
  - `infoSpent` gibt `+2` pro Info auf den Wurf
- Neider-Gegenreaktion (automatisch in der Ereignisphase):
  - Schwellen `N >= 3/6/9` → Verteidigung DC `10/12/14`
  - bei Fehlschlag: Spieler verliert **wahlweise** `-4/-8/-12 Gold` **oder** `-4/-8/-12 Einfluss`
  - zusätzlich Politik-Deltas:
    - `N>=3`: `AS -1`
    - `N>=6`: `KW +2`, `AS -1`
    - `N>=9`: `KW +4`, `AS -2`
