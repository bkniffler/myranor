# Myranor Strategy Game

## Overview
A strategy game set in the Myranor universe where players manage resources, build properties, and make strategic decisions.

## Project Structure

```
src/
├── core/                   # Game core logic (framework/UI-agnostic)
│   ├── commands/           # Command objects representing user actions
│   ├── events/             # Events that occur as a result of commands
│   ├── models/             # Domain models and types
│   ├── engine/             # Game logic and event processing
│   └── config/             # Game configuration
│
├── adapters/               # Interface adapters for different platforms
│   ├── console/            # Console interface
│   └── common/             # Shared UI code
```

## Architecture

This project follows an event sourcing pattern:

1. **Commands**: Represent user intentions (e.g., GainInfluenceCommand)
2. **Events**: Represent facts that have happened (e.g., InfluenceGainedEvent)
3. **State**: Built by applying events sequentially

## Key Concepts

- **Properties (Posten)**: The main entities that players can acquire (domains, city properties, offices, etc.)
- **Facilities**: Buildings that can be constructed on properties
- **Resources**: Gold, labor power, influence, raw materials, and special materials
- **Game Phases**: Maintenance → Action → Production → Resource Conversion → Resource Reset

## Running the Game

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the game
npm start
```

## Development

```bash
# Run tests
npm test

# Start in development mode
npm run dev
```

## Beschreibung

In diesem Spiel verwaltest du deine Ressourcen, baust dein Reich auf und triffst strategische Entscheidungen.

* Rundenbasiertes Spielprinzip
* Ressourcenmanagement (Gold, Arbeitskraft, Materialien)
* Immobilienaufbau (Domänen, Werkstätten, Lager)
* Verschiedene Spielaktionen

## Voraussetzungen

* [Bun](https://bun.sh/) (JavaScript/TypeScript Runtime)
* Node.js und npm

## Spielstart

Führe den folgenden Befehl aus, um das Spiel zu starten:

```