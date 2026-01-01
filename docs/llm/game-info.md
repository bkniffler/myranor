# LLM-Game-Info (Engine v1, derived)

Diese Datei ist eine **Kurzfassung für das LLM** und wird aus dem implementierten Regelstand abgeleitet.
Primäre Referenz: `docs/rules/rules-v1.md`.

## Ziel / Score

- Ziel: **Net Worth / Score (GoldEq) maximieren**.
- Score enthält (gewichtet) u.a.:
  - `Gold` + `pending.gold`
  - Inventar als GoldEq (Auto-Conversion Werte)
  - temporäre Pools (`AK`, `Einfluss`) und permanente Pools (`perm. AK`, `perm. Einfluss`)
  - Assets (Domänen/Stadtbesitz/Ämter/Orgs/Handel/Werkstätten/Lager/Truppen/Fachkräfte)

## Rundenablauf (v1)

Phasen: `maintenance → actions → conversion → reset`

- **maintenance → actions**:
  - Markt-Roll (nur am Markt-Abschnittsstart)
  - Event-Roll (nur am Event-Abschnittsstart)
  - Neider-Gegenreaktion (wenn `N >= 3/6/9`)
  - Einkommen/Unterhalt werden angewandt
  - Langzeitvorhaben (Bauzeit) schreiten fort (falls AK/ZK verfügbar)
- **actions**: bis zu 2 Standardaktionen + ggf. 1 freie Facility-Action
- **conversion**: Werkstatt-Konversion, Lagerung, Auto-Conversion
- **reset**: Pools werden neu gesetzt

## Aktionen pro Runde (v1)

- Standard: **2 Aktionen**
- Zusätzlich: **1 freie Facility-Action** („Einrichtungen/Ausbau“)
- Standardaktionen dürfen nicht zweimal denselben canonical Action-Key nutzen (z.B. nicht zweimal `money.sell`).

## Langzeitvorhaben (Bauzeit, v1 subset)

- Einige Einrichtungen starten als Projekt statt sofort gebaut zu werden (z.B. `general.medium.city.insulae`).
- Start: `BuildFacility` zahlt die erste Bau-Runde (AK/ZK) sofort und legt ein Projekt an.
- Fortschritt: im Maintenance wird pro Runde weitergezahlt (AK/ZK); wenn nicht zahlbar, pausiert das Projekt.
- Abschluss: im Maintenance→actions-Übergang (Facility ist dann in `actions` verfügbar).
- Event 36 verdoppelt Bau-Arbeitskosten (AK) pro Bau-Runde.

## Checks & Erfolgsstufen (v1)

- Wurf: `1w20 + effectiveCheck`
- `effectiveCheck = base + floor((round-1)/6)` (R1–6:+0, R7–12:+1, …)
- Investitions-DC-Mod (Standard): `+4` ab `>=4` Investitionen, `+8` ab `>=8`
- Erfolgsstufen:
  - `veryGood`: `>= DC+10`
  - `good`: `>= DC+5`
  - `success`: `>= DC`
  - `poor`: `>= DC-5`
  - `fail`: `< DC-5`

## Startzustand (v1)

- Checks: `influence=3`, `money=3`, `materials=3`
- Gold: `4`
- Holdings:
  - Starter-Domäne (`tier=starter`, `rawPicks=[raw.grain]`)
  - Stadtbesitz klein (`tier=small`, `mode=leased`, `tenure=owned`)
  - Start-Werkstatt klein auf Domäne (`raw.grain → special.pulpellen`)
  - Start-Lager klein auf Domäne
  - Start-Amt klein (`yieldMode=influence`)
  - `permanentLabor=2`
  - Persönliche Einrichtungen: `0` (v1-light: `BuildFacility` mit `location.kind=personal`, Key `general.<tier>.personal.*` / `special.<tier>.personal.*`; max 6; erhöht Fachkräfte-Cap um `+1` je Facility)

## Politik (KW/AS/N + Information, v1)

- Politische Schritte arbeiten mit:
  - `KW` (Konsequenzenwert), `AS` (Ansehen), `N` (Neider), `Information`
- Passive Erholung: wenn du in einer Runde **keine** „Politische Schritte“ machst: `KW -1` und `N -1` (min 0).
- `KW` erhöht den DC von Politischen Schritten stufenweise (`+1/+2/+3/+4` ab `KW>=4/8/12/16`).
- `AS` modifiziert v.a. Einflussgewinn & Posten gewinnen (`+2/+1/-1/-2` je nach AS-Schwelle).
- `Information` ist persistent:
  - kann bei Politischen Schritten als Bonus genutzt werden (`+2` pro Info)
  - kann umgewandelt werden: `1 Info → 2 Gold` oder `4 Einfluss`
- Neider-Gegenreaktion (in der Ereignisphase, wenn `N>=3/6/9`):
  - Verteidigungsprobe DC `10/12/14`
  - bei Fehlschlag: du verlierst **wahlweise** `-4/-8/-12 Gold` **oder** `-4/-8/-12 Einfluss`
  - zusätzlich: `AS -1` (N>=3), `KW +2 & AS -1` (N>=6), `KW +4 & AS -2` (N>=9)

## Markt (v1)

- Markt-Abschnitte: **4 Runden** (R1–R4, R5–R8, …)
- Pro Marktinstanz pro Abschnitt:
  - 1 Rohmaterial-Roll (2d6)
  - 1 Sondermaterial-Roll (2d6)
- Verkauf/Kauf nutzen Markt-Modifikatoren (pro Investment).
  - **Kauf** nutzt die Markt-Modifikatoren als **Zuschlag auf die Kosten** (gefragte Ware ist teurer; Gold-Boni werden zu Zusatzkosten).
- Handelsunternehmungen erzeugen zusätzliche private Marktinstanzen (nur für den Besitzer).

## Handelsunternehmungen (v1)

- Erwerb (v1): `20/40/80` Gold (small/medium/large), DC wie „Posten gewinnen“.
- Unterhalt: `small: 2G+1AK`, `medium: 5G+2AK`, `large: 6G+4AK`
- Modes:
  - `produce`: erzeugt pro Runde `special.simpleTools` (`2/3/6`)
  - `trade`: investiert `1/2/4` SM → `4/10/24` Gold (Markt/Event wirken mit)
- Zusätzlich: pro Stufe ein privater Markt (wird alle 4 Runden gerollt wie der Startmarkt).
- Geldgewinn: `-1 DC` bei passenden Investment-Größen (small/medium/large); höhere Stufen zählen auch für kleinere.
- Geldverleih-Investment-Cap hängt vom höchsten Tier ab: `2/4/6/10` Investitionen (ohne/klein/mittel/groß).

## Ereignisse (v1)

- Event-Abschnitte: **4 Runden**, Start ab Runde 2 (R2–R5, R6–R9, …)
- Pro Abschnitt 2 Events (2d20, ohne Duplikate)
- Events beeinflussen DCs, Einkommen, Unterhalt, Marktwerte, Übergriffe/Schäden.

## Materialfluss (Conversion, v1)

### Werkstätten (automatisch)

Werkstätten wandeln in der Conversion-Phase automatisch um, wenn sie in der Runde unterhalten werden:
- Wenn `outputMaterialId` ein **SM** ist: `4:1` (RM→SM), bis zur Kapazität (small/medium/large: `8/12/24 RM` → `2/3/6 SM`), medium/large erhalten zusätzlich `+1/+2` SM Bonus.
- Wenn `outputMaterialId` ein **verbessertes RM** ist: `1:1` (RM→RM), bis zur Kapazität (kein Bonus).

Input ist fix (`inputMaterialId`), Output ist `outputMaterialId` (ggf. durch Refinement aufgewertet, wenn Output ein SM ist).

### Lagerung (automatisch)

Unterhaltene Lager speichern bis Kapazität:
- small: `15 RM / 5 SM`
- medium: `25 RM / 10 SM`
- large: `40 RM / 15 SM`

### Werkstatt/Lager-Caps (v1)

- Domäne: small `1× small`, medium `1× medium`, large `1× small + 1× medium` (keine `large` Werkstätten/Lager auf Domänen)
- Stadtbesitz nur bei `mode=production` (Werkstätten/Lager belegen **keine** Stadtbesitz-Facility-Slots):
  - small: `2× small` **oder** `1× medium`
  - medium: `1× small + 1× medium`
  - large: `1× large + 1× medium`

### Auto-Conversion (am Rundenende)

- Nicht gelagerte Bestände werden zu Gold:
  - RM: Standard `4:1` (Bruchteile erlaubt) + `saleBonusGold` pro 4 Stück
  - SM: `1:2` Gold + `saleBonusGold` pro 4 Stück
  - übrige AK/Einfluss-Pools werden ebenfalls `4:1` zu Gold umgewandelt

Konsequenz:
- Ohne Lager ist Market-Timing schwer (RM/SM verschwinden am Rundenende).

## Wichtige Entscheidungen (v1)

- Lager lohnen sich, wenn du RM/SM über Runden halten willst (Market-Timing, Werkstatt-Input sammeln, Nahrung sichern).
- Werkstätten lohnen sich, wenn du genug RM des richtigen Typs hast **und** den Unterhalt tragen kannst.
- Stadtbesitz auf `production` umstellen lohnt sich vor allem, wenn du danach wirklich Werkstatt/Lager im Stadtbesitz bauen willst (sonst verlierst du Gold+Einfluss aus `leased`).

## LLM-Runner: Candidate-Typen (High-Level)

- Facility:
  - Starter-Domäne ausbauen
  - Stadtbesitz auf Produktion umstellen (nur wenn Werkstatt/Lager danach bau-aktuell möglich)
  - Amt auf `gold` oder `split` umstellen
  - Handelsunternehmung auf `trade` umstellen
  - Werkstatt/Lager bauen/upgraden (Caps beachten; Stadt nur bei `production`)
  - generische Einrichtungen (`general.*`/`special.*`) an Amt/Orga/Handel/Werkstatt
- Actions:
  - Einflussgewinn (temp/permanent)
  - Geldgewinn (Lend / Sell / Buy / Sell+Buy)
  - Materialgewinn (Domäne/Werkstatt)
  - Posten kaufen (Domäne/Stadt/Amt/Org/Handel)
  - Pächter/Anhänger anwerben, Truppen rekrutieren, Fachkraft anheuern
