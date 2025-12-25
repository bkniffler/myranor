# Facilities-Katalog (Engine v1)

Status: canonical (v1 implemented)

Quelle: Engine v1 (`src/core/engine/engine.ts`, `src/core/rules/v1.ts`)
Siehe auch:
- Caps/Slots: `docs/rules/rules-v1.md`
- Backlog/Spezifikation (vNext): `docs/rules/facilities/spec-draft.md`

## Key-Schema (v1)

- Allgemein: `general.<tier>.<slug>`
- Speziell: `special.<tier>.<slug>`
- `tier`: `small | medium | large`
- In v1 sind `general.*` und `special.*` mechanisch **generisch**, Ausnahme: `special.*.refine`.

## Kosten (v1)

- `general.small.*`: 8 Gold
- `general.medium.*`: 12 Gold
- `general.large.*`: 30 Gold
- `special.small.*`: 10 Gold
- `special.medium.*`: 20 Gold
- `special.large.*`: 40 Gold

Event-Modifikatoren (v1):
- Event 23 (Erhöhte Steuereinnahmen): Bei Ämtern (`location.kind=office`) kosten `general.*` ×2 (5 Runden).
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

Wert:
- `general.small.*`: +1
- `general.medium.*`: +2
- `general.large.*`: +3
- `special.small.*`: +2
- `special.medium.*`: +3
- `special.large.*`: +4

Für andere Orte (Domäne/Stadtbesitz/etc.) geben `general.*`/`special.*` in v1 **keinen** direkten Einfluss-Ertrag.

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
- Wenn ein Key zusätzliche Mechanik bekommen soll: zuerst in `docs/rules/facilities/spec-draft.md` spezifizieren, dann in `docs/rules/rules-v1.md` + Code umsetzen.
