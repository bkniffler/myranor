# Dokument 5: Myranor Aufbausystem (Soll) — Source of Truth — Change Document

Status: angenommen (Soll), nicht automatisch in Engine umgesetzt

Hinweis: Die Pächter‑Regel „+1 einfaches RM“ ist überholt; siehe `docs/rules/soll/changes/0008-errata.md` (jetzt `+2` billige RM aus der Domänenproduktion).

## Einrichtungen & Spezialisierungen (Soll): Werkstätten/Lager, Pächter/Anhänger, Katalog

## Änderung

Wir ziehen die detaillierten Regeln zu Einrichtungen/Spezialisierungen in ein eigenes, kanonisches Dokument:
- `docs/rules/soll/facilities.md` (Source of Truth, Soll)

Zusätzlich werden in `docs/rules/soll/aufbausystem.md` die Grundregeln zu Werkstätten/Lagern sowie Pächter/Anhänger ergänzt/angepasst und auf den neuen Katalog verwiesen.

## Kerndetails (Soll)

### Werkstätten & Lager

- **Caps (Domäne)**: klein `1× klein`, mittel `1× mittel`, groß `1× klein + 1× mittel` (Werkstatt oder Lager; belegen Domänen‑Einrichtungsplätze)
- **Caps (Stadtbesitz Eigenproduktion)**: klein `2× klein` oder `1× mittel`, mittel `1× klein + 1× mittel`, groß `1× groß + 1× mittel` (belegen **keine** Slots des Stadtbesitzes)
- **Werkstatt‑Betrieb** (automatisch in Umwandlungsphase, wenn Unterhalt gezahlt):
  - klein: `8 RM → 2 SM` (4:1) oder `8 RM → 8 verbesserte RM` (1:1); Unterhalt `1 AK`
  - mittel: `12 RM → 3 SM` oder `12 RM → 12 verbesserte RM`; Unterhalt `2 AK + 1 Gold`; Vorteil `+1 SM`
  - groß: `24 RM → 6 SM` oder `24 RM → 24 verbesserte RM`; Unterhalt `4 AK + 3 Gold`; Vorteil `+2 SM`
- **Lager**: Kapazität `15/25/40 RM` und `5/10/15 SM` (klein/mittel/groß) mit Unterhalt `1/2/3 AK`

### Pächter / Anhänger / Klienten

- Pächter/Anhänger gelten als Sondereinrichtung mit Caps nach Posten/Tier.
- Pro Stufe (250 Personen): `+1 AK` + `+1 Gold`;
  - auf Domänen zusätzlich `+2 billige RM` (aus der bereits gewählten Domänen‑Produktion; falls keine billige RM gewählt wurde: passend zur Spezialisierung).
- Loyalität/Unruhen/Abwanderung sind im Facilities‑Katalog als v1‑Mechanik spezifiziert; Details können später erweitert werden.

## Dateien

- Neuer Soll‑Katalog: `docs/rules/soll/facilities.md`
- Anpassungen/Verweise: `docs/rules/soll/aufbausystem.md`
