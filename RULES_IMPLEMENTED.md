# Myranor Aufbausystem (Soll) — Source of Truth

Zweck: Dieses Dokument beschreibt die **Soll-Regeln**, die in der Engine umgesetzt sind.
Wenn eine Regel hier steht, **muss** sie im Code so funktionieren.
Wenn eine Regel fehlt, gilt sie als **nicht implementiert**.

Stand: Engine `rulesVersion = v1` (Soll-Stand)

## Scope
- Enthalten: Kernsystem, Aktionen 1–4 und 6, Markt, Ereignistabelle, LLM-Playtest.
- Nicht enthalten: Aktion 5 (Politische Schritte), "Das Erste Lager" (Nomisma/Nahrung/Tiere/etc).

## Rundenablauf
- Phasen: `maintenance -> actions -> conversion -> reset`.
- Pro Runde: 2 Aktionen + 1 freie Einrichtungs-/Ausbauaktion.
- Pro Runde und ActionKey nur 1x (Ausnahme: Bonusaktionen durch spezielle Posten).

## Startbedingungen (Soll)
- Starter-Domaene: tier `starter`, Ertrag 2 AK, 8 RM pro Runde.
- Starter-Domaene hat **Material-Picks** (2 billig + 2 einfach, Nahrung):
  - billig: `raw.grainVeg`, `raw.fruit`
  - einfach: `raw.meat`, `raw.pigsSheep`
- 2 permanente Arbeitskraft.
- Kleine Werkstatt (Starter) auf Starter-Domaene.
- Kleiner staedtischer Besitz, verpachtet.
- Startgold: 4.
- Startchecks: influence=3, money=3, materials=3.

## Ressourcenmodell
- Gold + Pending-Gold.
- Arbeitskraft (AK) pro Runde, Einfluss pro Runde.
- Rohmaterial (RM) und Sondermaterial (SM), typed (`materialId -> count`).
- Permanenter Einfluss, permanente AK.

## Materialien & Markt
- Material-IDs/Tags aus `materials_v1`.
- Markt rollt je Runde 1x Rohmaterial- und 1x Sondermaterial-Tabelle.
- Verkauf/Kauf nutzt Markt-Modifier + Event-Modifier + Material-Bonus.

## Domaenen: Material-Picks (Soll)
- Jede Domaene hat **4 Rohmaterial-Picks** (`rawPicks`).
- Diese Picks bestimmen:
  - Domaenen-Ertrag (Maintenance)
  - Materialgewinn (Domänenverwaltung)
  - Paechter-Zusatz-RM (einfaches RM aus Picks)
- **Landwirtschaft** waehlt **2 billige + 2 einfache** Rohmaterialtypen.
- Standard (falls nicht gesetzt): Domaenen behalten die bestehenden Picks.

## Domaenen-Ertrag (Maintenance)
- Domaenen liefern pro Runde RM nach Tier: starter 8, small 12, medium 20, large 36.
- Der Gesamtbetrag wird **gleichmaessig** auf die 4 `rawPicks` verteilt.
- Ereignis-Modifikationen (Duerre, gutes Jahr, magische Bestien) wirken auf den Gesamtbetrag.
- Zusatz-Ernte (z.B. gute Ernte) geht auf den **ersten** Pick ("Hauptertrag").

## Werkstaetten (Soll)
- Jede Werkstatt hat:
  - `inputMaterialId` (RM, billig oder einfach)
  - `outputMaterialId` (SM, billig oder einfach)
- `inputMaterialId` wird beim Bau festgelegt und gilt als **fix**.
- `outputMaterialId` wird beim Bau festgelegt und ist standardmaessig ein passendes SM zur RM-Kategorie.

## Veredelung (Soll)
- Spezialeinrichtungen koennen Werkstatt-Erzeugnisse **eine Kategorie aufwerten**:
  - billig -> einfach -> teuer -> luxus
- Jede Veredelungs-Einrichtung erzeugt **+1 Upgrade-Stufe** fuer Werkstaetten am selben Ort.
- Luxus wird als **teures Sondermaterial mit Tag `luxury`** umgesetzt.
- Mehrere Veredelungs-Einrichtungen stacken (mehrstufige Aufwertung).
- Veredelungseinrichtung im Code: `facilityKey` beginnt mit `special.{small|medium|large}.refine`.

## Konversion & Lagerung
- Werkstaetten wandeln RM in SM um (4:1) nach Kapazitaet, **nur fuer das eigene `inputMaterialId`**.
- Ergebnis-SM ist `outputMaterialId`, nach Veredelungsstufen ggf. aufgewertet.
- Lagerung: nur in unterhaltenen Lagern, Kapazitaet * storageMultiplier (2x).
- Auto-Konversion (Rundenende):
  - RM -> Gold: 4:1 (Ausnahme bei Hungersnot).
  - SM -> Gold: 1 SM = 2 Gold.
- Nicht gelagerte Reste verfallen.

## Posten-Ertraege (Maintenance)
- Domaenen: RM-Ertrag pro Tier (starter 8, small 12, medium 20, large 36).
- Stadtbesitz (verpachtet): Gold + Einfluss + AK nach Tier.
- Stadtbesitz (produktion): AK nach Tier, kein Gold/Einfluss.
- Aemter: pro Runde entweder Einfluss **oder** Gold (kleines Amt: 2 Gold).
- Organisationen (Unterwelt/Kult/Spion/Collegium): Einfluss/AK je Stufe (v1-Interpretation).
- Handelsunternehmungen: SM oder SM->Gold (Modus `produce`/`trade`).
- Paechter/Anhaenger: +1 Gold/Stufe +1 AK/Stufe; Domaenen zusaetzlich +1 RM/Stufe (einfaches RM aus Picks).

## Unterhalt (ab Runde 2)
- Domaenen, Stadtbesitz (produktion), Organisationen, Handelsunternehmungen, Truppen.
- Werkstaetten/Lager muessen unterhalten werden (sonst inaktiv).
- AK-Unterhalt: 1 RM je 4 AK, fehlende RM reduzieren AK (v1-Interpretation).

## Aktionen (Kurzfassung)

### 1) Einflussgewinn
- Temporaer: investiert Gold -> Einfluss (Erfolgsstaffel).
- Permanent: investiert Gold -> permanenter Einfluss (Erfolgsstaffel).
- Caps: temporaer 4/6/8/12 je Besitz; permanent v1: 2 + Summe Tier-Raenge (Aemter+Orgs).

### 2) Geldgewinn
- Geldverleih: DC 14, Auszahlung naechste Runde, Cap 2/4/6/10 je Trade-Tier.
- Verkauf:
  - 6 RM oder 1 SM oder 1 perm. AK = 1 Investment.
  - Cap: 3 + (2 * TradeTierSum) + (DomainTierSum ohne Starter).
  - Preis = Basis + Marktmodifikator + Eventmodifikator + material.saleBonusGold.
- Kauf:
  - 5 RM oder 1 SM oder 1 perm. AK pro Investment.
  - Preis = Basis + Marktmodifikator + Eventmodifikator.

### 3) Materialgewinn
- Domaenenverwaltung: DC 10, Cap 4 * DomainTierRank.
- Werkstattaufsicht: DC 12, Cap 2 * WorkshopTierRank.
- Ertraege (pro Investment):
  - Sehr gut: 16 RM oder 3 SM
  - Gut: 12 RM oder 2 SM
  - Erfolg: 8 RM oder 1 SM
  - Schlecht: 1 RM oder 0.5 SM
- Output (Soll):
  - RM wird auf Domaenen-Picks verteilt.
  - SM folgt der Werkstatt-Konfiguration + Veredelung.

### 4) Gewinn permanenter Posten
- Domaenen/Stadtbesitz/Aemter/Organisationen:
  - DC je Posten + Tiermod (small +0, medium +4, large +8).
  - Kosten werden bei Erfolg mit Roll-Multiplikator skaliert (veryGood/good/poor).
- Handelsunternehmungen:
  - DC 10, Kosten (v1-Interpretation) 20/40/80 Gold.
- Paechter/Anhaenger:
  - Kosten + Erfolgsstaffel, Caps nach Tier/Art.
- Truppen:
  - Kosten je Truppentyp, Caps nach Besitz/Organisationen.

### 6) Einrichtungen errichten/ausbauen (Sonderaktion)
- Starter-Domaene ausbauen (10 Gold, 4 AK).
- Domaenen-Spezialisierung (Landwirtschaft/Tierzucht/Forst/Bergbau) gesetzt, Kosten vereinfacht.
- Werkstaetten/Lager bauen + upgraden (Slot- und Kapazitaetsregeln).
- Allgemeine/Besondere Einrichtungen sind generisch (Kosten je Tier, Effekte nicht voll abgebildet).

## Werkstaetten und Lager (Kapazitaet)
- Werkstatt small: 8 RM -> 2 SM (4:1), Upkeep 1 AK.
- Werkstatt medium: 12 RM -> 3 SM, Upkeep 2 AK + 1 Gold.
- Werkstatt large: 20 RM -> 5 SM, Upkeep 4 AK + 2 Gold.
- Lager small/medium/large: 10/20/40 RM oder 5/10/20 SM (jeweils * storageMultiplier).

## Ereignissystem (Abschnitt)
- Alle 5 Runden werden 2 Events gerollt.
- Eventeffekte wirken auf Markt, DC, Ertraege, Upkeep, Loyalitaet.
- Details in: `src/core/rules/eventTable_v1.ts`, `src/core/rules/events_v1.ts`.
