# Dokument 1: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

Dieses Change Document umfasst Anpassungen an:
- **Rundenablauf**
- **Erfolgswürfe & Checks**
- **Aktionen (Kurzfassung)**

## Änderung

Die Sektionen **„Rundenablauf“**, **„Erfolgswürfe & Checks“** und **„Aktionen (Kurzfassung)“** im Soll-Dokument werden angepasst/ergänzt.

Die vollständigen Fassungen sind in `docs/rules/soll/aufbausystem.md` eingepflegt.

## Rundenablauf: Global (Events/Markt) + Spielerphasen

Die Sektion **„Rundenablauf“** wird ersetzt/erweitert, sodass der Ablauf explizit in:

1) **Global** (für alle Spieler) und  
2) **Pro Spieler** (der Reihe nach)  
aufgeteilt ist.

## Kerndetails (Soll)

### Global

- **Ereignisphase**: ab Runde 2 werden 2 Ereignisse gewürfelt; gelten **4 Runden**.
- **Marktphase**: Markt (Roh + Sonder) wird für die **nächsten 4 Runden** festgelegt; der Startmarkt gilt für alle; zusätzliche private Märkte können durch Posten/Einrichtungen freigeschaltet werden.

### Pro Spieler

1. **Ressourcenphase**: Reset + Ausschüttung + Wahl-Erträge (z.B. Amt: Gold vs Einfluss) + delayed payouts; alles außer **Gold** und **Information** ist temporär.  
2. **Unterhaltsphase**: ab Runde 2 Unterhalt zahlen; wenn nicht zahlbar, ruht die Funktion; zusätzlicher Unterhalt für AK/KK via Nahrung oder Gold; Untote via Zauberkraft (`4` untote Einheiten = `1 ZK`).  
3. **Aktionen**: 2 Standardaktionen, keine Wiederholung innerhalb der Standardaktionen (Unteraktionen zählen getrennt); 1 freie Einrichtungsaktion + optional Standardaktion für Bau; Bonusaktionen dürfen wiederholen.  
4. **Umwandlung**: Werkstätten/Lager/weitere Umwandlungen; automatische Umwandlung am Rundenende (4 temporär → 1 Gold; 1 SM → 2 Gold); Reset der Pools.

## Implementierungs-Impact (Kurz)

Das ist **nicht nur Doku**, sondern greift in mehrere Engine-Subsysteme ein:

- Event-/Markt-Timing: von „pro Runde/5er Abschnitt“ auf **4-Runden-Fenster** (und Eventstart ab Runde 2).
- Market-State: Persistenz über 4 Runden + private Zusatzmärkte.
- Unterhalt: „nicht zahlbar ⇒ Funktion ruht“ (statt „Gold kann negativ werden“).
- Neue automatische Umwandlung von ungenutzter AK/KK/temporärem Einfluss in Gold.
- Per-Runde Wahl-Erträge (z.B. Ämter) als explizite Entscheidung in der Ressourcenphase.

## Erfolgswürfe & Checks

Ziel: DnD-artige Proben-Definition inkl. klarer Erfolgsstaffelung und DC-Handling.

- Probe: `1w20 + Attributsmodifikator` gegen `DC` (geschafft bei `>= DC`).
- Start-Modifikator: **+3**, Steigerung voraussichtlich **alle 6 Runden +1**.
- Investitions-/Größen-Modifikator (Standard): klein `+0`, mittel `+4`, groß `+8` (konkret pro Aktion definiert).
- DC-Senkungen aus Posten/Einrichtungen sind insgesamt auf **max. -4** gedeckelt.
- Erfolgsstufen: sehr gut `+10`, gut `+5..+9`, geschafft `0..+4`, schlecht `-1..-5`, Fehlschlag `< -5`.

## Aktionen (Kurzfassung)

Ziel: Investment-Definitionen, Caps, DC-Schwellen und Erfolgsstaffelungen explizit machen.

- **Einflussgewinn**: temp (1G→4) vs perm (2G→1), Caps nach Amt/Circel/Collegium; DC 12; mittel ab 8 Invest, groß ab 12.
- **Geldgewinn**:
  - Geldverleih (2G→4G nächste Runde), Caps nach Handelsunternehmung; Option „Sichere Anlage“ (Influence sofort, Gold später, DC-2).
  - Kauf/Verkauf als Investitionspakete (6 RM / 1 SM / 1 temporäre AK) inkl. Markt-/Eventlogik; Kauf kann mit Verkauf kombiniert werden (Kaufware nächste Runde).
- **Materialgewinn**: Domänenverwaltung (DC 10) und Werkstattüberwachung (DC 12), Caps nach Tier; mittel ab 8 Invest, groß ab 12; Erträge nach Erfolgsstufe.
- **Gewinn permanenter Posten**: Kosten/Anforderungen nach Postenart; DC-Regeln nach Kategorie (Domäne/Stadt/Werkstatt vs Amt/Orga vs Truppen); Kostenmodifikatoren über Erfolgsstufe.
- **Politische Schritte**: definiert (Beschädigen/Verteidigen, Manipulieren, Loyalität sichern) inkl. Investment- und DC-System.
- **Einrichtungen**: freie Aktion 1×/Runde, gelingt automatisch; Upgrades (Tier) mit DC-2 und Kosten minus Vorstufe.
