# Kronrat – Playtest‑Paket v0.1 (Kartenlisten)

Dieses Paket ist ein „kleines, spielbares Set“, um `final_concept.md` schnell zu testen.

## Notation
- Ressourcen: `P` = Politik, `K` = Kampf, `G` = Geld, `M` = Material
- `Prestige` ist ein Tokenpool (Zahlen sind bewusst klein gehalten).
- `Gefallen`: Marker ist **gerichtet** (Schuldner → Gläubiger).

## Mini‑Klarstellungen für den Test
- **Beigesteuerte Ressourcen sind immer ausgegeben** (egal ob Erfolg oder Fehlschlag).
- **Öffentliche Krise:** Beiträge offen. **Verdeckte Angelegenheit:** Beiträge verdeckt gleichzeitig legen, dann aufdecken.
- Bei **Schwierigkeiten** gilt: Wird die Stufe nicht bezahlt → **Effekt ausführen** und die Karte **eskaliert** (Schwelen→Krise→Katastrophe). Bei `Katastrophe` bleibt sie auf Katastrophe, bis sie gelöst ist oder das Reich fällt.
- Bei **Gelegenheiten** gilt: Bezahlen → Effekt, sonst Karte abwerfen.
- Bei Effekten wie „meiste `K`“ gilt: **Gleichstand = alle Gleichstehenden** erhalten den Bonus.
- **Staatsräson (für den Herrscher):** Wenn das Ereignis im **offenen Slot** erfolgreich gelöst wird → `Prestige +1`. Spielende: Wenn das Reich nicht kollabiert und der Herrscher am Ende den Thron hält → `Prestige +3`.

---

## Dynastien / Beraterrollen (8)
Jede Dynastie hat **1 Vorteil** und **1 Verbindlichkeit**. Empfehlung für den ersten Test: **offen auslegen**.

1) **Haus Falkenfels** (Kriegskasse & Grenzreiter)
   - Vorteil: 1×/Runde darfst du 1 `K` als 1 `M` zählen (Logistik/Belagerungsgerät).
   - Verbindlichkeit: Wenn eine Schwierigkeit scheitert und du **0 Ressourcen** beigesteuert hast → `Korruption +1`.

2) **Haus Silbermark** (Bankiers der Marktstadt)
   - Vorteil: 1×/Runde: Wenn du einem Spieler **`G` gibst**, erhältst du von ihm 1 `Gefallen`.
   - Verbindlichkeit: Am Rundenende musst du **mindestens 1 `G`** besitzen oder `Korruption +1`.

3) **Haus Dornkirch** (Eiferer der alten Lehre)
   - Vorteil: 1×/Runde: Zahle 1 `P` → entferne 1 `Korruption` von dir (oder von einem anderen Spieler; dann schuldet er dir 1 `Gefallen`).
   - Verbindlichkeit: Wenn `Ruhe ≤ 4` und du diese Runde **keine `P`** zu einem Ereignis beigesteuert hast → `Korruption +1`.

4) **Haus Nebelborn** (Flüsterer und Kundschafter)
   - Vorteil: 1×/Runde: Sieh dir die oberste Karte des Ereignisstapels an; du darfst sie **oben lassen** oder **unter den Stapel legen**.
   - Verbindlichkeit: Wenn du am Rundenende **keinen Gefallen** hast (weder schuldest du noch wird dir geschuldet) → `Korruption +1`.

5) **Haus Eisenhain** (Holz, Stein und Handwerk)
   - Vorteil: Wenn ein Ereignis erfolgreich gelöst wird und du **mindestens 1 `M`** beigesteuert hast → `Prestige +1` (max 1× pro Ereignis).
   - Verbindlichkeit: Wenn du in einer Runde **kein `M`** zu einem Ereignis beigesteuert hast → `Korruption +1`.

6) **Haus Rosenbruck** (Diplomaten und Heiratsvermittler)
   - Vorteil: 1×/Runde: Wenn du einen `Gefallen` **erfüllst** oder **einlöst**, erhalte 1 Ressource deiner Wahl aus dem Vorrat.
   - Verbindlichkeit: Wenn in einer Runde **kein Gefallen entsteht oder eingelöst wird, an dem du beteiligt bist** (du gibst oder erhältst keinen) → `Prestige -1`.

7) **Haus Sturmwacht** (Wächter der Nordpässe)
   - Vorteil: Bei Ereignissen mit Tag `Krieg` zählt dein **erstes beigesteuertes `K` doppelt** (2 `K` statt 1).
   - Verbindlichkeit: Wenn ein `Krieg`‑Ereignis in dieser Runde scheitert und du **0 `K`** beigesteuert hast → `Korruption +1`.

8) **Haus Morgenstein** (Thronanspruch & alte Blutlinie)
   - Vorteil: Du darfst `Usurpation` bereits ausrufen, wenn `Ruhe ≤ 4` (statt ≤3).
   - Verbindlichkeit: Wenn eine Usurpation scheitert und du auf der **angreifenden** Seite warst → wähle: `Korruption +2` **oder** gib 1 Amt ab.

---

## Ämter (10)
Ämter liegen offen aus. Jedes Amt gibt **1 Ressource pro Runde** (in Phase „Einkommen“) und eine einfache Sonderfähigkeit.

1) **Bischof**
   - Einkommen: `P`
   - Fähigkeit: 1×/Runde: Zahle 1 `G` → `Ruhe +1`.

2) **Reichskanzler**
   - Einkommen: `P`
   - Fähigkeit: Beim verdeckten Ereignis darfst du dem Sprecher **eine Ja/Nein‑Frage** stellen; er muss **wahr** antworten.

3) **Reichsschatzmeister**
   - Einkommen: `G`
   - Fähigkeit: 1×/Runde: Tausche 1 eigene Ressource gegen 1 `G`. Danach wähle: `Korruption +1` **oder** `Wohlstand -1`.

4) **Reichsmarschall**
   - Einkommen: `K`
   - Fähigkeit: 1×/Runde: Wenn du zu einem Ereignis beiträgst, darfst du 1 `K` als 1 `P` zählen. Danach `Korruption +1`.

5) **Großkämmerer**
   - Einkommen: `G`
   - Fähigkeit: 1×/Runde in der Patronage‑Phase: Wenn du vom Herrscher eine Ressource erhältst, nimm zusätzlich 1 Ressource **gleichen Typs** aus dem Vorrat. Danach `Korruption +1`.

6) **Truchsess (Seneschall)**
   - Einkommen: `M`
   - Fähigkeit: 1×/Runde nach dem Aufdecken eines Ereignisses, bevor geprüft wird: Tausche **1 Token** aus dem Beitrags‑Pool gegen **1 Token** aus deinem Vorrat.

7) **Baumeister des Reiches**
   - Einkommen: `M`
   - Fähigkeit: 1×/Runde: Wenn eine Schwierigkeit erfolgreich gelöst wird und du mindestens 1 `M` beigesteuert hast, wähle:
     - Nimm 1 `M` zurück in deinen Vorrat (Rückerstattung) **oder**
     - nimm `Prestige +1` und `Korruption +1`.

8) **Zollmeister**
   - Einkommen: `G`
   - Fähigkeit: Am Ende deiner Einkommen‑Phase: Nimm 1 `G` aus dem Vorrat. Wenn `Wohlstand ≤ 4` → zusätzlich `Korruption +1`.

9) **Reichsrichter**
   - Einkommen: `P`
   - Fähigkeit: 1×/Runde: Wenn durch `Anschwärzen` jemand `Korruption` erhalten würde, darfst du 1 `P` zahlen. Dann erhält stattdessen der Anschwärzer die `Korruption`.

10) **Burggraf**
   - Einkommen: `K`
   - Fähigkeit: 1×/Runde: Wenn eine Schwierigkeit scheitert, darfst du 1 `K` zahlen, um den Marker‑Verlust um 1 zu reduzieren (min. 0).

---

## Agenden / Ambitionen (12)
Jeder Berater erhält 1 Agenda verdeckt. `Prestige` darf auch negativ werden.

1) **Friedensstifter**
   - Wenn du zu einem Ereignis beiträgst, das `Ruhe` erhöht → `Prestige +1` (max 1×/Runde).
   - Spielende: Wenn `Ruhe ≥ 7` → `Prestige +2`.

2) **Wohlstandsbauer**
   - Wenn du zu einem Ereignis beiträgst, das `Wohlstand` erhöht → `Prestige +1` (max 1×/Runde).
   - Spielende: Wenn `Wohlstand ≥ 7` → `Prestige +2`.

3) **Kriegsruhm**
   - Wenn ein `Krieg`‑Ereignis erfolgreich gelöst wird und du die meiste `K` beigesteuert hast → `Prestige +2`.

4) **Baumeisterstolz**
   - Wenn eine Schwierigkeit erfolgreich gelöst wird und du mindestens **2 `M`** beigesteuert hast → `Prestige +2` (max 1×/Runde).

5) **Günstling der Krone**
   - Wenn du in der Patronage‑Phase **mindestens 2 Ressourcen** vom Herrscher erhältst → `Prestige +2` (max 1×/Runde).

6) **Netzwerker**
   - Wenn dir ein Spieler einen `Gefallen` schuldet (neuer Gefallen entsteht) → `Prestige +1` (max 1×/Runde).
   - Spielende: Wenn dir **3+ Gefallen** geschuldet werden → `Prestige +3`.

7) **Ankläger**
   - Wenn du `Anschwärzen` nutzt → `Prestige +1` (max 1×/Runde).
   - Wenn das Ziel in derselben Runde durch eine Untersuchung ein Amt verliert → zusätzlich `Prestige +2` (max 1× pro Spiel).

8) **Saubere Hände**
   - Spielende: Wenn du **0 Korruption** hast → `Prestige +6`.
   - Wenn du Korruption von dir entfernst → `Prestige +1` (max 3× pro Spiel).

9) **Schwarze Kasse**
   - Wenn du `Korruption` erhältst → `Prestige +1` (max 1×/Runde).
   - Spielende: Wenn du **4+ Korruption** hast → `Prestige +3`.

10) **Ämtersammler**
   - Sobald du zum ersten Mal **3 Ämter gleichzeitig** besitzt → `Prestige +4`.
   - Spielende: Wenn du **4+ Ämter** besitzt → `Prestige +2`.

11) **Königsmacher**
   - Wenn eine Usurpation stattfindet und du auf der **siegreichen Seite** warst → `Prestige +3` (max 1× pro Spiel).

12) **Schatzhort**
   - Spielende: `Prestige +1` pro `G` in deinem Vorrat (max +6).

---

## Ereignisse (12)
`Tags` helfen bei Agenda‑Effekten (`Krieg` etc.). Bei Gelegenheiten ist der **Gastgeber** der Ziehende (Herrscher im offenen Slot, Sprecher im verdeckten Slot).

### Schwierigkeiten (8)
1) **Grenzkrieg an den Pässen** (`Krieg`)
   - Verdächtige Ämter (für Anschuldigungen): Reichsmarschall, Burggraf, Reichsschatzmeister
   - Schwelen: Bedarf `1K 1G` → Erfolg: — / Fehlschlag: `Ruhe -1`
   - Krise: Bedarf `2K 1M 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -2`
   - Katastrophe: Bedarf `3K 2G 1P` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -3` und `Wohlstand -1`

2) **Bauernaufstand** (`Volk`)
   - Verdächtige Ämter: Bischof, Reichskanzler, Reichsrichter
   - Schwelen: Bedarf `1P 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -1`
   - Krise: Bedarf `2P 1K 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -2` und `Wohlstand -1`
   - Katastrophe: Bedarf `2P 2K 1G 1M` → Erfolg: `Ruhe +2` / Fehlschlag: `Ruhe -3`

3) **Missernte** (`Hunger`)
   - Verdächtige Ämter: Reichsschatzmeister, Zollmeister, Truchsess
   - Schwelen: Bedarf `1M 1G` → Erfolg: `Wohlstand +1` / Fehlschlag: `Wohlstand -1`
   - Krise: Bedarf `2M 2G 1P` → Erfolg: `Wohlstand +1` / Fehlschlag: `Wohlstand -2` und `Ruhe -1`
   - Katastrophe: Bedarf `3M 2G 2P` → Erfolg: `Wohlstand +2` / Fehlschlag: `Wohlstand -3` und `Ruhe -1`

4) **Pest im Hafen** (`Seuche`)
   - Verdächtige Ämter: Truchsess, Baumeister, Zollmeister
   - Schwelen: Bedarf `1P 1G` → Erfolg: — / Fehlschlag: `Ruhe -1`
   - Krise: Bedarf `2P 1M 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -2` und `Wohlstand -1`
   - Katastrophe: Bedarf `3P 2M 1G` → Erfolg: `Ruhe +1` und `Wohlstand +1` / Fehlschlag: **Reich fällt sofort**

5) **Kirchenschisma** (`Kirche`)
   - Verdächtige Ämter: Bischof, Reichskanzler
   - Schwelen: Bedarf `1P 1G` → Erfolg: — / Fehlschlag: `Ruhe -1`
   - Krise: Bedarf `3P 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -2`
   - Katastrophe: Bedarf `4P 1G 1K` → Erfolg: `Ruhe +2` / Fehlschlag: `Ruhe -3` und **alle Spieler** `Korruption +1`

6) **Handelsblockade** (`Handel`)
   - Verdächtige Ämter: Zollmeister, Reichsschatzmeister, Reichskanzler
   - Schwelen: Bedarf `1P 1G` → Erfolg: — / Fehlschlag: `Wohlstand -1`
   - Krise: Bedarf `2P 2G` → Erfolg: `Wohlstand +1` / Fehlschlag: `Wohlstand -2`
   - Katastrophe: Bedarf `2P 3G 1K` → Erfolg: `Wohlstand +2` / Fehlschlag: `Wohlstand -3` und `Ruhe -1`

7) **Brand in der Königsburg** (`Hof`)
   - Verdächtige Ämter: Baumeister, Truchsess, Großkämmerer
   - Schwelen: Bedarf `1M 1G` → Erfolg: — / Fehlschlag: `Wohlstand -1`
   - Krise: Bedarf `2M 1G 1P` → Erfolg: `Wohlstand +1` / Fehlschlag: `Wohlstand -2` und `Ruhe -1`
   - Katastrophe: Bedarf `4M 2G` → Erfolg: `Wohlstand +1` und `Ruhe +1` / Fehlschlag: `Wohlstand -3` und `Ruhe -2`

8) **Thronfolgefrage** (`Hof`)
   - Verdächtige Ämter: Reichskanzler, Reichsrichter, (Dynastie) Morgenstein
   - Schwelen: Bedarf `1P` → Erfolg: — / Fehlschlag: `Ruhe -1`
   - Krise: Bedarf `2P 1G` → Erfolg: `Ruhe +1` / Fehlschlag: `Ruhe -2`
   - Katastrophe: Bedarf `3P 1G 1K` → Erfolg: `Ruhe +2` / Fehlschlag: **Usurpation sofort auslösen**, danach zusätzlich `Ruhe -1`

### Gelegenheiten (4)
9) **Königliche Hochzeit** (`Hof`)
   - Kosten: `2G 1P`
   - Effekt: `Ruhe +2`; Gastgeber erhält `Prestige +2` und nimmt 1 `Gefallen` von einem beliebigen Spieler (dieser Spieler schuldet dem Gastgeber).

10) **Turnier der Banner** (`Krieg`)
   - Kosten: `1K 1G`
   - Effekt: `Ruhe +1`; Spieler mit dem meisten beigesteuerten `K` erhält `Prestige +2` (bei Gleichstand alle).

11) **Marktprivileg** (`Handel`)
   - Kosten: `1P 1M`
   - Effekt: `Wohlstand +2`; Gastgeber wählt: `Korruption +1` **oder** er gibt einem anderen Spieler 1 `Gefallen` (er schuldet ihn).

12) **Verkauf von Kronland** (`Wirtschaft`)
   - Kosten: `1P`
   - Effekt: `Wohlstand +2`, aber `Ruhe -1`; Gastgeber nimmt `Korruption +1`.
