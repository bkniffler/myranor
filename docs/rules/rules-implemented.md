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

## Erfolgswuerfe & Checks
- W20 + Check (influence/money/materials).
- Check-Skalierung: `effectiveCheck = base + floor(round/10)` (R1–9 +0, R10–19 +1, R20–29 +2, ...).
- DC-Investment-Mod: +4 bei Investitionen >= 4, +8 bei Investitionen >= 8.
- Erfolgsstufen:
  - veryGood: >= DC + 10
  - good: >= DC + 5
  - success: >= DC
  - poor: >= DC - 5
  - fail: < DC - 5

## Startbedingungen (Soll)
- Starter-Domaene: tier `starter`, Ertrag 2 AK, 8 RM pro Runde.
- Starter-Domaene hat **1 Material-Pick** (Nahrung): `raw.grainVeg`.
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
- Markt Modifer +Gold wird zu -Gold bei Aktion: Ankauf/Einkauf
- Handelsunternehmungen erzeugen **zusaetzliche Marktinstanzen** (Anzahl = Tier-Rang), die wie der lokale Markt gerollt werden.

## Domaenen: Material-Picks (Soll)
- Jede Domaene hat **4 Rohmaterial-Picks** (`rawPicks`), **Starter-Domaene hat 1 Pick**.
- Diese Picks bestimmen:
  - Domaenen-Ertrag (Maintenance)
  - Materialgewinn (Domänenverwaltung)
  - Paechter-Zusatz-RM (einfaches RM aus Picks)
- **Landwirtschaft** waehlt **2 billige + 2 einfache** Rohmaterialtypen.
- Standard (falls nicht gesetzt): Domaenen behalten die bestehenden Picks.

## Domaenen-Ertrag (Maintenance)
- Domaenen liefern pro Runde RM nach Tier: starter 8, small 12, medium 20, large 36.
- Dazu kommen ebenfalls AK nach Tier
- Der Gesamtbetrag wird **gleichmaessig** auf die vorhandenen `rawPicks` verteilt (1 oder 4).
- Dasselbe gilt für Aktion: Materialgewinnungs Ertrag
- Ereignis-Modifikationen (Duerre, gutes Jahr, magische Bestien) wirken auf den Gesamtbetrag.
- Zusatz-Ernte (z.B. gute Ernte) geht auf den **ersten** Pick ("Hauptertrag").

## Werkstaetten (Soll)
- Jede Werkstatt hat:
  - `inputMaterialId` (RM, billig oder einfach)
  - `outputMaterialId` (SM, billig oder einfach)
- `inputMaterialId` wird beim Bau festgelegt und gilt als **fix**.
- Der Output ist dasselbe Material auch bei Materialgewinn-Aktion Werkstattüberwachung
- `outputMaterialId` wird beim Bau festgelegt und ist standardmaessig ein passendes SM zur RM-Kategorie.
- Werkstatt ist immer Einrichtung von Domäne oder Stadtbesitz und kann in Freier Aktion aufgebaut werden
- Werkstaetten wandeln im **Conversion**-Schritt automatisch um (nur wenn unterhalten).

## Veredelung (Soll)
- Werkstätten und Spezialeinrichtungen der Werkstätten koennen RM und /Oder Werkstatt-Erzeugnisse **eine Kategorie aufwerten**:
  - billig -> einfach -> teuer -> luxus
- Jede Veredelungs-Einrichtung erzeugt **+1 Upgrade-Stufe** fuer Werkstaetten am selben Ort.
- Luxus wird als **teures Sondermaterial mit Tag `luxury`** umgesetzt.
- Mehrere Veredelungs-Einrichtungen stacken (mehrstufige Aufwertung).
- Beachte Einrichungs/Facility Caps
- Veredelungseinrichtung im Code: `facilityKey` beginnt mit `special.{small|medium|large}.refine`.

## Konversion & Lagerung
- Werkstaetten wandeln RM in SM um (4:1) nach Kapazitaet, **nur fuer das eigene `inputMaterialId`**.
- Ergebnis-SM ist `outputMaterialId`, nach Veredelungsstufen ggf. aufgewertet.
- Lagerung: nur in unterhaltenen Lagern, Kapazitaet * storageMultiplier (2x).
- Auto-Konversion (Rundenende):
  - RM -> Gold: 4:1 (Ausnahme bei Hungersnot), **Bruchteile sind erlaubt** (z.B. 2 RM = 0.5 Gold).
  - SM -> Gold: 1 SM = 2 Gold.
- Nicht gelagerte RM/SM werden auto-konvertiert (keine RM-Verluste durch Rundung).
- Nicht unterhaltene Werkstaetten/Lager produzieren bzw. speichern **nicht**.

## Posten-Ertraege (Maintenance)
- Domaenen: RM-Ertrag pro Tier (starter 8, small 12, medium 20, large 36) + AK Ertrag nach Tier (2/2/4/8).
- Stadtbesitz (verpachtet): Gold + Einfluss + AK nach Tier, keine Werkstatt/Lager im Stadtbesitz erlaubt.
  - small: +2 Gold, +1 Einfluss, +1 AK
  - medium: +5 Gold, +2 Einfluss, +2 AK
  - large: +12 Gold, +4 Einfluss, +4 AK
- Stadtbesitz (Eigenproduktion): AK nach Tier, kein Gold/Einfluss.
  - small: +2 AK (Unterhalt: 2 Gold / Runde ab Runde 2)
  - medium: +3 AK (Unterhalt: 4 Gold / Runde ab Runde 2)
  - large: +6 AK (Unterhalt: 8 Gold / Runde ab Runde 2)
  - Öffnet Produktions-Caps für Werkstätten/Lager im Stadtbesitz (siehe unten).
- Aemter: pro Runde Einfluss **oder** Gold **oder** Split 50/50
  - small: 2 Einfluss / 2 Gold
  - medium: 8 Einfluss / 10 Gold
  - large: 16 Einfluss / 20 Gold
- Organisationen (v1)
  - Unterwelt: pro Runde **Gold + Einfluss**, skaliert mit hoechstem Stadtbesitz (Tier-Rang).
    - `maxCityRank = max(postTierRank(city.tier))`
    - Gold: `goldPer * orgRank * maxCityRank` (goldPer: small=4, medium=5, large=6)
    - Einfluss: `per * orgRank * maxCityRank` (per: small=1, medium=2, large=3)
  - Spionage: Einfluss `6 * orgRank` (ab medium/large zusaetzlich permanenter Einfluss als Pool: +1/+2).
  - Kult: Einfluss `5 * orgRank` (ab medium/large zusaetzlich permanenter Einfluss als Pool: +2/+4).
  - Handwerks-/Handelscollegium: AK `3 * orgRank` (Handwerk) bzw. DC/Bonusaktionen (siehe Aktionen).
- Handelsunternehmungen (v1)
  - Mode `produce`: produziert pro Runde `special.tools` (small=3, medium=6, large=12).
  - Mode `trade`: konsumiert pro Runde Sondermaterial (guenstigstes) (small=1, medium=2, large=4) und erzeugt Gold:
    - Basisgold: small=4, medium=10, large=24
    - plus Trade-Markt-Modifikatoren (beste eigene Handelsmarktinstanz) + Event-Delta (kann negativ sein).
  - Beschädigt: `damage` gesetzt → **inaktiv** (kein Unterhalt, kein Ertrag, keine Handelsmärkte, keine Einrichtungs-Einflüsse).
  - Ereignis-Risiken (v1):
    - Event 15 (Stürme): Ertrag halbiert (5 Runden) und zusätzlich "Frachtverlust"-Risiko beim Verkauf über Handelsmärkte.
    - Event 16 (Piraterie): bei Piraten-Variante kann Handelsunternehmung verloren/beschädigt werden; zusätzlich "Frachtverlust" beim Verkauf über Handelsmärkte.
    - Event 26 (Konflikt): Ertrag halbiert (5 Runden); Angriffe können Handelsunternehmungen verlieren/beschädigen oder SM rauben; zusätzlich "Frachtverlust" beim Verkauf über Handelsmärkte (mit Abwehrwurf).
  - Frachtverlust (nur Handelsmärkte, `MoneySell`/`MoneySellBuy`) — v1-Implementierung:
    - Priorität: Piraten > Konflikt > Sturm (kein doppeltes Bestrafen im selben Verkauf).
    - Trigger (w20): Sturm <= 3, Piraten <= 4, Konflikt <= 5.
    - Abwehr (nur Konflikt): w20 + Verteidigungsmod (aus Truppen) gegen DC 17 (15+2).
    - Verlust: `min(grossGold, investments * lossGoldPerInvestment)` mit lossGoldPerInvestment: Sturm=2, Piraten=3, Konflikt=2.
- Paechter/Anhaenger: +1 Gold/Stufe +1 AK/Stufe; Domaenen zusaetzlich +1 RM/Stufe (einfaches RM aus Picks).
- Viele Posten geben auch Sonderaktionen oder DC Erleichterungen nach Tier (Angegeben unter Vorteilen)
- Einrichtungen an Aemtern/Orgs/Werkstaetten/Handelsunternehmungen geben Einfluss pro Runde:
  - General: small +1, medium +2, large +3.
  - Special: small +2, medium +3, large +4.

## Unterhalt (ab Runde 2)
- Domaenen, Stadtbesitz (produktion), Organisationen, Handelsunternehmungen, Truppen.
- Werkstaetten/Lager muessen unterhalten werden (sonst inaktiv).
- Unterhalt fuer Domaenen/Stadtbesitz/Organisationen/Handel/Truppen wird als Kosten abgezogen, diese Posten bleiben aktiv (Gold kann negativ werden).
- Stadtbesitz (Eigenproduktion): small=2 Gold, medium=4 Gold, large=8 Gold.
- Handelsunternehmungen-Unterhalt (v1):
  - small: 2 Gold
  - medium: 4 Gold + 1 AK
  - large: 6 Gold + 2 AK
- AK-Unterhalt: 1 RM je 4 AK, fehlende RM reduzieren AK (v1-Interpretation).

## Aktionen (Kurzfassung)

### 1) Einflussgewinn
- Temporaer: investiert Gold -> Einfluss (Erfolgsstaffel).
- Permanent: investiert Gold -> permanenter Einfluss (Erfolgsstaffel).
- Caps: temporaer 4/6/8/12 je Besitz; permanent v1: 2 + Summe Tier-Raenge (Aemter+Orgs).
- DC: 12 + Investment-Mod + Event-Mod.
- DC -1 wenn Aktionsgroesse zu einem verpachteten Stadtbesitz-Tier passt.
- DC -1 wenn Aktionsgroesse zu einem Amt-Tier passt.
- Kult senkt DC um Tier-Rang (1/2/3).

### 2) Geldgewinn
- Geldverleih: DC 14, Auszahlung naechste Runde, Cap 2/4/6/10 je Trade-Tier.
- Event 31 (Wirtschaftsaufschwung) — v1-Nerf: Bonusgold nur je **3** Investitionen (statt je 2).
- Verkauf:
  - 6 RM oder 1 SM oder 1 perm. AK = 1 Investment.
  - Cap: 2 + (2 * TradeTierSum) + (DomainTierSum ohne Starter).
  - Preis = Basis + Marktmodifikator + Eventmodifikator + material.saleBonusGold.
- Kauf:
  - 5 RM oder 1 SM oder 1 perm. AK pro Investment.
  - Cap: 3 + (2 * TradeTierSum) + (DomainTierSum ohne Starter).
  - Preis = Basis + Marktmodifikator + Eventmodifikator.
- Verkauf kann im selben Zug optional einen Kauf enthalten (belegt money.sell + money.buy).

### 3) Materialgewinn
- Domaenenverwaltung: DC 10, Cap 4 * DomainTierRank.
- Werkstattaufsicht: DC 12, Cap 2 * WorkshopTierRank.
- DC: + Investment-Mod; Handwerkscollegium senkt DC um 2 * Tier-Rang.
- Domänen-Vorteil: DC -1 wenn Aktionsgroesse zur Domaenen-Groesse passt (small/medium/large).
- Ertraege (pro Investment):
  - Sehr gut: 16 RM oder 4 SM
  - Gut: 12 RM oder 3 SM
  - Erfolg: 8 RM oder 2 SM
  - Schlecht: 1 RM oder 0.5 SM
- Output (Soll):
  - RM wird auf Domaenen-Picks verteilt.
  - SM folgt der Werkstatt-Konfiguration + Veredelung.

### 4) Gewinn permanenter Posten
- Domaenen/Stadtbesitz/Aemter/Organisationen:
  - DC je Posten + Tiermod (small +0, medium +4, large +8).
  - Kosten werden bei Erfolg mit Roll-Multiplikator skaliert (veryGood/good/poor).
  - Stadtbesitz Grundkosten: small=15 Gold, medium=25 Gold, large=50 Gold (Event 30 kann fuer 1 Runde halbieren).
  - Kleine Aemter Cap: 8 + 2 je mittlerem Amt + 4 je grossem Amt.
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
- Allgemeine/Besondere Einrichtungen sind generisch (Kosten je Tier, Effekte vereinfacht).

## Werkstaetten und Lager (Kapazitaet)
- Werkstatt small: 8 RM -> 2 SM (4:1), Upkeep 1 AK.
- Werkstatt medium: 12 RM -> 3 SM, Upkeep 2 AK + 1 Gold.
- Werkstatt large: 20 RM -> 5 SM, Upkeep 4 AK + 2 Gold.
- Lager small/medium/large: 10/20/40 RM oder 5/10/20 SM (jeweils * storageMultiplier).

## Einrichtungsplaetze & Produktions-Caps (Soll)
- Domaenen: Einrichtungsplaetze = 2 * Tier-Rang (small=2, medium=4, large=6), Starter=0.
- Stadtbesitz: Einrichtungsplaetze small=2, medium=3, large=4.
- Aemter: Einrichtungsplaetze wie Stadtbesitz (2/3/4 je Tier).
- Organisationen & Handelsunternehmungen: Einrichtungsplaetze = 2 * Tier-Rang (small=2, medium=4, large=6).
- Werkstaetten/Lager belegen 1 Einrichtungsplatz (unabhaengig von ihrer Groesse).
- Werkstaetten haben eigene Facility-Slots: small=1, medium=2, large=3.
- Domänen-Produktionscap (Werkstatt/Lager):
  - Kleine Domäne: max 1 kleine Produktion (Werkstatt/Lager).
  - Mittlere Domäne: max 1 mittlere Produktion (Werkstatt/Lager).
  - Große Domäne: max 1 kleine **und** 1 mittlere Produktion (insgesamt 2).
  - Große Werkstaetten/Lager sind **nicht** auf Domänen erlaubt.
- Stadtbesitz (Eigenproduktion) Produktionskapazitaet: Öffnet zusätzliche Plätze für Werkstätten:
  - Klein: 2 kleine **oder** 1 mittlere Produktion.
  - Mittel: 2 mittlere **oder** 1 große Produktion.
  - Groß: 2 große Produktionen.
- Starter-Domaenen muessen ausgebaut werden, bevor neue Werkstaetten/Lager gebaut werden koennen.

## Ereignissystem (Abschnitt)
- Alle 5 Runden werden 2 Events gerollt (ab Runde 1, wirken 5 Runden).
- Eventeffekte wirken auf Markt, DC, Ertraege, Upkeep, Loyalitaet.
- Details in: `src/core/rules/eventTable_v1.ts`, `src/core/rules/events_v1.ts`.
