# Scoring: Gold-Äquivalenz (v1)

Diese Liste definiert die Basiskonversionen fuer die Erfolgsmessung in Gold.
Gold ist der Referenzwert; alle anderen Werte werden als Gold-Aequivalent
berechnet. Die Werte sind bewusst konservativ und koennen spaeter feinjustiert
werden. Annahme: erwarteter ROI wird ueber `ROI_ROUNDS` Runden bewertet.

## Annahmen
- ROI_ROUNDS = 10
- Gold ist Referenzwert (1.0).
- Erwartete Ertraege basieren auf Standard-DCs ohne starke Event-Boni.

## Grundwerte (pro Einheit)
- Gold: 1.0
- Rohmaterial (RM): 0.25 (Auto-Umwandlung 4 RM -> 1 Gold)
- Sondermaterial (SM): 2.0 (Auto-Umwandlung 1 SM -> 2 Gold)
- Arbeitskraft (AK): 2.0 (Erwartungswert aus Materialgewinn)
- Einfluss (temp): 0.6 (nahe am Amt-Kauf-Umtauschverhaeltnis)
- Einfluss (perm, pro Runde): 0.6
- Kampfkraft (1 Punkt): 8.0 (naeherungsweise Miliz-Kosten)
- Magiekraft: 0.0 (derzeit kein klarer Gold-ROI im System)

## DC-Boni & Bonusaktionen (Gold-Aeq.)
- DC -1 auf Aktionen: +0.5 Gold pro Runde (konservativ)
- Bonusaktion Geld: +4.0 Gold pro Runde
- Bonusaktion Einfluss: +2.0 Gold pro Runde
- Bonusaktion Materialien: +2.0 Gold pro Runde

## Posten & Einrichtungen (Gold-Aeq., Formel)
- Postenwert = Kaufkosten (Gold + Einfluss*0.6 + Materialwert)
  + Erwarteter Netto-Ertrag pro Runde * ROI_ROUNDS
  + DC-Boni / Bonusaktionen * ROI_ROUNDS

## Beispiele fuer Netto-Ertrag pro Runde
- Domäne: (RM-Ertrag*0.25 + AK-Ertrag*2.0 - Goldunterhalt)
- Stadtbesitz (leased): (Gold + Einfluss*0.6 + AK*2.0)
- Stadtbesitz (production): (AK*2.0 - Goldunterhalt)
- Amt (Yield-Mode):
  - influence: Einfluss*0.6
  - gold: Gold
  - split: (Gold + Einfluss*0.6) / 2
- Handelsunternehmung:
  - trade: Gold (4/10/24 je Tier) - (verbrauchtes SM * 2 Gold) - Unterhalt (+/- Markt/Event, nicht in der Basis eingerechnet)
  - produce: SM (6/12/24 Gold je Tier) - Unterhalt
- Werkstatt (auto-Konversion):
  - Netto = (SM-Out*2.0 - RM-In*0.25 - Unterhalt)
  - Hinweis: Marktboni koennen diesen Wert in der Praxis deutlich erhoehen.
