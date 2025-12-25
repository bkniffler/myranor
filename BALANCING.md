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

---

# Element-Review (v1) — Top/Flop pro Kategorie

Ziel: konkrete, prüfbare Aussagen zu **übermächtigen** vs. **zu schwachen** Elementen der aktuell implementierten Engine v1.

## Bewertungsbasis
- GoldEq-Mapping: `docs/rules/gold-equivalents.md`
- ROI-Horizont in Score: 10 Runden (`src/playtest/plannerScore.ts`)
- Aktuelle Beobachtung aus 15-Partien Planner-Batch: Stadtbesitz wurde fast ausschließlich **verpachtet** genutzt; **0.0** Eigenproduktion-Städte in 30R (`reports/playtest-planner-strategies-batch-15partien-analysis.md`)

## Severity-Skala (Daumenregeln)
- **Game-breaking**: Payback ≤ ~3 Runden **oder** erzeugt einen dominanten „Spam“-Anreiz.
- **Balanceschädigend**: Payback ~3–5 Runden, verdrängt Alternativen häufig.
- **Okay**: Payback ~5–10 Runden, klarer Tradeoff.
- **Money sink**: Payback > ~10 Runden oder stark zustandsabhängig (ohne klares Upside).
- **Nutzlos**: aktuell ohne Engine-Effekt (oder praktisch nie sinnvoll wählbar).

## Aktionen (Actions-Phase) — Top 3 / Flop 3

### Stärkste Aktionen
1) **`AcquireCityProperty` (Stadtbesitz kaufen, v.a. medium/large) — Game-breaking**
   - Grund: sehr hoher **Netto-Ertrag/R** bei niedrigen Grundkosten + fehlendem Cap.
   - Stadtbesitz (verpachtet) bringt pro Runde **Gold + Einfluss + AK** und kostet keinen Unterhalt.
2) **`GainInfluence` (permanent, kleine Investments) — Balanceschädigend bis Game-breaking**
   - Grund: permanenter Einfluss skaliert über viele Runden; Caps sind früh noch großzügig (2 + Tier-Ränge Ämter/Orgs).
   - Risiko/Downside ist niedrig (nur Gold), Upside ist dauerhaft.
3) **`MoneyLend` (kleine Investments 1–3) — Balanceschädigend**
   - Grund: EV ist für kleine Investments sehr hoch (bei +3 Check und DC 14 ist „success/good“ realistisch).
   - Gleichzeitig ist `MoneyLend` bei mittleren/größeren Investments deutlich riskanter → fühlt sich trotzdem wie „No-brainer early“ an.

### Schwächste Aktionen
1) **`HireSpecialist` (nicht `artisan`/`workshop`) — Nutzlos**
   - Aktueller Engine-Stand: nur `artisan`/`workshop` gate’n Werkstatt/Lager ab medium/large. Alle anderen Specialist-Kinds haben derzeit **keinen Effekt**.
2) **`MoneyBuy` (ohne stark günstigen Markt) — Money sink**
   - Grund: Basiskosten (3 Gold pro Investment) sind i.d.R. über Auto-Konversion/Standardpreise; Profit entsteht nur bei gezieltem Markt-Timing + Lager.
3) **`GainInfluence` (temporary, wenn nicht im selben Zug ausgebend) — Money sink**
   - Grund: temporärer Einfluss verfällt am Rundenende; wenn er nicht unmittelbar in einen Kauf/Recruit investiert wird, ist die Aktion effektiv „verbrannt“.

## Einrichtungen (Sonderaktion) — Top 3 / Flop 3

### Stärkste Einrichtungen
1) **Starter-Domäne ausbauen (`UpgradeStarterDomain`) — Okay bis stark**
   - Grund: schaltet weitere Domänen-Produktion (Werkstatt/Lager) frei und erhöht Domänenbasis (RM/AK), kostet aber Gold+AK.
2) **Werkstatt bauen (small) auf Domäne (`BuildWorkshop`) — Okay**
   - Grund: erhöht Wertschöpfung aus RM (RM→SM), wenn RM-Quelle stabil ist.
3) **Lager bauen (small) (`BuildStorage`) — zustandsabhängig**
   - Grund: nur stark, wenn Market-Timing tatsächlich gespielt wird (sonst wenig Effekt); im Scoring wird Kapazität eher großzügig bewertet.

### Schwächste Einrichtungen
1) **Stadtbesitz auf Eigenproduktion umstellen (`SetCityPropertyMode=production`) — Nutzlos / Money sink**
   - Beobachtung: in Planner-Batch quasi nie gewählt.
   - Grund: man verliert den sehr hohen verpachteten Ertrag (Gold+Einfluss) und zahlt zusätzlich Unterhalt; der Produktions-Upside (Werkstatt/Lager im Stadtbesitz) kompensiert das selten.
2) **Werkstatt/Lager Upgrade auf medium/large (ohne klaren Engpass) — Money sink**
   - Grund: steigender Unterhalt (AK+Gold) drückt die Netto-ROI; sinnvoll erst wenn Caps/Markt/Veredelung wirklich „ziehen“.
3) **Veredelungs-Einrichtung (`special.*.refine`) — derzeit oft zu schwach**
   - Grund: Auto-Konversion bewertet Sondermaterial meist gleich; Refinement lohnt sich erst, wenn Marktgruppen/Verkaufssystem Refinement zuverlässig belohnen.

## Posten (Holdings) — Top 3 / Flop 3

### Stärkste Posten
1) **Stadtbesitz (verpachtet), insbesondere `large` — Game-breaking**
   - Beispiel GoldEq/Payback (nur Daumenregel): `large` kostet 50g und liefert ~22.4 GoldEq/R → Payback ~2–3 Runden.
   - Zusätzlich: +Einfluss/+AK treiben viele weitere Aktionen.
2) **Ämter (medium/large in Gold-Mode) — Balanceschädigend**
   - Problemverdacht: Medium-Amt liefert 10g/R bei relativ moderaten Einstiegskosten; zudem werden Voraussetzungen aktuell **nicht verbraucht** (2 small sind Voraussetzung, bleiben aber erhalten).
3) **Unterwelt-Organisationen mit HQ in großem Stadtbesitz — Game-breaking (Synergie)**
   - Skaliert mit `maxCityTier` → „ein großes HQ“ triggert sehr starke Gold+Einfluss-Erträge.

### Schwächste Posten
1) **Stadtbesitz (Eigenproduktion) — Nutzlos im aktuellen Meta**
   - Wird kaum gewählt, weil der Opportunity-Cost gegenüber verpachtet extrem hoch ist.
2) **Handelsunternehmung `trade` (small/medium) — eher schwach**
   - In der Baseline frisst `trade` Sondermaterial als Opportunity-Cost; ohne sehr gutes Marktfenster ist die Netto-ROI klein.
3) **Werkstatt upgegradet (medium/large) — häufig Money sink**
   - Grund: hoher Unterhalt + teure Spezialisten + Caps; ohne spezielle Markt-/Refine-Kombos oft schlechter als „mehr Quellen“ (Domänen/Städte).

## Berater (Specialists) — Top 3 / Flop 3

### Stärkste Berater (im aktuellen Code)
1) **`workshop`/`artisan` (master)** — wichtigster Enabler für große Werkstätten/Lager.
2) **`workshop`/`artisan` (experienced)** — Enabler für große Werkstätten/Lager.
3) **`workshop`/`artisan` (simple)** — Enabler für mittlere Werkstätten/Lager.

### Schwächste Berater (im aktuellen Code)
1) **`wizard` (any tier)** — aktuell ohne Engine-Effekt → Nutzlos/Money sink.
2) **`politician` (any tier)** — aktuell ohne Engine-Effekt → Nutzlos/Money sink.
3) **`tactician` (any tier)** — aktuell ohne Engine-Effekt → Nutzlos/Money sink.

## Konkrete Balancing-Vorschläge (priorisiert)
1) **Stadtbesitz-Spam bremsen (sehr hoher Impact)**
   - Option A: Cap pro Spieler (z.B. `maxCities = 1 + 2*officeTierSum` oder hard cap pro Tier).
   - Option B: Kosten stark erhöhen (insb. medium/large) oder „Erwerb kostet auf Fail auch etwas“ (Bribes/Fees).
   - Option C: verpachtete Erträge senken oder Unterhalt einführen (z.B. 25–50% der Gold-Erträge als Steuer/Unterhalt).
2) **Ämter-Progression korrekt modellieren**
   - Wenn das Regelwerk es so meint: beim Erwerb von `medium`/`large` die unteren Ämter **verbrauchen/umwandeln** (Upgrade statt reinem Prereq).
   - Alternativ: Medium/large Kosten deutlich erhöhen oder Ertrag pro Runde senken.
3) **Unterwelt-Skalierung entschärfen**
   - Nicht mit `maxCityTier` skalieren, sondern z.B. mit `sqrt(cityTierSum)` oder „nur HQ-Tier, aber geringere Multiplikatoren“.
   - Oder harte Kopplung: Underworld tier 2/3 erfordert HQ tier 2/3 + Unterhalt steigt deutlich.
4) **Eigenproduktion im Stadtbesitz spielbar machen**
   - Entweder: Produktion behält einen Teil von Gold/Einfluss (z.B. 50%) **oder** Upkeep stark senken.
   - Ziel: Werkstatt-/Lager-Spiel im Stadtbesitz soll realistisch werden, sonst bleibt es ein toter Pfad.
5) **Specialist-Kinds implementieren oder entfernen**
   - Kurzfristig: nur `artisan/workshop` erlauben (oder alle anderen deutlich billiger, aber klar als „noch ohne Effekt“ markieren).
   - Mittelfristig: konkrete Effekte pro SpecialistKind (DC-Boni, Caps, Bonusaktionen).
