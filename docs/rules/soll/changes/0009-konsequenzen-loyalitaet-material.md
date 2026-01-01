# Dokument 9: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

## Ziel

Wir finalisieren mehrere offene Punkte aus der Checklist‑Phase:
- Konsequenzen/Ansehen/Neider (Schwellenwerte & Effekte)
- Loyalität (Cap + LO‑Probe)
- einige Material-/Facility‑Mappings (magische Materialien, „magische Komponenten“)
- konkrete Detailregeln einzelner Einrichtungen

## Änderungen (Soll)

### 1) Konsequenzen / Ansehen / Neider: Tabelle & Regeln

- `docs/rules/soll/tables/konsequenzen.md` ist von WIP zu einer **spielbaren v1‑Mechanik** ausgebaut:
  - Scope: Werte pro Spieler (global, nicht pro Fraktion)
  - Passive Erholung (wenn keine Politischen Schritte)
  - Schwellenwerte & Effekte für `KW`/`AS`/`N` inkl. Gegenreaktionen über Verteidigungsprobe

### 2) Loyalität: Cap + LO‑Proben

- Loyalität ist auf **`LO 0–6`** gedeckelt (Cap `6`).
- LO‑Proben (wenn gefordert): `1w6`, Erfolg bei `Wurf <= LO` (unterwürfeln).
- Eingepflegt in:
  - `docs/rules/soll/aufbausystem.md`
  - `docs/rules/soll/facilities.md`
  - `docs/rules/soll/tables/fachkraefte-anwerbetabelle.md`
  - `docs/rules/soll/tables/fachkraefte-charaktertabelle.md`

### 3) Bau & „Großbauprojekt“

- Definition: **Großbauprojekt = Bauzeit 4+ Baurunden**.
- Eingepflegt bei **Baumeistercollegium** in `docs/rules/soll/facilities.md`.

### 4) Klerus‑Einrichtung: „Förderung des echten Klerus“

- Effekt präzisiert: Anwerben von **Kleriker‑Fachkräften** kostet `-5 Gold` (min. `0`).
- Eingepflegt in `docs/rules/soll/facilities.md`.

### 5) Truppen‑Einrichtung: Feldscher/Wundärzte Material

- `SM (Medizin)` wird als `SM (Tränke/Elixiere)` interpretiert.
- Eingepflegt in `docs/rules/soll/facilities.md`.

### 6) Magische Materialien: Mapping & neuer Materialtyp

- Flavour‑Namen:
  - Mindorium/Mondsilber/Arkanium/Endurium → `Hochmagische Erze/Metalle` (Materialkatalog).
- Neuer Materialtyp:
  - `Magische Paraphernalia` (teures SM, `+2 Gold` Verkaufsbonus) ersetzt „magische Komponenten“.
- Eingepflegt in:
  - `docs/rules/soll/tables/materials.md`
  - `docs/rules/soll/facilities.md`

### 7) Stadt‑Einrichtung: „Gasse der Kunsthandwerker“

- Kosten/Unterhalt und Umwandlungsoptionen konkretisiert (mehrere Rezepte, Skalierung über Pächter).
- Eingepflegt in `docs/rules/soll/facilities.md`.

## Dateien

- `docs/rules/soll/tables/konsequenzen.md`
- `docs/rules/soll/aufbausystem.md`
- `docs/rules/soll/facilities.md`
- `docs/rules/soll/tables/materials.md`
- `docs/rules/soll/tables/fachkraefte-anwerbetabelle.md`
- `docs/rules/soll/tables/fachkraefte-charaktertabelle.md`
