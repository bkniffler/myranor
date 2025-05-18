# Myranor: Strategiespiel

Ein textbasiertes (CLI) rundenbasiertes Strategiespiel mit Fokus auf Ressourcenmanagement und Aufbau.

## Beschreibung

In diesem Spiel verwaltest du deine Ressourcen, baust dein Reich auf und triffst strategische Entscheidungen.

* Rundenbasiertes Spielprinzip
* Ressourcenmanagement (Gold, Arbeitskraft, Materialien)
* Immobilienaufbau (Domänen, Werkstätten, Lager)
* Verschiedene Spielaktionen

## Voraussetzungen

* [Bun](https://bun.sh/) (JavaScript/TypeScript Runtime)
* Node.js und npm

## Installation

1. Klone das Repository oder lade die Dateien herunter
2. Installiere die Abhängigkeiten:

```bash
npm install
```

## Spielstart

Führe den folgenden Befehl aus, um das Spiel zu starten:

```bash
npm start
```

oder

```bash
bun run src/index.ts
```

## MCP Server (Model Context Protocol)

Der MCP Server ermöglicht es einer KI (wie Claude), das Spiel autonom zu spielen.

### Server starten

```bash
npm run mcp-server
```

Der Server wird auf http://localhost:3000 gestartet.

### Testen mit dem Client

Es gibt verschiedene Modi, um die AI-Spielweise zu testen:

```bash
# Automatisches Durchspielen
npm run mcp-client

# Schrittweises Spielen (5 Runden)
npm run mcp-client:step

# Manuelle Aktionen testen
npm run mcp-client:manual
```

### API-Endpunkte

1. **Spiel initialisieren**
   - `GET /game/init`

2. **Spielstatus abrufen**
   - `GET /game/state`

3. **AI-Aktion ausführen**
   - `POST /game/action`
   - Body: `{ "actionType": 1, "params": { "goldAmount": 10 } }`
   
   Aktionstypen:
   - 1 = Einfluss gewinnen (params: goldAmount)
   - 2 = Materialien verkaufen (params: materialType, sellAmount)
     - materialType: 1=Nahrung, 2=Holz, 3=Werkzeug
   - 3 = Material gewinnen (params: domainIndex)
   - 4 = Posten erwerben (params: propertyType, name)
     - propertyType: 1=Domäne, 2=Werkstatt, 3=Lager
   - 5 = Runde beenden

4. **AI-Spielzug ausführen**
   - `GET /game/turn`

5. **Spielverlauf abrufen**
   - `GET /game/history`

6. **Komplettes Spiel automatisch spielen**
   - `GET /game/autoplay`

## Spielregeln

### Ressourcen

* **Gold**: Hauptwährung für Käufe und Unterhalt
* **Arbeitskraft (AK)**: Wird für Aktionen und Unterhalt benötigt
* **Temporärer Einfluss (tE)**: Wird zu Beginn jeder Runde zurückgesetzt
* **Rohmaterialien**: Nahrung und Holz
* **Sondermaterialien**: Werkzeug

### Spielziel

* Überlebe 30 Runden ohne bankrott zu gehen
* Baue dein Imperium auf und verwalte deine Ressourcen effizient

### Rundenablauf

1. **Rundenbeginn & Info-Anzeige**: Übersicht über alle Ressourcen und Besitztümer
2. **Unterhaltsphase**: Zahlung für Domänen und Einrichtungen
3. **Aktionsphase**: Spieler wählt Aktionen (2 pro Runde)
4. **Produktionsphase**: Domänen und Werkstätten produzieren Materialien
5. **Ressourcenumwandlung**: Überschüssige Materialien werden zu Gold konvertiert

### Aktionen

1. **Einfluss gewinnen**: Investiere Gold für temporären Einfluss
2. **Materialien verkaufen**: Verkaufe Nahrung, Holz oder Werkzeug für Gold
3. **Material gewinnen**: Verwalte Domänen für zusätzliche Materialproduktion
4. **Neuen Posten erwerben**: Kaufe neue Domänen, Werkstätten oder Lager

## Viel Spaß beim Spielen! 