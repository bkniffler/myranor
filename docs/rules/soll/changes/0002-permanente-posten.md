# Dokument 2: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

## Permanente Posten (Soll): Definition, Caps, Erträge

## Änderung

In `docs/rules/soll/aufbausystem.md` wird eine neue Sektion **„Permanente Posten (Soll)“** eingeführt bzw. erweitert, die:

- den Begriff **Posten** definiert (Domänen, Stadtbesitz, Circel/Collegien, Ämter, Handelsunternehmungen, Truppen),
- **Posten-Caps** (4 pro Typ und Größe; Ausnahme kleine Ämter bis 8; Truppen ohne Einheiten-Cap) festhält,
- die **Posten-Erträge (Maintenance/Ressourcenphase)** strukturiert und
- die Soll-Details für die genannten Postenarten zusammenfasst (Unterhalt, Ertrag, Konfiguration, Vorteile/DC-Senkungen, Beschränkungen).

## Kerndetails (Soll)

### Posten-Caps

- Max. 4 Posten pro Typ und Größe (z.B. Stadt klein/mittel/groß jeweils max 4).
- Ausnahme: kleine Ämter max 8; mittlere/große Ämter max 4.
- Truppen: kein Einheiten-Cap (separate Caps je Truppentyp).

### Domänen (Soll-Update)

- Kleine Domäne: 2G Unterhalt; 2 AK + 12 RM; Rohmaterial-Auswahl (2 billig + 1 einfach; keine Bonus-Gold-RM).
- Mittlere Domäne: 4G Unterhalt; 4 AK + 24 RM; Auswahl (3 billig + 2 einfach; genau 1 Bonus-Gold-RM).
- Große Domäne: 8G Unterhalt; 8 AK + 36 RM; Auswahl (4 billig + 3 einfach; genau 1 Bonus-Gold-RM; 1 einfach darf durch teuer ersetzt werden).
- Vorteil: DC -1 auf Materialgewinn für passende Aktionsgröße (klein/mittel/groß).

### Stadtbesitz (Soll-Update)

- Verpachtet: liefert AK/Einfluss/Gold; DC -1 auf Einflussgewinn/Politik bei passender Aktionsgröße.
- Eigenproduktion: liefert AK; kostet Unterhalt; schaltet zusätzliche Werkstatt/Lager-Kapazitäten frei (2 small/1 medium bzw. 2 medium/1 large bzw. 2 large).

### Circel/Collegien (Soll-Update)

- HQ-Binding an Stadtbesitz-Tier pro Stufe; Facility-Caps und DC-Senkungen (nicht kumulativ je Art).
- Unterwelt/Spion/Kult/Collegium jeweils mit Unterhalt/Ertrag/Vorteilen wie im Soll-Text.

### Ämter (Soll-Update)

- Ämter kumulieren (kein Ausbau), Voraussetzungen 2→1 Upgrade-Kette.
- Erträge: klein 4 Inf oder 3G; mittel 8 Inf oder 10G; groß 16 Inf oder 20G.
- Vorteile: DC-Senkungen + Bonusaktionen (groß).

### Handelsunternehmungen (Soll-Update)

- Pro Stufe zusätzlicher Markt; 1 pro Markt; 2 allgemeine Einrichtungen pro Stufe.
- Unterhalt/Ertrag/Vorteil (DC -1 Geldgewinn bei passender Investitionsgröße).

### Truppen (Soll-Update)

- Leibgarde, Milizen, Söldner, Protectoren/Schläger: Kosten/Unterhalt/Größen-/Cap-Regeln wie im Soll-Text.

## Implementierungs-Impact (Kurz)

Betroffen (bei Umsetzung):
- Holdings-/Cap-Validierung (pro Typ/Tier; Amt-Sonderfall; Truppen separat)
- Maintenance/Unterhalt-Logik (insb. „ruhen bei Nichtzahlung“)
- DC-Modifikatoren (Domänen-/Stadt-/Amt-/Orga-/Trade-Boni) inkl. globalem `-4` Cap
- Markt-Instanzen (TradeEnterprise pro Tier, “1 pro Markt” Restriktion)

