# Facilities-Katalog (Engine v1)

Status: canonical (v1 implemented)

Quelle: Engine v1 (`src/core/engine/engine.ts`, `src/core/rules/v1.ts`, `src/core/rules/facilities_v1.ts`)
Siehe auch:
- Caps/Slots: `docs/rules/rules-v1.md`
- Soll (detaillierte Einrichtungen & Spezialisierungen): `docs/rules/soll/facilities.md`

## Key-Schema (v1)

Allgemein:
- `general.<tier>.<scope>.<slug>`
Spezifisch/besonders:
- `special.<tier>.<scope>.<slug>`

Dabei gilt:
- `tier`: `small | medium | large`
- `scope`: grobe Zielkategorie, z.B. `domain | city | office | organization | trade | workshop | troops | personal`
- `slug`: stabiler Bezeichner (camelCase), z.B. `marketStalls`, `soupKitchens`, `ruthlessCollectors`

Legacy/kompatibel (ältere v1-Keys; noch unterstützt):
- `general.<tier>.office`
- `special.<tier>.office`
- `general.<tier>.organization`
- `special.<tier>.organization`
- `general.<tier>.tradeEnterprise`
- `special.<tier>.tradeEnterprise`
- `general.<tier>.workshop`
- `special.<tier>.workshop`

In v1 sind viele `general.*`/`special.*` Keys noch **generisch**; einzelne Keys haben bereits spezifische Mechanik (siehe unten).

## Kosten (v1)

- `general.small.*`: 8 Gold
- `general.medium.*`: 12 Gold
- `general.large.*`: 30 Gold
- `special.small.*`: 10 Gold
- `special.medium.*`: 20 Gold
- `special.large.*`: 40 Gold

Event-Modifikatoren (v1):
- Event 23 (Erhöhte Steuereinnahmen): Bei Ämtern (`location.kind=office`) kosten `general.*` ×2 (4 Runden).
- Event 13 (Handelszusammenbruch): Bei Handelsunternehmungen (`location.kind=tradeEnterprise`) kosten Einrichtungen in der **Start-Runde** des Events halb so viel (aufgerundet).

## Slots/Caps (v1)

- Slots je Location: siehe `docs/rules/rules-v1.md`.
- Jede Einrichtung (`general.*`/`special.*`) belegt 1 Slot.

## Effekte (v1)

### Einfluss/Runde (v1)

Gilt nur für `location.kind`:
- `office` (Ämter)
- `organization` (Unterwelt/Spion/Kult/Collegien)
- `tradeEnterprise` (Handelsunternehmungen)
- `workshop` (Werkstätten)
- `personal` (persönliche Einrichtungen / Privatbastionen v1-light)

Wert:
- `general.small.*`: +1
- `general.medium.*`: +2
- `general.large.*`: +3
- `special.small.*`: +2
- `special.medium.*`: +3
- `special.large.*`: +4

Für andere Orte (Domäne/Stadtbesitz/etc.) geben `general.*`/`special.*` in v1 **keinen** direkten Einfluss-Ertrag.

### Persönliche Einrichtungen (v1-light)

- Standort: `location.kind=personal`
- Naming: `general.<tier>.personal.*` / `special.<tier>.personal.*`
- Effekt zusätzlich zu „Einfluss/Runde“: jede persönliche Einrichtung erhöht das Fachkräfte-Cap um `+1`.

### Veredelung (`special.*.refine`)

Keys:
- `special.small.refine`
- `special.medium.refine`
- `special.large.refine`

Effekt:
- Jede Refinement-Einrichtung am Standort erhöht die Veredelungsstufe um `+1`.
- Wirkt auf Werkstatt-Output am selben Standort (Domäne oder Stadtbesitz).
- Stacks (mehrere `refine` addieren sich).

### Sonstige Keys

- Alle anderen `general.*`/`special.*` Keys sind in v1 „nur“ Träger für Kosten/Slots/Einfluss.
- Wenn ein Key zusätzliche Mechanik bekommen soll: zuerst in `docs/rules/soll/facilities.md` spezifizieren, dann in `docs/rules/rules-v1.md` + Code umsetzen.

## Spezifische Keys (v1)

### `general.medium.office.administrativeReforms` (Administrative Reformen)

- Ort: `office` (nur `tier=medium|large`)
- Kosten: `20 Gold` + `40 Einfluss`
- Voraussetzung:
  - Spieler hat mind. `2` Ämter
  - Nur `1×` pro Spieler (inkl. laufender Projekte)
- Unterhalt: `2 Gold` pro Runde (1× pro Spieler, nicht pro Amt)
- Effekt:
  - schaltet `yieldMode=split` frei (50:50) für `SetOfficeYieldMode`
  - gibt in v1 **keinen** zusätzlichen „Facility‑Einfluss/Runde“ (Ausnahme-Key)

### `general.medium.city.insulae` (Insulaebau)

- Ort: `cityProperty` (nur `tier=medium|large`)
- Slots: belegt 1 Stadtbesitz-Einrichtungsplatz
- Kosten: `14 Gold` + `30× raw.bricks` + `15× raw.lumber`
- Bauzeit (Langzeitvorhaben): `4` Runden, `2 AK` pro Runde (ZK=0)
  - Start-Runde: wird beim `BuildFacility` sofort bezahlt
  - Folgerunden: Maintenance (Projekt-Fortschritt)
  - Event 36: verdoppelt Bau-Arbeitskosten (AK) pro Bau-Runde
- Cap (pro Stadtbesitz): `medium=2`, `large=4` (inkl. laufender Projekte)
- Effekt: In der **nächsten Runde** nach Bauabschluss siedeln sich `+2` Pächterstufen an (gecappt); erhöht den Stadt-Pächtercap um `+2` je Insulae.

### `special.medium.artisanAlley`

- Ort: `cityProperty`
- Kosten: `2× special.specialTools` (kein Gold)
- Aktiv, wenn:
  - nicht beschädigt
  - mindestens 1 Fachkraft vorhanden: `artisan` **oder** `workshop`
- Umwandlung (Conversion-Phase):
  - Kapazität pro Runde: `1 + floor(Pächterstufen/4)` je Gasse (Pächterstufen des Stadtbesitzes)
  - Pro Kapazitäts‑Einheit wird die beste verfügbare (positive) Konversion gewählt (Netto‑Goldäquivalenz, deterministisch).
  - Rezepte (v1):
    - `raw.unpolishedGems` → `special.cutGems`
    - `raw.preciousMetals` → `special.jewelry`
    - `4× raw.quartzSand` → `special.glassware`
    - `4× raw.herbsFlowers` → `special.perfume` **oder** `special.potions`
    - `4× special.paper` → `special.booksMaps` (wird nur gewählt, wenn netto positiv)
    - `2× raw.leadBrassTin` → `special.mechanicalParts`
