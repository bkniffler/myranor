# Balancing – Erkenntnisse & Vorschläge

Stand: 10x LLM-Playtests (20 Runden), Seeds 111/222/333/444/555/666/777/888/999/1111, Scenario `core-v1-strategies`, Scoring: **GoldEq** (ROI-Horizont in Scoring: 10 Runden).

## Änderungen seit letztem Stand
- **TradeEnterprises**: Unterhalt angepasst (2/4/6 Gold + 0/1/2 AK), Produce-Ertrag buff (3/6/12 `special.tools`), Trade kann jetzt auch negative Markt-Deltas korrekt abbilden; LLM bekommt TradeEnterprise-Kandidaten zuverlässig angeboten.
- **Unterwelt**: Gold+Einfluss aus Unterwelt wird in GoldEq-Scoring berücksichtigt; **Organisationen haben jetzt auch Einrichtungen** (Einfluss/Runde) im Scoring und als Facility-Candidates für LLM.
- **LLM Runner Stabilität**: MC-Ranking kann nicht mehr “leer” crashen (Fallback-Scoring statt Abort).

## Kurzfazit
- **Handel & Geld** ist aktuell der stärkste Pfad (Ø‑Score am höchsten) und bleibt **volatil** (sehr hoher Max‑Score).
- **TradeEnterprises funktionieren jetzt**: “Handel & Geld” kauft sie **10/10 Runs** (Ø 1.3).
- **Unterwelt hängt nicht mehr systematisch hinterher** (Ø ähnlich Amtsfokus/Domänenfokus) und baut **Organisationen+Einrichtungen** konsistent.
- Auffällig: **Unterwelt skaliert bis Runde 20 nicht über “small” hinaus** (Unterwelt‑Tier bleibt 1/10 Seeds bei “medium/large”).

## Aggregierte Ergebnisse (10 Runs, 20 Runden)

### Siege (höchster Score pro Seed)
```
Handel & Geld: 4
Werkstattfokus: 2
Domänenfokus: 2
Amtsfokus: 1
Stadt & Unterwelt: 1
```

### Scores (GoldEq) pro Strategie
```
Amtsfokus        Ø 903.0 | median 889.7 | min 741.5 | max 1178.3
Stadt & UnterweltØ 927.7 | median 925.4 | min 717.1 | max 1154.0
Domänenfokus     Ø 1046.6 | median 1000.1 | min 746.0 | max 1533.5
Werkstattfokus   Ø 1148.2 | median 1115.0 | min 764.3 | max 1708.1
Handel & Geld    Ø 1396.9 | median 1279.3 | min 850.0 | max 2658.8
```

### Durchschnittliche Holdings (20R, 10 Seeds)
```
Amtsfokus        d1.00 c1.00 o7.10 org0.60 trade0.00 ws1.00 store0.30
Handel & Geld    d1.00 c5.50 o1.60 org1.80 trade1.30 ws1.00 store1.20
Stadt & Unterweltd1.00 c3.50 o0.00 org2.00 trade0.00 ws1.00 store1.00
Werkstattfokus   d1.10 c4.90 o2.90 org1.30 trade0.00 ws1.60 store0.90
Domänenfokus     d1.30 c2.50 o4.40 org0.30 trade0.00 ws1.00 store1.10
```

## Beobachtetes LLM-Verhalten
- **Handel & Geld:** nutzt Sell/SellBuy/Lend und baut *früh* TradeEnterprise + TradeFacilities (TradeEnterprises: 10/10 Runs).
- **Stadt & Unterwelt:** baut Unterwelt (small) + Organisationseinrichtungen konsistent (Org-Facilities: 37 über 10 Runs), aber bleibt bei Underworld-Tier 1.
- **Viele Strategien** bauen weiter **Ämter** auch außerhalb Amtsfokus (Office scheint weiterhin ein starker “Universal”-Pfad).

## Haupttreiber der Balance-Probleme
1. **Handel & Geld dominiert** im Mittelwert und hat Outlier (Max 2658.8) → Volatilität ok, aber evtl. zu hoher “Ceiling”.
2. **Unterwelt skaliert nicht** (bis Runde 20 keine Upgrades über small) → Kosten/HQ/Anreize fürs Upgraden prüfen.
3. **City/Office als Universal‑Investments** → Strategiedifferenzierung verwässert weiter; ROI/Costs/Caps beobachten.

## Konkrete Balancing‑Tweaks (Vorschläge)
### 1) Handel & Geld Ceiling prüfen (ohne Pfad kaputt zu nerfen)
- Money-Lend / SellBuy Expected Value vs. TradeEnterprise (Upkeep/Ertrag) gegenrechnen; ggf. DC-Boni oder Bonusgold-Events abschwächen.
- Alternativ: TradeEnterprise-ROI leicht runter, aber TradeCaps/DC‑Vorteile hoch lassen (damit es Pfad bleibt, aber weniger “free money”).

### 2) Unterwelt-Upgrades ermöglichen/erzwingen
- HQ-Anforderung prüfen (z.B. “medium HQ” früher erreichbar machen) oder Upgrade-Kosten leicht senken.
- Oder Underworld small stärker belohnen, aber Upgrade-Pfade (medium/large) klarer (mehr Gold/Influence pro CityRank oder Facilities stärker gewichten).

### 3) Office/City als Universal‑ROI weiterhin beobachten
- Wenn Offices/City zu dominant bleiben: Kosten/Erträge/Caps oder Facility‑ROI feinjustieren, damit Fokusstrategien differenzierter werden.

## Nächste Schritte (empfohlen)
1. 10–20 Seeds mit **30 Runden** laufen lassen (prüft Skalierung: Underworld/Domain vs. Trade).
2. Unterwelt-Upgrades (medium/large) gezielt testen: Kosten/HQ/LLM-Entscheidung.
3. Danach ggf. gezielte Nerfs/Buffs iterieren (mit gleicher Auswertung).
