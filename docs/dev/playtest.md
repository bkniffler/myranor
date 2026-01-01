# Playtest-System (v1) – Kernregeln evaluieren

Dieses Dokument beschreibt, wie wir die **Kernregeln** aus `docs/reference/Aufbausystem.md` (Rundenablauf, Unterhalt, Umwandlung, Markt, Ereignisse, Aktionen 1–4/6) automatisch simulieren und auswerten, um **Balancing**, **Skalierung** und Entscheidungsqualität zu beurteilen.

Wichtig: `rulesVersion = v1` ist das **Kern-Aufbausystem**. **„Das Erste Lager“** ist nicht Teil der Engine und wird (falls gewünscht) als separater Ruleset behandelt.

## Was wird getestet?

- Phasen: Unterhalt (`maintenance`) → Aktionen (`actions`) → Umwandlung (`conversion`) → Reset (`reset`)
- Markt: pro Markt-Abschnitt (4 Runden; R1–R4, R5–R8, …) je 1× Rohmaterial- und 1× Sondermaterial-Tabelle (2d6), inkl. zusätzliche Märkte pro Handelsunternehmung
- Ereignisse: pro Ereignis-Abschnitt (4 Runden; Start ab Runde 2: R2–R5, R6–R9, …) 2 Ereignisse (2d20, ohne Doppelung), wirken 4 Runden
- Aktionen:
  - 1) Einflussgewinn (`GainInfluence`)
  - 2) Geldgewinn (`MoneyLend`, `MoneySell`, `MoneyBuy`)
  - 3) Materialgewinn (`GainMaterials`)
  - 4) Posten erwerben (Domänen/Stadt/Ämter/Organisationen/Handelsunternehmungen/Pächter/Truppen)
  - 6) Sonderaktion Einrichtungen/Ausbau (Starterdomäne ausbauen, Spezialisierungen, Werkstatt/Lager)
- Politische Schritte (v1): `PoliticalSteps` (Beschädigen/Verteidigen, Manipulieren, Loyalität sichern, Information umwandeln)

Aktueller Implementierungsstand (inkl. Abweichungen/Interpretationen) ist in `docs/dev/implementation-status.md` dokumentiert.

## Monte-Carlo Runner (deterministisch)

Der Runner (`src/playtest/runner.ts`) führt Monte-Carlo-Simulationen durch:
- Seeded RNG (reproduzierbar)
- Pro Runde schaltet der GM die Phasen weiter
- Jeder Agent versucht eine Sonderaktion (Facility) + bis zu 2 Aktionen (plus ggf. Bonusaktionen)
- Der Report enthält Metriken wie Final-Gold-Verteilung, Win-Rate, Idle-Rate, Action-Tier-Verteilungen, Markt-/Event-Frequenzen

### CLI

```bash
# Szenarien anzeigen
bun run playtest --list-scenarios

# Quick run (Default-Parameter)
bun run playtest --scenario core-v1-strategies

# Standardreport für die 5 Strategien (500 Runs, 30 Runden)
bun run playtest:mc:strategies

# Planner-Strategien (Lookahead + Net-Worth Score; weniger Runs weil teurer)
bun run playtest:mc:planner-strategies
```

Outputs:
- `reports/playtest-core-v1-strategies.json`
- `reports/playtest-core-v1-strategies.md`
 - `reports/playtest-core-v1-planner-strategies.json`
 - `reports/playtest-core-v1-planner-strategies.md`

## LLM Runner (asynchron)

Der LLM-Runner (`src/playtest/llm.ts`) spielt mehrere Runden mit einem LLM als Entscheider:
- Engine bleibt autoritativ (Commands werden validiert)
- Kandidatenliste ist begrenzt, um Halluzinationen zu vermeiden

### CLI (Claude via `@ai-sdk/anthropic`)

```bash
# Voraussetzung:
# - ANTHROPIC_API_KEY in `.env`

bun run llm-play:strategies
```

Outputs:
- `reports/llm-core-v1-strategies.json`
- `reports/llm-core-v1-strategies.md`

Hinweis: LLM-Runs benötigen Netzwerkzugriff (in der Codex-Umgebung ggf. Approval).

## Analyse-Prompt Generator (LLM-Auswertung)

Um Reports von einem zweiten Modell (z.B. Gemini/Claude) auswerten zu lassen, generieren wir einen System-Prompt inkl. Regelsnapshot:

```bash
bun run playtest:prompt:strategies
```

Output:
- `reports/playtest-core-v1-strategies.prompt.md`
