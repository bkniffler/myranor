# Regeln (canonical)

`docs/rules/` ist die **Source of Truth** für die Regeln, Tabellen und Listen, auf deren Basis wir die Engine weiterentwickeln.

## Arbeitsweise

- **Regeländerungen** passieren hier (Docs zuerst). Danach werden Code + Tests angepasst.
- Wenn Code-Regeln geändert werden, werden die betroffenen Dateien in `docs/rules/` **im selben Patch** aktualisiert.
- Jede Liste nutzt stabile **IDs/Keys** (Material-IDs, Facility-Keys, Event-Rolls), damit Änderungen eindeutig implementierbar sind.

## Status-Tags

- **canonical**: soll exakt dem intendierten Verhalten entsprechen (und wird umgesetzt).
- **implemented (v1)**: ist aktuell in der Engine umgesetzt.
- **draft/spec**: geplant oder unvollständig; wird separat markiert.

## Dateien (Index)

- Kernregeln (v1): `docs/rules/rules-v1.md`
- Scoring / GoldEq: `docs/rules/scoring.md`
- Balancing (Erkenntnisse & Tweaks): `docs/rules/balancing.md`
- Strategie-Cards (LLM/Playtests): `docs/rules/strategies.md`
- LLM-Kontext (Kurzfassung, abgeleitet): `docs/llm/game-info.md`

### Tabellen & Kataloge

- Ereignisse: `docs/rules/tables/events.md`
- Markt: `docs/rules/tables/market.md`
- Materialien: `docs/rules/tables/materials.md`
- Facilities-Katalog: `docs/rules/facilities/catalog.md`
- Facilities (Draft/Backlog): `docs/rules/facilities/spec-draft.md`

## Format-Konventionen

- Tabellen: **1 Zeile = 1 Eintrag** (keine „alles in eine Zelle“-Monsterzellen).
- Effekte: als **Bullet-Liste** (pro Effekt eine Zeile), mit klaren Labels (z.B. `DC`, `Unterhalt`, `Ertrag`, `Markt`).
- Bei Zahlen/Parametern immer explizit: **Einheit**, **Dauer**, **Stacking**, **Caps/Prereqs**.
