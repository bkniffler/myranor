# LLM-Game-Info (Engine v1)

Diese Datei fasst den aktuellen Stand der Engine-Regeln zusammen, damit ein LLM die Spiel-Logik und Ressourcen besser versteht.
Sie beschreibt, was im Code umgesetzt ist (v1), nicht das komplette Regelwerk aus dem Aufbausystem-PDF.

## Ziel
- Standardziel im LLM-Runner: **Gesamt-Score (GoldEq) maximieren**.
  - GoldEq umfasst aktuelles Gold, Inventar, Assets und den **aktuellen Einfluss pro Runde**.
  - **Verdienter Einfluss** wird getrennt ausgewiesen (Auswertung), ist **nicht Teil** des Scores.
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
- **Truppen**, **Paecher/Anhaenger**, **Fachkraefte**

## Startzustand (Engine v1)
- Checks: influence=3, money=3, materials=3 (Attributs-Basis; skaliert pro 10 Runden).
- Gold: 4
- Holdings:
  - 1 Starter-Domaene (tier=starter)
  - Starter-Domaene hat RM-Pick: raw.grainVeg
  - 1 Stadtbesitz (tier=small, mode=leased)
  - 1 Werkstatt (tier=small) auf Starter-Domaene (input=raw.grainVeg, output=special.pulpellen)
  - Permanenter Einfluss: 0, Permanente Arbeitskraft: 2
  - Keine Lager, Orgs, Aemter, Handelsunternehmungen, Truppen, Fachkraefte
- Inventar (RM/SM/Zauberkraft) leer

## Domaenen: Material-Picks
- Starter-Domaene: 1 Pick (default `raw.grainVeg`).
- Andere Domaenen: 4 Picks (default aus `DEFAULT_DOMAIN_RAW_PICKS`).
- Landwirtschafts-Spezialisierung erfordert **2 billige + 2 einfache** Rohmaterial-Picks.

## Ertraege und Unterhalt (Kurzuebersicht)
- **Domaenen**
  - AK/Runde: starter/small=2, medium=4, large=8
  - RM/Runde: starter=8, small=12, medium=20, large=36 (gleichmaessig auf vorhandene RM-Picks verteilt)
  - Gold-Unterhalt: starter=0, small=2, medium=4, large=8
- **Stadtbesitz (leased)**
  - AK/Runde: small=1, medium=2, large=4
  - Einfluss/Runde: small=1, medium=2, large=4
  - Gold/Runde: small=2, medium=5, large=12
- **Stadtbesitz (production)**
  - AK/Runde: small=2, medium=3, large=6
  - Gold/Einfluss: 0
  - Gold-Unterhalt: small=2, medium=4, large=8
- **Aemter**
  - Ertrag (pro Runde, je Amt): small=2/2, medium=8/10, large=16/20
    - Wahl: Gold **oder** Einfluss **oder** Split 50/50 je nach Yield-Mode
  - Kleine Aemter Cap: 8 + 2 je mittlerem Amt + 4 je grossem Amt
- **Organisationen (v1)**
  - Unterwelt: pro Runde **Gold + Einfluss**, skaliert mit hoechstem Stadtbesitz (Tier-Rang).
  - Spionage: Einfluss `6 * Stufe` (ab Stufe 2/3 zusaetzlich permanenter Einfluss als Pool +1/+2).
  - Kult: Einfluss `5 * Stufe` (ab Stufe 2/3 zusaetzlich permanenter Einfluss als Pool +2/+4).
- **Handelsunternehmungen (v1)**
  - Unterhalt: small=2 Gold; medium=4 Gold +1 AK; large=6 Gold +2 AK.
  - Mode `produce`: produziert `special.tools` (small=3, medium=6, large=12).
  - Mode `trade`: konsumiert Sondermaterial (small=1, medium=2, large=4) und erzeugt Gold (Basis 4/10/24 + Markt/Event).
  - Beschädigt (`damage`): inaktiv (kein Unterhalt/Ertrag, keine Handelsmärkte, keine Einrichtungs-Einflüsse).
  - Events 15/16(pirates)/26: Verkauf über Handelsmärkte kann Frachtverlust verursachen (Gold wird reduziert).
- **Einrichtungen an Aemtern/Orgs/Werkstaetten/Handel**
  - Einfluss/Runde: general small=+1, medium=+2, large=+3; special small=+2, medium=+3, large=+4
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
- Unterhalt gilt ab Runde 2. Domaenen/Staedte/Orgs/Handel bleiben aktiv (Gold kann negativ werden), aber **Werkstaetten/Lager nur bei Unterhalt**.

## Einrichtungs- und Produktions-Caps (v1)
- Domaenen: Einrichtungsplaetze = 2 * Tier-Rang (small=2, medium=4, large=6), Starter=0.
- Stadtbesitz: Einrichtungsplaetze small=2, medium=3, large=4.
- Aemter: Einrichtungsplaetze wie Stadtbesitz (2/3/4).
- Organisationen & Handelsunternehmungen: Einrichtungsplaetze = 2 * Tier-Rang (small=2, medium=4, large=6).
- Werkstaetten/Lager belegen 1 Einrichtungsplatz.
- Werkstaetten haben eigene Facility-Slots: small=1, medium=2, large=3.
- Domänen-Produktionscap (Werkstatt/Lager):
  - Kleine Domäne: max 1 kleine Produktion.
  - Mittlere Domäne: max 1 mittlere Produktion.
  - Große Domäne: max 1 kleine + 1 mittlere Produktion.
  - Große Werkstaetten/Lager sind auf Domänen nicht erlaubt.
- Stadtbesitz (Eigenproduktion) Produktionskapazitaet:
  - Klein: 2 kleine oder 1 mittlere Produktion.
  - Mittel: 2 mittlere oder 1 große Produktion.
  - Groß: 2 große Produktionen.
- Starter-Domaenen muessen ausgebaut werden, bevor zusaetzliche Werkstaetten/Lager gebaut werden koennen.

## Material-Conversion (Conversion-Phase)
1. Werkstaetten wandeln **ihr inputMaterial** RM -> output SM um (Kapazitaeten oben, **nur wenn unterhalten**).
2. Veredelungs-Einrichtungen am Standort werten output SM pro Stufe um 1 Kategorie auf.
3. Lager speichern RM/SM bis Kapazitaet.
4. Rest wird **auto-konvertiert**:
  - RM: Standard 4:1 zu Gold (Ereignisse koennen Divisor aendern, **Bruchteile erlaubt**)
  - SM: 1:2 zu Gold
5. Alles Nicht-Gelagerte wird konvertiert; **nichts wird verworfen**.

## Erfolgswuerfe (allgemein)
- W20 + Check (influence/money/materials)
- DC-Investment-Mod: +4 bei Investitionen >= 4, +8 bei Investitionen >= 8
- Tiers:
  - veryGood: >= DC + 10
  - good: >= DC + 5
  - success: >= DC
  - poor: >= DC - 5
  - fail: < DC - 5
- Check-Skalierung: Effektiver Check = base + floor(Runde/10) (R1-9 +0, R10-19 +1, R20-29 +2, ...).

## Aktionen (Engine v1, Zusammenfassung)
- **Einfluss gewinnen** (temporary oder permanent)
  - Kosten: temp = 1 Gold/Invest, perm = 2 Gold/Invest
  - Caps: temp abhaengig von Aemtern/Orgs; perm = 2 + Summe (Aemter+Orgs Tiers)
- **Geld gewinnen**
  - **MoneyLend**: 2 Gold/Invest -> Gold naechste Runde (Ertrag nach Erfolgsgrad)
  - **MoneySell**: Verkauf RM/SM/perm. AK mit Marktfaktoren (6 RM oder 1 SM oder 1 perm. AK = 1 Invest; Cap = 2 + 2*TradeTierSum + DomainTierSum)
  - **MoneySellBuy**: Verkauf + Einkauf in einer Aktion (belegt money.sell + money.buy)
  - **MoneyBuy**: Einkauf von Waren (5 RM oder 1 SM oder 1 perm. AK pro Invest; Cap = 3 + 2*TradeTierSum + DomainTierSum)
  - Event 31 (Wirtschaftsaufschwung) — v1-Nerf: Bonusgold nur je **3** Investitionen (statt je 2).
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
- Einkauf nutzt die **invertierten** Markt-Modifier (hoher Mod = guenstiger).
- Events koennen DCs/Modifier beeinflussen.
- Handelsunternehmungen erzeugen zusaetzliche Marktinstanzen (Anzahl = Tier-Rang), **nur wenn nicht beschädigt**.

## Events
- Globale Events (Abschnitte) werden ab Runde 1 gerollt und wirken 5 Runden.
- Events beeinflussen DCs, Ertraege, Kosten, Unterhalt, Konversion.
- Beispiele: +DC auf Geldverleih/Verkauf, halbe Amtsgold-Einkuenfte, etc.

## LLM-Runner: aktuell sichtbare Action-Candidates
Der LLM-Runner zeigt weiterhin **nicht alle Engine-Aktionen**, aber eine deutlich erweiterte Auswahl:
- **Facility**
  - Starter-Domaene ausbauen
  - Stadtbesitz-Modus auf Produktion setzen
  - Amt auf Gold-, Einfluss- oder Split-Ertrag umstellen
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
  - Verkauf+Kauf (kombiniert, bestes Paket + Kauf mit gleichem Markt)
  - Kauf (bestes Paket, pro Marktinstanz + Budget)
  - Amt klein/mittel/gross (goldFirst / influenceFirst, bei Voraussetzungen)
  - Handelsunternehmung klein/mittel/gross
  - Stadtbesitz klein/mittel/gross
  - Domaene klein/mittel/gross
  - Organisation (underworld/collegiumTrade/collegiumCraft/cult/spy)
  - Paechter/Anhaenger auf Stadt/Domaene/Orga (1/mid/max)

## Hinweis zur Strategie im LLM
- Das LLM erhaelt im Prompt **Strategie-Zeile + Strategie-Card** sowie eine kurze **Rolling Summary**.
- Markt-Snapshot und Inventar-Toplisten werden ebenfalls gezeigt.
