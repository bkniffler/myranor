# Dokument 8: Myranor Aufbausystem (Soll) — Source of Truth — Errata/Klarstellungen

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

Dieses Dokument bündelt **Klarstellungen** zu früheren Change‑Docs, damit alle Soll‑Dokumente konsistent bleiben.

## Änderungen (Soll)

### 1) Spezialisierungen: immer genau 1 pro Posten/Werkstatt

- Pro Posten (Domäne/Stadtbesitz/Circel/Collegium/Handelsunternehmung/Truppen etc.) gilt: **max. 1 Spezialisierung**.
- Pro Werkstatt gilt ebenfalls: **max. 1 Spezialisierung**.
- Es gibt **keine** Ausnahme „große Posten können mehrere Spezialisierungen haben“.

Betroffene ältere Texte:
- `docs/rules/soll/changes/0003-einrichtungen.md` (früher: „große Posten können mehrere ermöglichen (TBD)“)

### 2) Pächter-Bonusmaterial: +2 billige RM (nicht +1 einfaches RM)

- Pächterstufen (Domäne) geben zusätzlich:
  - `+2` **billige RM** pro Pächterstufe (aus der bereits gewählten Domänen‑Produktion)
  - wenn die Domäne **keine** billige RM gewählt hat: wähle ein zur Spezialisierung passendes billiges RM.

Betroffene ältere Texte:
- `docs/rules/soll/changes/0005-facilities.md` (früher: „+1 einfaches RM“)

## Eingepflegt in

- `docs/rules/soll/aufbausystem.md`
- `docs/rules/soll/facilities.md`
