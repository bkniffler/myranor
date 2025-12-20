# Balancing – Erkenntnisse & Vorschläge

Stand: 4x LLM-Playtests (20 Runden), Seeds 7/13/21/42, Scenario `core-v1-strategies`.

## Kurzfazit
- **Domänenfokus** ist aktuell klar zu stark und zugleich stark swingy.
- **Handel & Geld** ist im Vergleich zu schwach (zu viel Lending/Conversion, zu wenig Trade-Engine).
- **Stadt & Unterwelt** hat hohe Varianz; gutes Setup performt stark, schlechtes Setup fällt stark ab.
- **Werkstattfokus** ist stabil, aber nur Mid-Tier; Workshops sind allgemein attraktiv (auch für andere Strategien).
- **LLM-Fehler** (invalid actions) verzerren Ergebnisse und sollten reduziert werden.

## Ergebnisse (Scores pro Seed)
```
Seed 7 : Amtsfokus 153 | Handel & Geld 98 | Stadt & Unterwelt 150.5 | Werkstattfokus 116.5 | Domänenfokus 137.25
Seed 13: Amtsfokus 183.5 | Handel & Geld 116.5 | Stadt & Unterwelt 210.5 | Werkstattfokus 121.5 | Domänenfokus 174.75
Seed 21: Amtsfokus 197 | Handel & Geld 135.5 | Stadt & Unterwelt 86.5 | Werkstattfokus 138.5 | Domänenfokus 252.75
Seed 42: Amtsfokus 95 | Handel & Geld 111 | Stadt & Unterwelt 193.75 | Werkstattfokus 117 | Domänenfokus 314
```

## Durchschnitt (4 Runs)
```
Amtsfokus        Ø 157.1
Handel & Geld    Ø 115.3
Stadt & UnterweltØ 160.3
Werkstattfokus   Ø 123.4
Domänenfokus     Ø 219.7
```

## Beobachtetes LLM-Verhalten
- **Generisch dominant:** `GainMaterials` + `MoneySell` in vielen Strategien.
- **Amtsfokus:** sehr viele `GainInfluence` + `AcquireOffice`, hoher Einsatz von temporärem Einfluss.
- **Handel & Geld:** viele `MoneyLend`, aber zu wenige `AcquireTradeEnterprise`.
- **Stadt & Unterwelt:** Organisationen werden teils gekauft, aber nicht konstant.
- **Werkstattfokus:** sehr viele Workshops; stabiler Goldfluss über Conversion.
- **Domänenfokus:** starke Rohstoffproduktion + Market‑Sell + Lager‑Synergien.
- **Fehler:** wiederholt invalid actions (z.B. `MoneySell ERR(AUTH)`), das drückt Scores.

## Haupttreiber der Balance-Probleme
1. **Domänen-Snowball**: Rohstoffmengen + Marktverkauf + Lagerung erzeugen starken Gold-Loop.
2. **Trade‑Pfad zu schwach / zu wenig sichtbar**: LLM greift lieber zu Lending/Conversion.
3. **Influence‑Economy**: Amtsfokus kann sehr stark sein, wenn Office‑Kette früh sitzt, fällt aber ab bei schlechten Rolls.
4. **LLM‑Stabilität**: invalid actions reduzieren Effektivität und verfälschen den Vergleich.

## Konkrete Balancing‑Tweaks (Vorschläge)
### 1) Domänenfokus nerfen
- **Option A:** Rohstoff‑Yield pro Domäne leicht senken.
- **Option B:** Marktverkauf für Rohstoffe leicht nerfen (z.B. geringerer Multiplikator).
- **Option C:** Kosten für zusätzliche Domänen leicht erhöhen.
- **Option D:** Lager‑Synergie dämpfen (z.B. Lagerkosten/Upkeep oder geringere Lager‑Effizienz).

### 2) Handel & Geld buffen
- **Trade‑Enterprises** attraktiver machen (höherer Ertrag oder Synergie mit `MoneySell`).
- **MoneyLend** Risiko erhöhen oder ROI leicht senken, damit der Pfad nicht dominiert.

### 3) Stadt & Unterwelt glätten
- **Organization/City‑Pfad** stabiler machen (leichter zugängliche Erträge oder geringere Schwankung).
- Optional: kleine, planbare Boni für City‑Holdings, damit der Pfad nicht komplett RNG‑getrieben ist.

### 4) LLM-Qualität erhöhen
- **Keine invalid actions** zulassen (striktere Action‑Validierung, dedupe, retries).
- **Mehr Kontext im Prompt** (Ziele, Ressourcen, Score‑Beitrag je Asset, letzte 1–2 Runden). 
- **Strategy Cards + Rolling Summary** konsequent verwenden.

## Nächste Schritte (empfohlen)
1. **LLM-Fehler eliminieren**, dann 4–8 Seeds neu laufen lassen.
2. **Ein Domänen‑Nerf + Trade‑Buff** testen (separat), dann erneut vergleichen.
3. **Ergebnisse im selben Format** dokumentieren (Scores + Holdings + Action‑Mix).
