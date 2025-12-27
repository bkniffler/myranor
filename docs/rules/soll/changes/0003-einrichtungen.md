# Dokument 3: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

## Einrichtungen (Soll): Grundregeln, Caps, Werkstätten/Lager, Spezialisierungen

## Änderung

In `docs/rules/soll/aufbausystem.md` wird eine neue Sektion **„Einrichtungen (Soll)“** ergänzt, die:

- Einrichtungen als Modifikationen innerhalb von Posten definiert,
- allgemeine Einrichtungs‑Caps (2 pro Stufe bei Domänen/Stadtbesitz) festhält,
- Werkstätten/Lager als besondere Einrichtungen mit Sonder‑Caps beschreibt,
- Pächter/Klienten als Zusatz‑Einrichtungen einordnet,
- Spezialisierungen als Teil der Einrichtungen beschreibt (inkl. „Ämter sind immer spezialisiert“),
- sowie auf den Facilities‑Katalog verweist.

## Kerndetails (Soll)

- **Domäne/Stadtbesitz**: i.d.R. 2 Einrichtungen pro Stufe (Klein/Mittel/Groß).
- **Werkstätten**: nur auf Domänen oder Stadtbesitz in Eigenproduktion; Tier ist an die Host‑Größe gebunden; Sonder‑Caps gelten zusätzlich.
- **Lager**: besondere Einrichtung; Sonder‑Caps analog Werkstätten.
- **Pächter/Klienten/Anhänger**: gelten als Zusatz‑Einrichtungen mit eigenen Caps (je Posten).
- **Spezialisierungen**:
  - via freier Einrichtungsaktion,
  - grundsätzlich 1 pro Posten; große Posten können mehrere ermöglichen (TBD),
  - erweitern/ändern Materialarten und schalten besondere Einrichtungen frei,
  - **Ämter** sind immer spezialisiert; Spezialisierung wird beim Erwerb gewählt.

## Referenzen

- Details/Katalog (Soll): `docs/rules/soll/facilities.md`
- Implementiert (Engine v1): `docs/rules/facilities/catalog.md`
