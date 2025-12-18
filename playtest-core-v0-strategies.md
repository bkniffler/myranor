# Playtest Report — core-v0-strategies

Generated: 2025-12-18T12:09:18.653Z
Config: runs=200, rounds=20, seed=42

## Überblick
- Gini (Final-Gold): mean=0.234 p50=0.234 p90=0.320
- Dominanzindikator: top=domainFocus (winRate=0.700) gap=0.480

## Outcomes (pro Strategie)
| Agent | winRate | FinalGold mean | p10 | p50 | p90 | Sell Gold/Inv mean | Sell Market/Inv mean | Conv Gold/Run mean |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| domainFocus | 0.700 | 292.96 | 237.80 | 293.50 | 343.10 | 3.57 | 0.75 | 5.45 |
| workshopFocus | 0.220 | 250.48 | 198.80 | 247.00 | 313.10 | 3.71 | 0.46 | 0.62 |
| tradeFocus | 0.060 | 223.51 | 169.00 | 223.00 | 282.00 | 3.77 | 0.49 | 0.42 |
| cityUnderworld | 0.020 | 135.07 | 56.90 | 132.50 | 220.20 | 3.73 | 0.50 | 0.78 |
| officeFocus | 0.005 | 89.89 | 28.90 | 80.50 | 160.10 | 0.00 | 0.00 | 0.80 |

## Aktionen (Top-Counts)
- domainFocus: material.domain=3821, money.sell=3770, material.workshop=35
- workshopFocus: material.workshop=4000, money.sell=3963, money.lend=37
- tradeFocus: money.lend=3985, money.sell=2457, material.workshop=1558
- cityUnderworld: influence=3953, acquire.office=2393, money.sell=1047, material.domain=560
- officeFocus: influence=4000, acquire.office=2382, money.lend=1266, material.domain=352

## Markt (Verteilung)
- Markt-Rohmaterial: samples=4000
  - Modifiers basic: mean=0.73 p10=-2.00 p50=0.00 p90=5.00
- Markt-Sondermaterial: samples=4000
  - Modifiers basic: mean=0.46 p10=-2.00 p50=0.00 p90=4.00

## Ereignisse (Verteilung & aktive Modifiers)
- Sections=800 Events=1600
- Häufigste Ereignisse: Neues Bergwerk erschlossen(91), Der Fliegende Basar(76), Alchemistischer Unfall(76), Sperrung wichtiger Pässe, Marodierende Söldner(72), Kriegszug und Musterung(72), Erhöhte Steuereinnahmen(70), Offener Konflikt in Nachbarprovinz(70), Konflikt mit Nachbarn(69), Starke Unwetter und Stürme(62), Korruptionsuntersuchung(57), Opulente Religiöse Feiertage und Prozessionen(56), Unheilvolle Konstellationen(54)
- Modifiers (mean): taxGoldPerRound=0.13, oneTimeOfficeTax=0.10, officeGoldMult=0.983, officeGoldBonus=0.17, sellDcBonus=0.34, lendPayoutMult=0.971, bonusGold/2inv=0.05

## Bewertung (heuristisch)
- Sehr starke Dominanz von `domainFocus` (winRate=0.700, gap=0.480). Balancing-Änderung wahrscheinlich nötig.

## Vorschläge (nächste Iteration)
- Materialtypen modellieren und Marktmodifikatoren nach Typ anwenden (statt pauschal basic).
- Caps/Unlocks nach Handelsunternehmung/Domäne/Circel implementieren (damit Strategien “richtig” spielbar sind).
- Weitere „Gewinn permanenter Posten“-Actions implementieren (Domänenkauf, Stadtbesitz, Circel/Collegien, Handelsunternehmungen).
- Falls Markt-Timing dominiert: Marktbonus nicht linear pro Investition oder Lagerkosten/Verluste erhöhen.
