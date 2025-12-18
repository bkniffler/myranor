# Myranor Aufbausystem (Engine + API)

## Overview
Deterministische Engine + zentrale API für das Aufbausystem aus `Aufbausystem.md` (LLM nur als UI/Persona via Tools).

## Project Structure

```
src/
├── core/                   # Engine (pure TS, event-sourced)
└── server/                 # Bun API (file backend first)
```

## Architecture

Siehe `ARCHITEKTUR.md`.

## Running the Game

```bash
cp .env.example .env
bun install
bun dev
```

## Playtesting (Monte Carlo)

```bash
# Szenarien anzeigen
bun run playtest --list-scenarios

# Default-Run (200 Runs, 20 Runden)
bun run playtest

# Report als JSON speichern
bun run playtest --runs 500 --rounds 30 --seed 42 --scenario core-v0-specialists --out playtest.json --pretty
```

## Playtest Analysis Prompt (optional)

```bash
# Prompt für ein Analyse-LLM generieren (keine Netzwerkanfrage, nur Text/Markdown)
bun run playtest:prompt --report playtest.json --out analysis-prompt.md --pretty
```

## LLM Play (Claude / Anthropic)

Setze `ANTHROPIC_API_KEY` (z.B. in `.env`) und starte einen einzelnen Run mit LLM-Spielern:

```bash
# Standard: nutzt MYRANOR_ANTHROPIC_MODEL (default: claude-opus-4-5)
bun run llm-play --rounds 20 --seed 42 --scenario core-v0-all5 --out llm-run.json --pretty

# Alternativ: generische Spieleranzahl
bun run llm-play --players 4 --rounds 20 --seed 42
```
