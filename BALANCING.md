# Balancing – Erkenntnisse & Vorschläge

Stand: 5x LLM-Playtests (15 Runden), Seeds 101/202/303/404/505, Scenario `core-v1-strategies`, Scoring: **GoldEq**.

## Kurzfazit
- Es gibt **keinen klaren Dominator** über 5 Seeds; Sieger wechseln (gut fürs Balancing).
- **Handel & Geld** ist am **volatilsten** (wie gewünscht), und gewinnt 2/5 Seeds.
- **Stadt & Unterwelt** ist im Schnitt **zu schwach** (0/5 Siege, niedrigster Ø‑Score).
- **Handelsunternehmungen** werden aktuell **gar nicht** gebaut (0 in allen Runs) → Pfad ist zu unattraktiv oder schlecht sichtbar.
- **Ämter** sind nicht nur für Amtsfokus attraktiv (viele Strategien kaufen 1–3 Ämter) → Office‑ROI/Accessibility im Blick behalten.

## Ergebnisse (GoldEq Scores pro Seed)
```
Seed 101: Amtsfokus 401.30 | Handel & Geld 488.50 | Stadt & Unterwelt 503.45 | Werkstattfokus 509.95 | Domänenfokus 638.15
Seed 202: Amtsfokus 474.60 | Handel & Geld 483.55 | Stadt & Unterwelt 421.40 | Werkstattfokus 616.15 | Domänenfokus 514.70
Seed 303: Amtsfokus 534.95 | Handel & Geld 715.20 | Stadt & Unterwelt 436.85 | Werkstattfokus 592.25 | Domänenfokus 382.15
Seed 404: Amtsfokus 567.60 | Handel & Geld 582.60 | Stadt & Unterwelt 425.30 | Werkstattfokus 553.30 | Domänenfokus 434.25
Seed 505: Amtsfokus 589.70 | Handel & Geld 466.35 | Stadt & Unterwelt 334.70 | Werkstattfokus 481.45 | Domänenfokus 482.50
```

## Durchschnitt (5 Runs)
```
Werkstattfokus   Ø 550.62 (sd 49.95; min 481.45; max 616.15)
Handel & Geld    Ø 547.24 (sd 93.29; min 466.35; max 715.20)
Amtsfokus        Ø 513.63 (sd 68.26; min 401.30; max 589.70)
Domänenfokus     Ø 490.35 (sd 86.43; min 382.15; max 638.15)
Stadt & UnterweltØ 424.34 (sd 53.78; min 334.70; max 503.45)
```

## Durchschnittliche Holdings (15R, 5 Seeds)
```
Amtsfokus        d1.0 c1.6 o6.2 org0.0 trade0.0 ws1.0 store0.8
Handel & Geld    d1.0 c4.8 o1.2 org1.2 trade0.0 ws1.0 store1.4
Stadt & Unterweltd1.0 c3.0 o0.0 org1.6 trade0.0 ws1.0 store1.0
Werkstattfokus   d1.0 c4.2 o2.2 org0.6 trade0.0 ws1.8 store0.6
Domänenfokus     d1.8 c3.2 o1.6 org0.0 trade0.0 ws1.0 store1.6
```

## Beobachtetes LLM-Verhalten
- **Generisch dominant:** `MoneySellBuy`/`MoneySell` + Lagerhaltung + City‑Scaling.
- **Handel & Geld:** deutliche Varianz (Seed‑abhängig), aber **kein** `AcquireTradeEnterprise` → Kernpfad fehlt.
- **Stadt & Unterwelt:** kauft Orgs, aber Score bleibt zurück (Unterwelt‑ROI zu niedrig oder zu spät).
- **Viele Strategien kaufen Ämter**, selbst wenn nicht Fokus (spricht für hohen Office‑ROI).

## Haupttreiber der Balance-Probleme
1. **Trade‑Pfad fehlt praktisch** (0 Handelsunternehmungen) → Balance nicht bewertbar, weil die Strategie “Handel” über City+SellBuy läuft.
2. **City/Office als Universal‑Investments** → Strategiedifferenzierung verwässert; ggf. sind diese zu effizient.
3. **Unterwelt** liefert im Vergleich zu wenig GoldEq‑Wert (direkt/indirekt) → fällt zurück.

## Konkrete Balancing‑Tweaks (Vorschläge)
### 1) Handelsunternehmungen “einschalten”
- ROI klarer machen (Ertrag/Unterhalt/Facility‑Synergien) und im Prompt/Strategy‑Card explizit als primärer Pfad führen.
- Optional: erste Handelsunternehmung leichter zugänglich (Kosten/DC oder frühe Einrichtung als “Ramp”).

### 2) Stadt & Unterwelt buffen
- Unterwelt‑Orgs/Einstellungen messbar stärker (Gold/Influence/Slots/DC‑Vorteile) oder früher wirksam machen.
- Alternativ: Unterwelt stärker mit Markt (bessere SellBuy‑Caps/Mods) oder City verknüpfen.

### 3) Office/City ROI prüfen
- Wenn weiterhin “Universal‑Best‑Buy”: Office‑Kosten/Erträge/Facility‑ROI oder Caps nachziehen, damit Fokusstrategien klarer differenzieren.

### 4) Testhorizont erhöhen (für Domänenfokus)
- Domänenfokus ist “slow & stable” – 15 Runden sind evtl. zu kurz; zusätzlich 30–40R laufen lassen, bevor nerfs/buffs finalisiert werden.

## Nächste Schritte (empfohlen)
1. **TradeEnterprises** so buffen/sichtbar machen, dass “Handel & Geld” sie zuverlässig kauft.
2. Unterwelt‑Pfad (Orgs+Einrichtungen) so justieren, dass er nicht systematisch hinterherhinkt.
3. Danach: 10–20 Seeds, 20–30 Runden, gleiche Auswertung.
