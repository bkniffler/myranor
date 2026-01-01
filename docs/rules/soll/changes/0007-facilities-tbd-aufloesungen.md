# Dokument 7: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

## Ziel

Wir lösen die offenen Detail‑TBDs aus `docs/rules/soll/facilities.md` anhand der zuletzt beantworteten Checklist‑Fragen auf und machen die Regeln als Soll‑Source‑of‑Truth explizit.

## Änderungen (Soll)

### 1) Verteidigungsprobe (Begriffsdefinition)

- In `docs/rules/soll/facilities.md` ist eine klare Definition der **Verteidigungsprobe** ergänzt (Standard‑DC 10, Wurf, Modifikatoren, Erfolgsstufen‑Verweis).

### 2) Fachkräfte anwerben (Prozess + Tabellen)

- In `docs/rules/soll/facilities.md` ist der Soll‑Prozess „Fachkräfte anwerben“ ergänzt:
  - Free‑Action „Einrichtungen errichten/ausbauen“
  - DC 10 (+4/+8 für erfahren/meisterlich)
  - danach Anwerbetabelle + Charaktertabelle
- Dazu sind kanonische Tabellendateien angelegt:
  - `docs/rules/soll/tables/fachkraefte-anwerbetabelle.md`
  - `docs/rules/soll/tables/fachkraefte-charaktertabelle.md`

### 3) Domänenspezialisierungen: Detailwerte

- Landwirtschaft: **Große Mühlanlagen** und **Mechanische Mühle** mit Bauzeit/Kosten/Umwandlung konkretisiert.
- Tierzucht: Paket‑Outputs (Schafe/Schweine/Rinder/Varken/Pferde) konkretisiert.
- Tierzucht: **Schlachthaus** (inkl. Upgrade) und **Schlachtrosszüchtungen** konkretisiert.
- Forst: **Jagdgebiet** Output konkretisiert.
- Bergbau/Steinbruch: Fokus‑Outputs sowie **Schmelzöfen** und **Tiefenschacht** (inkl. Upgrade) konkretisiert.

### 4) Stadtspezialisierung „Verbrecher‑ und Schutzgeldbezirk“

- Effekt und konkrete Sonder‑Einrichtungen (Geheimtunnel/Hehlerring/Spielhöllen/Sluminsulae/Exklusives Badehaus) ergänzt.

### 5) Ereignis‑Trigger & RPG‑Abgrenzung

- „Suppenküchen“: Hungersnot‑Trigger festgelegt (Events 2/8/17/29) und Stack‑Regel ergänzt.
- „Heilige Artefakte“: als **RPG‑Only** markiert (für Aufbausystem/Engine derzeit ignorieren).
- „Primärliturgie“: Auto‑Recruit alle 4 Runden, LO‑Start +2, Quest/Frömmigkeit ignorieren.

### 6) Ämter/Handel/Truppen: Klarstellungen

- Ämter:
  - „Klienten als Botenläufer…“: Bonus auf politische Schritte + Verteidigungsproben explizit.
  - „Sonderarchiv“: `+2` Intrigen‑Verteidigung, Info‑Kosten `-2 Gold`.
  - „Ämterverkauf“: Werte/Bindung/Skalierung (mittel/groß) konkretisiert.
  - Caps für allgemeine vs besondere Amtseinrichtungen präzisiert.
- Handelsunternehmungen:
  - „Günstige Abnahmeverträge“: „Marktzugang“-Text entfernt.
  - „Honoratische Handelsagenten“: Politische‑DC‑Modifikator konkretisiert.
  - „Handelsschiff“ als besondere Einrichtung spezifiziert; Karawane als allgemeine Einrichtung spezifiziert.
- Truppen:
  - Allgemeine + besondere Truppen‑Einrichtungen vollständig als Listen in `docs/rules/soll/facilities.md` ergänzt.
  - Waffenkammer‑Cap/Anwendung, Veteranen‑Unterführer‑Chance, Pensionskasse‑Zyklus und Reserveeffekt präzisiert.

### 7) Privatbastionen (WIP‑Stub)

- `docs/rules/soll/privatbastionen.md` angelegt (WIP) inkl. Definition „Abschnitt = Baurunde“ für Baumeister‑Bauzeitreduktion.

## Dateien

- `docs/rules/soll/facilities.md`
- `docs/rules/soll/privatbastionen.md`
- `docs/rules/soll/tables/fachkraefte-anwerbetabelle.md`
- `docs/rules/soll/tables/fachkraefte-charaktertabelle.md`
