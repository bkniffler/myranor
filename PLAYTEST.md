# Playtest-System (v0) – Kernregeln evaluieren

Dieses Dokument beschreibt, wie wir die **Kernregeln** aus `Aufbausystem.md` (Rundenablauf, Unterhalt, Umwandlung, Basisaktionen) automatisch simulieren und auswerten, um **Balancing**, **Skalierung** und “Spaßfaktor”-Proxys (Varianz, Entscheidungen/Vielfalt, Runaway-Leader) zu beurteilen.

Kontext: `CONCEPT.md` (Hybrid: LLM als Persona + deterministische Engine). Architektur/Stack: `ARCHITEKTUR.md`.

## Was genau wird (aktuell) getestet?

In `src/core` ist ein **deterministischer Engine-Slice** umgesetzt:
- **Phasen**: Unterhalt (`maintenance`) → Aktionen (`actions`) → Umwandlung (`conversion`) → Reset (`reset`)
- **Unterhalt** (ab Runde 2): Domäne (Gold), Werkstatt (AK+Gold), Lager (AK), Arbeitskräfte-Unterhalt (1 RM je 4 AK)
- **Automatische Umwandlung**: Werkstatt konvertiert RM→SM (4:1, Kapazitätsgrenzen), Lager kann RM/SM halten, Rest wird am Ende zu Gold umgewandelt (RM 4:1, SM 1:2)
- **Aktionen (2 pro Runde)**:
  - Einflussgewinn
  - Geldgewinn: Geldverleih
  - Geldgewinn: Verkauf (RM/SM)
  - Materialgewinn: Domäne/Werkstatt
  - (Minimal) Amt erlangen (kleines Amt mit Gold-Ertrag)
- **Sonderaktion (1 pro Runde)**: Domäne “starter” → “small”, Lager klein bauen

Zusätzlich sind (wie in `Aufbausystem.md` beschrieben) zwei Zufallssysteme integriert:
- **Markt**: pro Runde wird je 1× Rohmaterial- und Sondermaterial-Tabelle (2d6) gewürfelt.
- **Ereignisse**: pro Abschnitt (alle 5 Runden) werden 2× Ereignisse (2d20, Ergebnis 2–40) gewürfelt.

Wichtig: Beides ist im v0-Playtest bewusst **vereinfacht** modelliert:
- Wir modellieren **keine Materialtypen** (Holz, Eisen, Luxus etc.) – nur RM/SM als Mengen.
- Verkauf nutzt aktuell **nur** den Markt-Modifier der **basic**-Kategorie (cheap/basic/expensive existieren, aber wir wählen nicht aktiv).
- Ereignisse werden aus dem Text per Regex in einen begrenzten Satz an Modifikatoren übersetzt (Steuern, DC-Shift, Amt-Einkommen, Werkstatt-Upkeep, Umwandlungsratio, Auszahlungs-Multiplikatoren).

## Baseline-Annahmen (D&D 5e Stufe 3)

- Checks standardmäßig **+5** (16er Mainstat + Prof +2).
- Szenario-Varianten können “Spezialisten” abbilden (z.B. +5/+3/+1).

## Wie läuft die Simulation?

Der Runner (`src/playtest/runner.ts`) führt Monte-Carlo-Simulationen durch:
- Pro Run: Kampagne erstellen, 4 Spieler joinen.
- Pro Runde:
  1. GM schaltet `maintenance → actions` (Unterhalt + Einkommen werden angewandt).
  2. Jeder Spieler macht optional die Sonderaktion (Facility).
  3. Jeder Spieler versucht bis zu **2 Aktionen** (Agent liefert priorisierte Kandidaten; Runner führt die erste valide aus).
  4. GM schaltet `actions → conversion → reset → maintenance`.
- RNG ist **seeded** (reproduzierbar).

## Metriken (Report)

Der Report enthält u.a.:
- **Final-Gold** pro Agent (mean, p10/p50/p90)
- **Win-Rate**: Anteil der Runs, in denen ein Agent am Ende das meiste Gold hat (Ties zählen als Win)
- **Gini** (Final-Gold-Ungleichheit): mean/p50/p90 über alle Runs
- **Milestones**: Runde des ersten Erfolgs (erstes Amt, erstes Domänen-Upgrade, erstes Lager); inkl. `neverRate`
- **Idle-Rate**: Anteil “verlorener” Aktions-Slots (keine valide Aktion gefunden)
- **Action Outcome Tiers** (veryGood/good/success/poor/fail) pro Action-Key
- **Verkauf (SellMaterials)**: Gold pro Investition + Marktmodifikator pro Investition (als Verteilungswerte)
- **Conversion**: durchschnittliches Gold aus Auto-Conversion + durchschnittlich gelagerte RM/SM + RM-Verluste
- **Facility Counts** (wie oft gebaut)
- **Fehlerhäufigkeit** (Rule-/Command-Errors)
- **Systemverteilungen**: Markt- und Ereignis-Frequenzen (Welche Tabellenwürfe wie oft?)

## CLI: so führst du Playtests aus

```bash
# Szenarien anzeigen
bun run playtest --list-scenarios

# Default
bun run playtest

# Größere Samples + Report
bun run playtest --runs 500 --rounds 30 --seed 1 --scenario core-v0-all5 --out playtest-core-v0-all5.json --pretty
```

Neue Szenarien:
- `core-v0-marketaware` enthält einen **Spekulanten** (market-aware), um zu testen ob Markt/Lager echte Entscheidungen erzeugen.

## Prompt-Generator (LLM-Auswertung)

Wenn du den Report automatisiert von einem LLM (z.B. Gemini/Claude) auswerten lassen willst, generiert dieses Skript einen “Analyse-Systemprompt” inkl. Regel-Snapshot:

```bash
bun run playtest --runs 500 --rounds 20 --seed 42 --scenario core-v0-marketaware --out playtest.json --pretty
bun run playtest:prompt --report playtest.json --out analysis-prompt.md --pretty
```

## CLI: LLM-Run (Claude Opus 4.5)

Neben dem Monte-Carlo-Runner gibt es einen **asynchronen LLM-Runner** (`src/playtest/llm.ts`), der eine Kampagne über mehrere Runden spielt:
- Engine bleibt autoritativ (Commands werden gegen die Regeln validiert).
- Das LLM wählt pro Zug aus einer **fixen Candidate-Liste** (keine freien “Regelinterpretationen”).

```bash
# Voraussetzung:
# - ANTHROPIC_API_KEY ist gesetzt (z.B. in .env)

# Szenario mit LLM-Spielern (4 Spieler aus dem Szenario)
bun run llm-play --rounds 20 --seed 42 --scenario core-v0-all5 --out llm-run.json --pretty

# Oder: N generische Spieler (Checks +5)
bun run llm-play --players 4 --rounds 20 --seed 42
```

## Erste Ergebnisse (v0, Kernökonomie)

Beobachtung: In der v0-Kernökonomie waren **kleine Ämter (Gold-Ertrag)** der stärkste Snowball-Treiber. Wir testen daher als erstes Balancing-Tweak:

- **Kleines Amt: 4 Einfluss ODER 2 Gold** (statt 4 Gold)

Hinweis: Zahlenbeispiele aus älteren Runs (ohne Markt/Ereignisse) sind nicht mehr 1:1 vergleichbar – bitte die aktuellen Reports neu erzeugen.

Interpretation (Kernlogik, ohne Gegner/Ereignisse):
- **Amt-Ertrag** skaliert linear und ist “dauerhaft” → Snowball-Risiko. Mit **2 Gold** ist die Ungleichheit deutlich geringer, aber Ämter bleiben ein starker Pfad.
- **Fehlschlag ohne Ressourcenverlust** bei “Amt erlangen” macht den Versuch nahezu risikoarm (nur Opportunitätskosten einer Aktion).
- Domänenausbau bringt zwar RM→Gold, hat aber Unterhalt und ist im Vergleich zum Amt oft schlechterer ROI.

## Was tun (wenn wir Balancing wollen)?

Optionen, die sich gut per Playtest verifizieren lassen:
- **Amt-ROI entschärfen**: geringerer Gold-Ertrag, höherer Preis, Unterhalt, oder “Ertrag erst ab nächster Runde / nach X Runden”.
- **Risiko/Trade-offs erhöhen**: bei Fehlschlag Teilkosten/Einflussverlust, oder Cooldown (nicht jede Runde versuchen).
- **Caps / Diminishing Returns**: z.B. nur N kleine Ämter pro Abschnitt, oder progressive Kosten.
- **Andere Pfade buffen**: Domänenausbau/Handel attraktiver machen (mehr Nettoertrag, weniger Upkeep, bessere Synergien).
- **Gegendruck & Ereignisse** in den Playtest integrieren: Steuern, Krisen, Gegnerreaktionen als Gold-/Einfluss-Sinks, damit Snowball gebremst wird.

Der Vorteil der aktuellen Architektur: Wir können diese Änderungen als neue `rulesVersion` ablegen und Playtests “A/B” vergleichen.
