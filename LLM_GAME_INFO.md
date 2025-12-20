# LLM-Game-Info (Engine v1)

Diese Datei fasst den aktuellen Stand der Engine-Regeln zusammen, damit ein LLM die Spiel-Logik und Ressourcen besser versteht.
Sie beschreibt, was im Code umgesetzt ist (v1), nicht das komplette Regelwerk aus dem Aufbausystem-PDF.

## Ziel
- Standardziel im LLM-Runner: **Gesamt-Score maximieren** (Gold + Inventar + Einfluss + Assets etc.).
- Das LLM bekommt im Prompt einen kurzen Hinweis zur Score-Logik.

## Rundenablauf
1. **Maintenance** (Ertraege, Unterhalt, Pending Gold einziehen)
2. **Actions** (Aktionen ausfuehren)
3. **Conversion** (Material -> Gold, Lagerung)
4. **Reset** (Turn-Reset)
5. Zurueck zu **Maintenance**

## Aktionen pro Runde
- Basis: **2 Aktionen** pro Runde.
- **1 Sonderaktion** fuer Einrichtungen/Ausbau (freie Facility-Action) pro Runde.
- Pro Runde **nur 1 Aktion pro Action-Key** (z.B. money.sell nur einmal). Ausnahme:
  - **Bonusaktionen Einfluss** durch grosse Aemter/grossen Kult.
  - **Bonusaktion Geld** durch grosses Handelscollegium.
  - **Bonusaktion Material** durch grosses Handwerkscollegium.

## Ressourcen (Spielerzustand)
- **Gold** (aktuelles Gold + pending Gold aus Geldverleih)
- **Einfluss** (pro Runde verfuegbar, nicht kumulativ) + **Permanenter Einfluss**
- **Arbeitskraft (AK)** (pro Runde verfuegbar) + **Permanente Arbeitskraft**
- **Rohmaterial (RM)** und **Sondermaterial (SM)**
- **Zauberkraft**
- **Truppen**, **Paecht er/Anhaenger**, **Fachkraefte**

## Startzustand (Engine v1)
- Checks: influence=3, money=3, materials=3 (Attributs-Basis; skaliert pro 10 Runden).
- Gold: 4
- Holdings:
  - 1 Starter-Domaene (tier=starter)
  - Starter-Domaene hat RM-Picks: raw.grainVeg, raw.fruit, raw.meat, raw.pigsSheep
  - 1 Stadtbesitz (tier=small, mode=leased)
  - 1 Werkstatt (tier=small) auf Starter-Domaene (input=raw.grainVeg, output=special.pulpellen)
  - Permanenter Einfluss: 0, Permanente Arbeitskraft: 2
  - Keine Lager, Orgs, Aemter, Handelsunternehmungen, Truppen, Fachkraefte
- Inventar (RM/SM/Zauberkraft) leer

## Ertraege und Unterhalt (Kurzuebersicht)
- **Domaenen**
  - AK/Runde: starter/small=2, medium=4, large=8
  - RM/Runde: starter=8, small=12, medium=20, large=36 (auf 4 RM-Picks verteilt)
  - Gold-Unterhalt: starter=0, small=2, medium=4, large=8
- **Stadtbesitz (leased)**
  - AK/Runde: small=1, medium=2, large=4
  - Einfluss/Runde: small=1, medium=2, large=4
  - Gold/Runde: small=2, medium=5, large=12
- **Stadtbesitz (production)**
  - AK/Runde: small=2, medium=3, large=6
  - Gold/Einfluss: 0
  - Gold-Unterhalt: small=2, medium=4, large=8
- **Werkstaetten**
  - Unterhalt: small=1 AK, medium=2 AK +1 Gold, large=4 AK +2 Gold
  - Kapazitaet (Umwandlung):
    - small: 8 RM -> max 2 SM
    - medium: 12 RM -> max 3 SM
    - large: 20 RM -> max 5 SM
  - Jede Werkstatt hat inputMaterialId/outputMaterialId (billig oder einfach)
- **Lager**
  - Kapazitaet (mit storageCapacityMultiplier=2):
    - small: 20 RM / 10 SM
    - medium: 40 RM / 20 SM
    - large: 80 RM / 40 SM

## Material-Conversion (Conversion-Phase)
1. Werkstaetten wandeln **ihr inputMaterial** RM -> output SM um (Kapazitaeten oben).
2. Veredelungs-Einrichtungen am Standort werten output SM pro Stufe um 1 Kategorie auf.
3. Lager speichern RM/SM bis Kapazitaet.
4. Rest wird **auto-konvertiert**:
  - RM: Standard 4:1 zu Gold (Ereignisse koennen Divisor aendern)
  - SM: 1:2 zu Gold
5. Nicht konvertierte RM werden verworfen.

## Erfolgswuerfe (allgemein)
- W20 + Check (influence/money/materials)
- Tiers:
  - veryGood: >= DC + 10
  - good: >= DC + 5
  - success: >= DC
  - poor: >= DC - 5
  - fail: < DC - 5
- Check-Skalierung: Effektiver Check = base + floor(Runde/10) (ab Runde 10 +1, ab Runde 20 +2, ...).

## Aktionen (Engine v1, Zusammenfassung)
- **Einfluss gewinnen** (temporary oder permanent)
  - Kosten: temp = 1 Gold/Invest, perm = 2 Gold/Invest
  - Caps: temp abhaengig von Aemtern/Orgs; perm = 2 + Summe (Aemter+Orgs Tiers)
- **Geld gewinnen**
  - **MoneyLend**: 2 Gold/Invest -> Gold naechste Runde (Ertrag nach Erfolgsgrad)
  - **MoneySell**: Verkauf RM/SM mit Marktfaktoren (6 RM oder 1 SM = 1 Invest)
  - **MoneyBuy**: Einkauf von Waren (implementiert, aber nicht im LLM-Runner genutzt)
- **Material gewinnen**
  - **Domaenenverwaltung** oder **Werkstattaufsicht** (AK-gebunden)
- **Permanente Posten**
  - Domaene, Stadtbesitz, Amt, Organisation, Handelsunternehmung
- **Paechter/Anhaenger** (Staedtisch, Domaene, Orga)
- **Truppen rekrutieren** (Bodyguard, Miliz, Soeldner, Schlaeger)
- **Fachkraft anheuern** (randomisierte Kosten)
- **Einrichtungen**
  - Werkstatt/Lager bauen oder upgraden
  - Allgemeine/Spezielle Einrichtungen an Posten
  - Veredelung: `special.small.refine` (je Stufe +1 Kategorie fuer Werkstatt-Output am Standort)
  - Starter-Domaene ausbauen
  - Domaenen-Spezialisierung

## Markt
- Marktinstanzen mit Modifiern pro Roh-/Sondermaterialgruppe.
- Verkauf nutzt Markt-Modifier + Material-Bonus.
- Events koennen DCs/Modifier beeinflussen.

## Events
- Globale Events (Abschnitte) beeinflussen DCs, Ertraege, Kosten, Unterhalt, Konversion.
- Beispiele: +DC auf Geldverleih/Verkauf, halbe Amtsgold-Einkuenfte, etc.

## LLM-Runner: aktuell sichtbare Action-Candidates
Der LLM-Runner zeigt weiterhin **nicht alle Engine-Aktionen**, aber eine deutlich erweiterte Auswahl:
- **Facility**
  - Starter-Domaene ausbauen
  - Stadtbesitz-Modus auf Produktion setzen
  - Amt auf Gold-Ertrag umstellen
  - Handelsunternehmung auf Handel umstellen
  - Domaenen-Spezialisierung (Forst/Landwirtschaft/Bergbau/Viehzucht, wenn bezahlbar)
  - Werkstatt bauen (klein, Domaene oder Stadtbesitz/Produktion)
  - Lager bauen (klein, Domaene oder Stadtbesitz/Produktion)
  - Werkstatt/Lager upgraden (wenn Voraussetzungen erfuellt)
- **Actions**
  - Materialgewinn (Domaene/Werkstatt) 1/mid/max
  - Einflussgewinn (temporary/permanent) 1/mid/max
  - Geldverleih (1/mid/max, wenn bezahlbar)
  - Verkauf (bestes Paket, pro Marktinstanz + Budget)
  - Amt klein/mittel/gross (goldFirst / influenceFirst, bei Voraussetzungen)
  - Handelsunternehmung klein/mittel/gross
  - Stadtbesitz klein/mittel/gross
  - Domaene klein/mittel/gross
  - Organisation (underworld/collegiumTrade/collegiumCraft/cult/spy)
  - Paechter/Anhaenger auf Stadt/Domaene/Orga (1/mid/max)

## Hinweis zur Strategie im LLM
- Das LLM erhaelt im Prompt **Strategie-Zeile + Strategie-Card** sowie eine kurze **Rolling Summary**.
- Markt-Snapshot und Inventar-Toplisten werden ebenfalls gezeigt.
