# Kronrat – Virtueller Playtest (4 Spieler) – Zug‑für‑Zug

Dieses Protokoll ist **ein** plausibler Durchlauf mit realistischen (nicht optimalen) Entscheidungen, Bluff/Deals und ein paar Fehlern. Zahlen/Deck‑Order sind für den Test festgelegt, damit man es nachspielen kann.

## Tischregeln für diesen Testlauf (klar definiert)
- **Rundenanzahl:** 8
- **Marker:** `Ruhe`/`Wohlstand` 1–10. Sobald einer auf `1` fällt → **Reich kollabiert, alle verlieren**.
- **Ereignis‑Slots:** Öffentlich (offen) + Verdeckte Angelegenheit (verdeckt).
  - Öffentlicher Slot startet bei Schwierigkeit **immer auf „Krise“**.
  - Verdeckter Slot startet bei Schwierigkeit **immer auf „Schwelen“**.
  - Scheitern eskaliert (Schwelen→Krise→Katastrophe); Katastrophe bleibt Katastrophe.
- **Beiträge:** Ressourcen werden beim Commit **immer ausgegeben** (Erfolg oder nicht).
- **Verdeckte Angelegenheit:** Sprecher kündigt Anforderungen an (darf lügen). Beiträge werden **gleichzeitig verdeckt** gelegt, dann aufgedeckt.
- **Untersuchung:** nur wenn in dieser Runde eine Schwierigkeit im **Krise/Katastrophe‑Stadium** scheitert (nicht bei reinem „Schwelen“‑Fehlschlag).
  - `Bestechen (2G)` wird als **Geldtransfer an den Herrscher** gespielt.
- **Thronfolgefrage (Katastrophe‑Fehlschlag):** löst Usurpation aus und gilt danach als „durch Gewalt entschieden“ → Karte wird **abgeworfen**.
- **Usurpation:** wie `final_concept.md` (Commit `P`+`K`, `Ruhe -1`, beide Slots würden +1 eskalieren; wenn Slots leer → kein Effekt).
- **Gefallen:** Marker sind **gerichtet** (Schuldner → Gläubiger).
  - Einlösen „1 Ressource“: Gläubiger fordert 1 Ressource, Schuldner gibt **eine beliebige** Ressource seiner Wahl.
  - Weigert sich ein Schuldner, wird der Gefallen **abgeworfen** und `Ruhe -1`.
  - **Neue Gefallen** entstehen im Testlauf entweder durch Karten/Effekte oder als Teil der Intrige‑Aktion „Gefallen handeln“ (beidseitig vereinbart).

## Setup
**Sitzreihenfolge (im Uhrzeigersinn):**
1. **König Edric** (Herrscher, Startspieler)
2. **Isolde von Morgenstein** (Beraterin)
3. **Graf Oskar Silbermark** (Berater)
4. **Meister Varrik Nebelborn** (Berater)

**Startmarker:** `Ruhe 7`, `Wohlstand 7`, Runde 1

**Start‑Ämter (je 2), offen:**
- Isolde: `Reichskanzler` + `Bischof`
- Oskar: `Reichsschatzmeister` + `Zollmeister`
- Varrik: `Reichsmarschall` + `Burggraf`

**Dynastien/Agenda/Loyalität (verdeckt; hier fürs Protokoll offengelegt):**
- Isolde: `Haus Morgenstein` · Loyalität `Unloyal` · Agenda `Königsmacher`
- Oskar: `Haus Silbermark` · Loyalität `Opportunist` · Agenda `Schatzhort`
- Varrik: `Haus Nebelborn` · Loyalität `Loyal` · Agenda `Netzwerker`

**Start‑Gefallen (aus Setup‑Variante):**
- Isolde → König (Isolde schuldet dem König 1 Gefallen)
- Oskar → Isolde
- Varrik → Oskar

**Sprecher‑Rotation (verdeckter Slot):** R1 Isolde → R2 Oskar → R3 Varrik → … (B, C, D wiederholen)

## Ereignis‑Deck (Top → Bottom) für diesen Test
1. Handelsblockade
2. Brand in der Königsburg
3. Turnier der Banner
4. Bauernaufstand
5. Marktprivileg
6. Grenzkrieg an den Pässen
7. Missernte
8. Thronfolgefrage
9. Kirchenschisma
10. Verkauf von Kronland
11. Pest im Hafen
12. Königliche Hochzeit

## Schatzkammer‑Züge des Herrschers (pro Runde)
- R1: `P G M`
- R2: `K P M`
- R3: `P G M K`
- R4: `P G M M`
- R5: `P G G M`
- R6: `G M M K`
- R7: `P P G M`
- R8: `P G M K`

---

# Runde 1 (Sprecher: Isolde)
**Start:** Ruhe 7 · Wohlstand 7 · Slots leer

## 1) Einkommen
- Isolde: +`P P` (Kanzler, Bischof)
- Oskar: +`G G` (Ämter) +`G` (Zollmeister‑Bonus) → `G G G`
- Varrik: +`K K`
- König: Schatzkammer `P G M`

**Pools nach Einkommen**
- König: `P1 G1 M1`
- Isolde: `P2`
- Oskar: `G3`
- Varrik: `K2`

## 2) Patronage (König)
- König gibt `M1` an Varrik (Material fehlt im Reich).
- König gibt `G1` an Isolde (damit sie notfalls „Bischof“ aktivieren kann).
- König behält `P1`.
- König vergibt Amt aus Vorrat: `Truchsess` an Varrik (Material‑Wirtschaft ankurbeln).

**Pools nach Patronage**
- König: `P1`
- Isolde: `P2 G1`
- Oskar: `G3`
- Varrik: `K2 M1` (+Truchsess)

## 3) Öffentliche Krise (offen)
Karte: **Handelsblockade** (Krise) – Kosten `2P 2G` → Erfolg: `Wohlstand +1`
- Isolde zahlt `2P`
- Oskar zahlt `2G`

**Erfolg:** Wohlstand 7→8. König erhält `Prestige +1` (Staatsräson).

**Pools**
- König: `P1`
- Isolde: `G1`
- Oskar: `G1`
- Varrik: `K2 M1`

## 4) Verdeckte Angelegenheit (verdeckt)
Isolde zieht verdeckt: **Brand in der Königsburg** (Schwelen) – echte Kosten `1M 1G`
- Isolde behauptet: „Kleines Hofding, `1P 1G` reicht.“
- Verdeckt commit:
  - König: `P1`
  - Isolde: `G1`
  - Oskar: `—` (will sein letztes `G` nicht riskieren)
  - Varrik: `—`

**Aufdecken:** Es fehlt `M` → **Fehlschlag:** Wohlstand 8→7. Karte bleibt, eskaliert zu **Krise**.

## 5) Urteil & Intrige
Keine Untersuchung (nur Schwelen scheiterte).

**Intrigen**
- Isolde löst `Oskar→Isolde` ein (fordert 1 Ressource). Oskar **weigert sich** → Gefallen abwerfen, `Ruhe -1` (7→6).
- Oskar versucht König zu „kaufen“: gibt König `1G` → durch `Haus Silbermark` entsteht `König→Oskar` (neuer Gefallen). Oskar endet mit `0G`.
- Varrik `Abzweigen`: `1K` → `Prestige +1`, `Korruption +1`.

**Rundenende – Pflichten**
- Oskar (`Haus Silbermark`): hat `0G` → `Korruption +1`.

**Ende Runde 1**
- Marker: Ruhe **6**, Wohlstand **7**
- Slots: Öffentlich leer · Verdeckt: **Brand (Krise)**
- Prestige: König 1 · Isolde 0 · Oskar 0 · Varrik 1
- Korruption: König 0 · Isolde 0 · Oskar 1 · Varrik 1
- Gefallen: Isolde→König · Varrik→Oskar · König→Oskar
- Ressourcen: König `G1` · Isolde `—` · Oskar `—` · Varrik `K1 M1`

---

# Runde 2 (Sprecher: Oskar)
**Start:** Ruhe 6 · Wohlstand 7 · Verdeckter Slot: Brand (Krise)

## 1) Einkommen
- Isolde: +`P P` → `P2`
- Oskar: +`G G` +`G` (Zollmeister) → `G3`
- Varrik: +`K K` +`M` (Truchsess) → aus `K1 M1` wird `K3 M2`
- König: +Schatzkammer `K P M` → zu `G1` wird `G1 K1 P1 M1`

## 2) Patronage
- König gibt `P1` an Isolde (Krise braucht `P`).
- König gibt `M1` an Varrik (Brand braucht Material).
- König behält `G1 K1`.

## 3) Öffentliche Krise
Karte: **Turnier der Banner** (Gelegenheit) – Kosten `1K 1G` → Effekt `Ruhe +1` und „meiste `K`“ bekommt `Prestige +2`
- König zahlt `1K` (will den Bonus)
- Oskar zahlt `1G`

**Erfolg:** Ruhe 6→7. König erhält `Prestige +1` (offener Slot) und `+2` (meiste `K`).

## 4) Verdeckte Angelegenheit
Offen (weil bereits aufgedeckt): **Brand in der Königsburg** (Krise) – Kosten `2M 1G 1P` → Erfolg `Wohlstand +1`
- Varrik zahlt `2M`
- Isolde zahlt `1P`
- Oskar zahlt `1G`

**Erfolg:** Wohlstand 7→8.

## 5) Urteil & Intrige
Keine Untersuchung (nichts im Krise/Katastrophe‑Stadium gescheitert).

**Intrigen**
- Isolde `Abzweigen`: `1P` → `Prestige +1`, `Korruption +1`.
- Oskar löst `König→Oskar` ein (fordert 1 Ressource). König gibt `1G`. Gefallen wird abgeworfen.
- Varrik begleicht `Varrik→Oskar`: gibt Oskar `1K`; im Gegenzug wird ein neuer Gefallen vereinbart: `Oskar→Varrik`. (Netzwerker‑Agenda: `Prestige +1`)

**Ende Runde 2**
- Marker: Ruhe **7**, Wohlstand **8**
- Slots: beide leer
- Prestige: König 4 · Isolde 1 · Oskar 0 · Varrik 2
- Korruption: König 0 · Isolde 1 · Oskar 1 · Varrik 1
- Gefallen: Isolde→König · Oskar→Varrik
- Ressourcen: König `—` · Isolde `P1` · Oskar `G2 K1` · Varrik `K2 M1`

---

# Runde 3 (Sprecher: Varrik)
**Start:** Ruhe 7 · Wohlstand 8 · Slots leer

## 1) Einkommen
- Isolde: +`P P` → aus `P1` wird `P3`
- Oskar: +`G G` +`G` (Zollmeister) → aus `G2 K1` wird `G5 K1`
- Varrik: +`K K` +`M` → aus `K2 M1` wird `K4 M2`
- König: +Schatzkammer `P G M K` → `P1 G1 M1 K1`

## 2) Patronage
- König gibt Isolde `1G` (für Einfluss am Hof).
- König gibt Varrik `1M` (Vorräte).
- König behält `P1 K1`.

## 3) Öffentliche Krise
Karte: **Bauernaufstand** (Krise) – Kosten `2P 1K 1G` → Erfolg `Ruhe +1`
- Isolde zahlt `2P`
- Varrik zahlt `1K`
- Oskar zahlt `1G`

**Erfolg:** Ruhe 7→8. König erhält `Prestige +1`.

## 4) Verdeckte Angelegenheit
Varrik zieht verdeckt: **Marktprivileg** (Gelegenheit) – Kosten `1P 1M` → Effekt `Wohlstand +2` und Host wählt `Korruption +1` **oder** schuldet `1 Gefallen`
- Isolde (als Reichskanzlerin) fragt: „Hat es Marker‑Nachteile?“ → Varrik: „Nein.“
- Verdeckt commit:
  - König: `1P`
  - Varrik: `1M`
  - Isolde: `—`
  - Oskar: `—`

**Erfolg:** Wohlstand 8→10. Varrik wählt „schulde dem König 1 Gefallen“ → `Varrik→König`.

## 5) Urteil & Intrige
König vergibt Amt aus Vorrat: `Baumeister des Reiches` an Oskar (Bauprojekte/Prestige).

**Intrigen**
- Isolde `Vertuschen`: zahlt `1P 1G` → entfernt `1 Korruption` (1→0).
- Oskar `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1` (1→2).
- Varrik „Gefallen handeln“: gibt Isolde `1K`, Isolde schuldet `Varrik` 1 Gefallen → `Isolde→Varrik` (Netzwerker: `Prestige +1`).

**Ende Runde 3**
- Marker: Ruhe **8**, Wohlstand **10**
- Prestige: König 5 · Isolde 1 · Oskar 1 · Varrik 3
- Korruption: König 0 · Isolde 0 · Oskar 2 · Varrik 1
- Gefallen: Isolde→König · Varrik→König · Oskar→Varrik · Isolde→Varrik
- Ressourcen: König `K1` · Isolde `K1` · Oskar `G3 K1` · Varrik `K2 M2`

---

# Runde 4 (Sprecher: Isolde)
**Start:** Ruhe 8 · Wohlstand 10 · Slots leer

## 1) Einkommen
- Isolde: +`P P` → `P2 K1`
- Oskar: +`G G` +`G` (Zollmeister) +`M` (Baumeister) → aus `G3 K1` wird `G6 K1 M1`
- Varrik: +`K K` +`M` → aus `K2 M2` wird `K4 M3`
- König: +Schatzkammer `P G M M` → zu `K1` wird `P1 G1 M2 K1`

## 2) Patronage
- König gibt Isolde `1G`.
- König gibt Varrik `1M`.
- König behält `P1 M1 K1`.

## 3) Öffentliche Krise
Karte: **Grenzkrieg an den Pässen** (Krise) – Kosten `2K 1M 1G` → Erfolg `Ruhe +1`
- König zahlt `1K`
- Varrik zahlt `1K 1M`
- Oskar zahlt `1G`

**Erfolg:** Ruhe 8→9. König erhält `Prestige +1`.

## 4) Verdeckte Angelegenheit
Isolde zieht verdeckt: **Missernte** (Schwelen) – Kosten `1M 1G` → Erfolg `Wohlstand +1` / Fehlschlag `Wohlstand -1`
- Weil `Wohlstand` schon 10 ist, schlägt Isolde vor zu „riskieren“.
- Verdeckt commit: alle `—`

**Fehlschlag:** Wohlstand 10→9. Karte bleibt, eskaliert zu **Krise**.

## 5) Urteil & Intrige
Keine Untersuchung (nur Schwelen scheiterte).

**Intrigen**
- Isolde `Abzweigen`: `1P` → `Prestige +1`, `Korruption +1`.
- Oskar `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1`.
- Varrik löst `Oskar→Varrik` ein → Oskar gibt `1G`. (Gefallen wird abgeworfen.)

**Ende Runde 4**
- Marker: Ruhe **9**, Wohlstand **9**
- Slots: Öffentlich leer · Verdeckt: **Missernte (Krise)**
- Prestige: König 6 · Isolde 2 · Oskar 2 · Varrik 3
- Korruption: König 0 · Isolde 1 · Oskar 3 · Varrik 1
- Gefallen: Isolde→König · Varrik→König · Isolde→Varrik
- Ressourcen: König `P1 M1` · Isolde `P1 K1 G1` · Oskar `G3 K1 M1` · Varrik `K3 M3 G1`

---

# Runde 5 (Sprecher: Oskar)
**Start:** Ruhe 9 · Wohlstand 9 · Verdeckter Slot: Missernte (Krise)

## 1) Einkommen
- Isolde: +`P P` → aus `P1 K1 G1` wird `P3 K1 G1`
- Oskar: +`G G` +`G` (Zollmeister) +`M` (Baumeister) → aus `G3 K1 M1` wird `G6 K1 M2`
- Varrik: +`K K` +`M` → aus `K3 M3 G1` wird `K5 M4 G1`
- König: +Schatzkammer `P G G M` → aus `P1 M1` wird `P2 G2 M2`

## 2) Patronage
- König gibt Isolde `1G` (um sie bei Ratssachen „bei Laune“ zu halten).
- König gibt Varrik `1M`.
- König behält `P2 G1 M1`.

## 3) Öffentliche Krise
Karte: **Thronfolgefrage** (Krise) – Kosten `2P 1G` → Erfolg `Ruhe +1` / Fehlschlag `Ruhe -2`
- König und Isolde zahlen zusammen `2P`, aber niemand will `G` beisteuern (alle „sparen“ für die Erntekrise).

**Fehlschlag:** Ruhe 9→7. Karte bleibt, eskaliert zu **Katastrophe**.

## 4) Verdeckte Angelegenheit
Offen (weil bekannt): **Missernte** (Krise) – Kosten `2M 2G 1P` → Erfolg `Wohlstand +1`
- Varrik zahlt `2M`
- Oskar zahlt `2G`
- Isolde zahlt `1P`

**Erfolg:** Wohlstand 9→10. Slot wird leer.

## 5) Urteil & Intrige
Da eine Krise scheiterte, untersucht der König.
- Untersuchung: Ziel **Oskar**, Amt **Reichsschatzmeister**.
- Oskar wählt `Bestechen` und zahlt `2G` an den König → keine Konsequenz.

**Intrigen**
- Isolde `Vertuschen`: zahlt `1P 1G` → entfernt `1 Korruption` (1→0).
- Oskar gibt König `1G` (Silbermark‑Deal) → `König→Oskar` (neuer Gefallen).
- Varrik löst `Isolde→Varrik` ein → Isolde gibt `1K`. (Gefallen wird abgeworfen.)

**Ende Runde 5**
- Marker: Ruhe **7**, Wohlstand **10**
- Slots: Öffentlich: **Thronfolgefrage (Katastrophe)** · Verdeckt leer
- Prestige: König 6 · Isolde 2 · Oskar 2 · Varrik 3
- Korruption: König 0 · Isolde 0 · Oskar 3 · Varrik 1
- Gefallen: Isolde→König · Varrik→König · König→Oskar
- Ressourcen: König `P1 G4 M1` · Isolde `—` · Oskar `G1 K1 M2` · Varrik `K6 M2 G1`

---

# Runde 6 (Sprecher: Varrik)
**Start:** Ruhe 7 · Wohlstand 10 · Öffentlicher Slot: Thronfolgefrage (Katastrophe)

## 1) Einkommen
- Isolde: +`P P` → `P2`
- Oskar: +`G G` +`G` (Zollmeister) +`M` (Baumeister) → aus `G1 K1 M2` wird `G4 K1 M3`
- Varrik: +`K K` +`M` → aus `K6 M2 G1` wird `K8 M3 G1`
- König: +Schatzkammer `G M M K` → aus `P1 G4 M1` wird `P1 G5 M3 K1`

## 2) Patronage
Der König braucht `3P 1G 1K`, hat aber nur `P1`.
- König gibt Isolde `1G` als „Zuckerbrot“, damit sie ihre `P` beisteuert.
- König behält `P1` und `K1`.

## 3) Öffentliche Krise (Katastrophe)
**Thronfolgefrage** (Katastrophe) – Kosten `3P 1G 1K` → Fehlschlag: **Usurpation sofort**, danach `Ruhe -1`
- König zahlt `P1 1G 1K`
- Isolde zahlt nur `1P` (hält `1P` zurück)

**Fehlschlag:** Es fehlt `1P` → **Usurpation wird ausgelöst**.

### Usurpation (ausgelöst durch Thronfolgefrage)
Alle decken Loyalität auf:
- Isolde: **Unloyal**
- Oskar: **Opportunist**
- Varrik: **Loyal**

Lager:
- Loyalisten: König + Varrik (+ Oskar entscheidet sich hier für Loyalisten, weil er keinen Sieg der Rebellen sieht)
- Rebellen: Isolde

Commit `P+K` (verdeckt):
- Loyalisten: Varrik `3K`, Oskar `1K`
- Rebellen: Isolde `1P`

**Aufdecken:** 4 vs 1 → Loyalisten gewinnen, König bleibt auf dem Thron.
Nachhall: `Ruhe -1` (7→6). Danach zusätzlicher Effekt der Karte: `Ruhe -1` (6→5). Karte wird abgeworfen.

## 4) Verdeckte Angelegenheit
Varrik zieht verdeckt: **Kirchenschisma** (Schwelen) – Kosten `1P 1G` / Fehlschlag `Ruhe -1`
- Nach der Usurpation ist **kein `P` mehr am Tisch** → Scheitern unvermeidlich.

**Fehlschlag:** Ruhe 5→4. Karte bleibt, eskaliert zu **Krise**.

## 5) Urteil & Intrige
Da eine Katastrophe scheiterte, untersucht der König (emotionaler Fehlgriff).
- Untersuchung: Ziel **Isolde**, Amt **Bischof**.
- Isolde kann nicht bestechen (`2G` fehlen) → `Audit`, zeigt `Korruption 0`.
- Fehlurteil: `Ruhe -1` (4→3). König schuldet Isolde `1 Gefallen` → `König→Isolde`.

**Intrigen**
- Isolde `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1`.
- Oskar gibt Isolde `1G` (Hedge) → durch `Haus Silbermark` entsteht `Isolde→Oskar` (Gefallen).
- Varrik „Gefallen handeln“: gibt König `2K`, dafür schuldet der König `1 Gefallen` → `König→Varrik` (Netzwerker: `Prestige +1`).

**Rundenende – Pflichten**
- Isolde (`Haus Morgenstein`): verlorene Usurpation als Angreiferin → gibt `Bischof` ab (statt `Korruption +2`).

**Ende Runde 6**
- Marker: Ruhe **3**, Wohlstand **10**
- Slots: Öffentlich leer · Verdeckt: **Kirchenschisma (Krise)**
- Prestige: König 6 · Isolde 3 · Oskar 2 · Varrik 4
- Korruption: König 0 · Isolde 1 · Oskar 3 · Varrik 1
- Ämter: Isolde nur noch `Reichskanzler`
- Gefallen: Isolde→König · Varrik→König · König→Oskar · König→Isolde · Isolde→Oskar · König→Varrik
- Ressourcen: König `G3 M3 K2` · Isolde `G1` · Oskar `G3 M3` · Varrik `K3 M3 G1`

---

# Runde 7 (Sprecher: Isolde)
**Start:** Ruhe 3 · Wohlstand 10 · Verdeckter Slot: Kirchenschisma (Krise)

> Es könnte jetzt eine „freie“ Usurpation ausgerufen werden (`Ruhe ≤3`), aber das würde `Ruhe -1` kosten und die offene Kirchenkrise gefährlich machen. Alle lassen es.

## 1) Einkommen
- Isolde: +`P` (nur Kanzler) → aus `G1` wird `P1 G1`
- Oskar: +`G G` +`G` (Zollmeister) +`M` (Baumeister) → aus `G3 M3` wird `G6 M4`
- Varrik: +`K K` +`M` → aus `K3 M3 G1` wird `K5 M4 G1`
- König: +Schatzkammer `P P G M` → aus `G3 M3 K2` wird `P2 G4 M4 K2`

## 2) Patronage
Kirchenschisma (Krise) braucht `3P 1G` – am Tisch gibt’s exakt `P3` (König `P2` + Isolde `P1`).
- König vergibt Amt aus Vorrat: `Bischof` an Varrik (ab Runde 8 mehr `P` und Ruhe‑Option).
- König gibt Isolde `1G` (damit sie ihr `P` nicht „aus Prinzip“ zurückhält).

## 3) Öffentliche Krise
Karte: **Verkauf von Kronland** (Gelegenheit) – Kosten `1P` → Effekt `Wohlstand +2`, aber `Ruhe -1`
- Bei `Ruhe 3` zu riskant → **nicht bezahlt**, Karte wird abgeworfen.

## 4) Verdeckte Angelegenheit
**Kirchenschisma** (Krise) – Kosten `3P 1G` → Erfolg `Ruhe +1` / Fehlschlag `Ruhe -2` (würde zum Kollaps führen)
- Oskar zahlt Isolde „unter der Hand“ `1G`, damit sie ihr `P` beiträgt.
  - Silbermark‑Effekt: neuer Gefallen `Isolde→Oskar` (es ist jetzt der **zweite**).
- Beiträge:
  - König: `2P` und `1G`
  - Isolde: `1P`

**Erfolg:** Ruhe 3→4. Slot wird leer.

## 5) Urteil & Intrige
Keine Untersuchung (nichts im Krise/Katastrophe‑Stadium gescheitert).

**Intrigen**
- Isolde löst `König→Isolde` ein (fordert 1 Ressource). König gibt `1M` (will keine Waffen geben). Gefallen wird abgeworfen.
- Oskar `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1` (3→4).
- Varrik löst `König→Varrik` ein → König gibt `1K`. (Gefallen wird abgeworfen.)

**Ende Runde 7**
- Marker: Ruhe **4**, Wohlstand **10**
- Slots: beide leer
- Prestige: König 6 · Isolde 3 · Oskar 3 · Varrik 4
- Korruption: König 0 · Isolde 1 · Oskar 4 · Varrik 1
- Gefallen: Isolde→König · Varrik→König · König→Oskar · Isolde→Oskar (x2)
- Ressourcen: König `G2 M3 K1` · Isolde `G3 M1` · Oskar `G4 M4` · Varrik `K6 M4 G1`

---

# Runde 8 (Sprecher: Oskar) – Finale
**Start:** Ruhe 4 · Wohlstand 10 · Slots leer

## 1) Einkommen
- Isolde: +`P` → `P1 G3 M1`
- Oskar: +`G G` +`G` (Zollmeister) +`M` (Baumeister) → aus `G4 M4` wird `G7 M5`
- Varrik: +`P` (Bischof) +`K K` +`M` → aus `K6 M4 G1` wird `P1 K8 M5 G1`
- König: +Schatzkammer `P G M K` → aus `G2 M3 K1` wird `P1 G3 M4 K2`

## 2) Patronage
König unterschätzt, dass Morgenstein bereits bei `Ruhe ≤4` usurpieren darf, und verteilt nur „normal“:
- König gibt Isolde `1G` (Beschwichtigung).

## 3) Usurpation‑Versuch (Haus Morgenstein, letztes Aufbäumen)
Isolde ruft Usurpation aus (erlaubt bei `Ruhe ≤4`).
- Lager sind klar (Loyalität ist seit Runde 6 offen):
  - Loyalisten: König + Varrik
  - Rebellen: Isolde
  - Oskar (Opportunist) bleibt bei den Loyalisten (will das Reich nicht in der letzten Runde gefährden).

Commit `P+K`:
- Rebellen: Isolde `1P`
- Loyalisten: Varrik `2K`, König `1K`

**Aufdecken:** 3 vs 1 → Loyalisten gewinnen. Nachhall: `Ruhe -1` (4→3). Slots wären eskaliert, sind aber leer.

**Morgenstein‑Pflicht:** Isolde verliert erneut als Angreiferin → nimmt `Korruption +2` (1→3).

## 4) Öffentliche Krise
Karte: **Pest im Hafen** (Krise) – Kosten `2P 1M 1G` → Erfolg `Ruhe +1`
Bei `Ruhe 3` wäre ein Fehlschlag (`Ruhe -2`) der **Kollaps**. Alle müssen liefern.
- König zahlt `1P 1G`
- Varrik zahlt `1P`
- Oskar zahlt `1M` (damit sein Baumeister triggert)

**Erfolg:** Ruhe 3→4. König erhält `Prestige +1`.
**Baumeister‑Trigger (Oskar):** weil er `M` beigesteuert hat: wählt `Prestige +1` und `Korruption +1` (4→5).

## 5) Verdeckte Angelegenheit
Oskar zieht verdeckt: **Königliche Hochzeit** (Gelegenheit) – Kosten `2G 1P`
Nach der Pest hat niemand mehr `P` → Hochzeit wird **nicht bezahlt**, Karte abgeworfen.

## 6) Letzte Intrigen
- Isolde `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1` (3→4). (Sie ist am Ende dennoch nicht wertungsberechtigt.)
- Oskar `Abzweigen`: `1G` → `Prestige +1`, `Korruption +1` (5→6).
- Varrik `Abzweigen`: `1K` → `Prestige +1`, `Korruption +1` (1→2).

---

# Spielende – Wertung
**Reich steht:** Ruhe 4 · Wohlstand 10

**Wertungsberechtigt (weil König Edric am Ende auf dem Thron sitzt):**
- König Edric (ursprünglicher Herrscher auf dem Thron)
- Varrik (Loyal)
- Oskar (Opportunist)
- Isolde (Unloyal) **nicht** wertungsberechtigt (keine erfolgreiche Usurpation, König regiert am Ende)

## Prestige‑Endstände
- **König Edric:** Basis `7` (inkl. Staatsräson‑Punkte) + Spielende‑Bonus `+3` = **10**
- **Oskar Silbermark:** Basis `5` + Agenda `Schatzhort` (`G6` am Ende → `+6`) = **11**
- **Varrik Nebelborn:** Basis `5` + Agenda‑Bonus `0` = **5**

**Gewinner:** **Oskar Silbermark** (Opportunist) mit **11 Prestige**.

---

## Kurze Beobachtungen (aus diesem Lauf)
- `P` ist in der Endphase knapp (Pest + Hochzeit in Folge fühlt sich wie „Ressourcen‑Schere“ an).
- Usurpation in einer Runde mit „hängender Krise“ ist extrem riskant (hier deshalb erst im Finale versucht).
- Investigation kann (realistisch) aus dem Bauch heraus passieren und die Lage weiter verschärfen (R6: Fehlurteil → `Ruhe` kippt).
