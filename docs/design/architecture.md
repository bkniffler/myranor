# Architektur & Stack (Neustart)

Dieses Dokument hält die technischen Entscheidungen für den Neustart fest (Engine/API/LLM/Client). Quelle der Regeln ist `docs/reference/Aufbausystem.md`; `docs/design/concept.md` beschreibt die Zielrichtung (hybrid: LLM + deterministische Logik).

## Ziele / Leitprinzipien

- **Deterministisch & prüfbar:** Alle Regeln, Berechnungen und Würfe laufen in einer deterministischen Engine (TypeScript). Ergebnis muss aus Logs reproduzierbar sein.
- **Engine ist Autorität:** Kein Client und kein LLM darf “Regeln interpretieren” oder Zahlen erfinden. Das LLM darf nur beraten/narrativ formulieren und Tools aufrufen.
- **Event-Log statt “mutable state”:** Spielzustand entsteht aus Events (append-only) + Snapshots für schnelle Reads.
- **Trennbare Backends:** Storage/DB ist austauschbar (Start simpel, später Trailbase).
- **German-first:** Bot und User-Flows sind auf Deutsch.
- **Online-first:** Aktionen laufen über API; offline read-only ist optional (z.B. via TanStack DB).

## Stack (v0 → v1)

- **Runtime/Server:** Bun
- **Language:** TypeScript
- **LLM:** `ai` + `@ai-sdk/anthropic` (Opus 4.5 als “High quality” Modell; optional später günstigere Modelle für Routine)
- **Data (Start):** JSON/Datei-basiert oder SQLite (dev) → später Trailbase (prod)
- **Client (später):** React Native (Chat + Dashboard); offline read-only per TanStack DB/Sync
- **Validation:** Zod (Schemas für Commands/Events/Tool-Inputs)
- **Logging:** strukturierte JSON-Logs + persistierter Audit-Trail (Events, Würfe, Commands)

## Domänenmodell (high-level)

### Kampagne (shared)

Enthält alles, was für alle sichtbar ist und den globalen Ablauf bestimmt:
- Runde/Phase (Unterhalt → Aktionen → Umwandlung → Reset)
- Marktstatus (Rohmaterial-/Sondermaterial-Nachfragewürfe)
- Globale Ereignisse (Ereignistabellen, Abschnitte alle 5 Runden etc.)
- Öffentliche Effekte/Resultate von Spieleraktionen

### Spieler (pro User)

Pro Kampagne hat jeder User zusätzlich eigenen Zustand:
- Ressourcen/Assets des Spielers (Gold, AK, Einfluss, RM/SM, Posten, Einrichtungen, Truppen etc.)
- **Private Informationen:** z.B. Notizen, Pläne, verdeckte Aktionen/Details (falls ihr das wollt)

### Sichtbarkeit / Privacy

- **Public Events:** alle Ergebnisse, die “am Tisch passieren” (Bau abgeschlossen, Verkauf durchgeführt, Ertrag erhalten, Phase gewechselt).
- **Private Events:** Details, die nur der Spieler (und GM) sehen darf (z.B. interne Notizen, konkrete Würfel-/Planungsdetails wenn gewünscht).
- Der Server liefert getrennte Views:
  - `publicState` (für alle)
  - `privateState` (nur Owner + GM)
  - optional: `publicEventStream` + `privateEventStream`

## Architektur

### 1) Core Engine (pure TS, UI-agnostisch)

- **Input:** `Command` (intent) + Kontext (Actor, Kampagne, Phase)
- **Output:** `Event[]` (facts) + optional `Error` (regelverletzend)
- **Reducer:** `applyEvent(state, event) -> state`
- **Invariants:** Ressourcen nie negativ, Caps/Deckelungen, prerequisites (Werkstatt-/Domänenstufen etc.)
- **Rule-Versioning:** Events enthalten `rulesVersion`, damit spätere Änderungen nachvollziehbar/migrierbar bleiben.

Wichtig: Keine IO, kein Bun/Node-spezifischer Code, kein Netzwerk, kein LLM im Core.

### 2) Server/API (Bun)

Aufgaben:
- AuthN/AuthZ (GM vs Player)
- Commands annehmen, validieren (Zod), gegen Engine ausführen
- Events atomar persistieren + Snapshots aktualisieren
- Read-APIs für public/private State + Event-Stream
- GM-only: Phase/Runde weiterschalten

### 3) LLM Layer (Protodemestikon-Persona)

- LLM bekommt **nur** den nötigen Kontext (public/private State) und agiert als deutsche “Verwalter”-Persona.
- LLM darf **keine** Regeln/Mathe “final” ausgeben ohne Engine-Bestätigung.
- Interaktion läuft über Tools (Function Calling):
  - `getPublicState(campaignId)`
  - `getPrivateState(campaignId, playerId)`
  - `submitCommand(...)`
  - `gmAdvancePhase(...)` (GM-only)
  - optional: `explainRule(reference)` / `searchRules(query)` (rein informativ, keine State-Änderung)

## Würfel/RNG (serverseitig, logged)

- **Engine würfelt serverseitig.**
- Jeder Wurf wird als Event persistiert (z.B. `DiceRolled` mit Zweck, Formel, Ergebnis).
- “Server is trusted”, aber **Logs sind Pflicht**: Auditierbarkeit/Replays/debugging.
- Optional später: Seed pro Runde + deterministic PRNG; trotzdem Ergebnis-Events speichern (robust gegen Rule-Changes).

## Storage: “Swappable Backend”

Definiere Interfaces, z.B.:
- `EventStore.append(campaignId, events, expectedVersion)`
- `EventStore.readStream(campaignId, fromVersion?)`
- `SnapshotStore.get/put(campaignId, version)`

Implementierungen:
- **v0:** JSON-Dateien (schnell zum Start, gut fürs Debugging)
- **v0.5:** SQLite (lokal, stabil, schnell)
- **v1:** Trailbase (prod, multi-user, auth, sync)

## API-Skizze (minimal)

- `POST /campaigns` (GM erstellt Kampagne)
- `POST /campaigns/:id/join` (Spieler join)
- `POST /campaigns/:id/commands` (Player/GM submits Command)
- `POST /campaigns/:id/advance` (GM-only: Phase/Runde)
- `GET /campaigns/:id/state/public`
- `GET /campaigns/:id/state/private` (auth required)
- `GET /campaigns/:id/events/public?from=...`
- `GET /campaigns/:id/events/private?from=...` (auth required)

Transport für “live updates”:
- v0: Polling
- v1: SSE/WebSocket (ideal für TanStack DB Sync)

## Logging / Audit

- Persistierter Audit-Trail:
  - Command (wer, wann, payload, requestId)
  - daraus resultierende Events (inkl. dice rolls)
  - Snapshot-Versionen
- Strukturierte Logs (JSON) für Debugging/Monitoring.
- Optional: LLM-Logs (Prompt/Toolcalls) mit Redaction für Secrets/PII.

## Entscheidungen (fest)

- **GM schaltet Phasen/Runden weiter.**
- **Private Infos:** Spieler sieht alles, was er tut; andere sehen nur, “was passiert”.
- **Server ist trusted**, aber: **lückenloses Event-/Würfel-Logging**.
- **Kein Offline-first**; Aktionen benötigen API-Zugriff. Offline read-only ist optional.

## Nächste Schritte (empfohlen)

1. Minimalen Engine-Slice definieren: Runden/Phasen + Ressourcen + 3 Basisaktionen (Einfluss/Geld/Material) + automatische Umwandlung + Reset.
2. Command/Event-Schemas festlegen (Zod) + `rulesVersion` Strategie.
3. File/SQLite EventStore + SnapshotStore implementieren.
4. Bun API endpoints bauen (inkl. GM/Player Rollen).
5. LLM Tool-Interface & Systemprompt (“Protodemestikon”, Deutsch, tool-only für Änderungen).
6. Playtests automatisieren: siehe `docs/dev/playtest.md` (Monte Carlo Runner + Metriken).
