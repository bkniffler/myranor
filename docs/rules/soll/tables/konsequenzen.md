# Konsequenzen, Ansehen & Neider (Soll)

Status: Soll (v1; initiale, spielbare Mechanik).

Ziel: Eskalierende Konsequenzen und Gegenreaktionen für politische Spielzüge modellieren, ohne ein vollwertiges „Fraktions‑Minigame“ zu benötigen.

## Scope (Soll)

- Werte werden **pro Spieler** geführt (global; **nicht** pro Fraktion).
- Alle Werte sind **persistent** (bleiben von Runde zu Runde erhalten).

Startwerte (Runde 1):
- Konsequenzenwert `KW = 0`
- Ansehen `AS = 0`
- Neider `N = 0`

Caps:
- `AS` ist auf `-6 … +6` gedeckelt.
- `KW` und `N` haben keinen harten Cap (praktisch durch Spiel-/Event‑Druck begrenzt).

## Passive Erholung (Soll)

Wenn ein Spieler in einer Runde **keine** Aktion „Politische Schritte“ ausführt:
- `KW -1` (min. `0`)
- `N -1` (min. `0`)
- `AS` bleibt unverändert

## Konsequenzenwert (KW) — Schwellenwerte & Effekte (Soll)

`KW` ist der „Heat“‑Wert: je höher, desto schwerer werden politische Aktionen (und desto eher eskaliert die Lage).

| KW | Stufe | Effekt (v1) |
| --- | --- | --- |
| 0–3 | Ruhig | keine Zusatz‑Effekte |
| 4–7 | Aufmerksamkeit | Politische Schritte: `+1 DC` |
| 8–11 | Untersuchung | Politische Schritte: `+2 DC` |
| 12–15 | Gegenschlag | Politische Schritte: `+3 DC` |
| 16+ | Offene Feindschaft | Politische Schritte: `+4 DC` |

Hinweise:
- DC‑Erhöhungen durch `KW` sind **zusätzlich** zu Investitions‑Modifikatoren.
- DC‑Senkungen bleiben global auf max. `-4` gedeckelt (siehe `docs/rules/soll/aufbausystem.md`).

## Ansehen (AS) — Schwellenwerte & Effekte (Soll)

`AS` ist der öffentliche Ruf/Status (positiv oder negativ).

| AS | Stufe | Effekt (v1) |
| --- | --- | --- |
| -6 … -4 | Verrufen | Einflussgewinn & Posten gewinnen: `+2 DC` |
| -3 … -2 | Misstrauisch beäugt | Einflussgewinn & Posten gewinnen: `+1 DC` |
| -1 … +1 | Neutral | keine Zusatz‑Effekte |
| +2 … +3 | Angesehen | Einflussgewinn & Posten gewinnen: `-1 DC` (zählt gegen den globalen `-4` DC‑Senkungs‑Cap) |
| +4 … +6 | Hochangesehen | Einflussgewinn & Posten gewinnen: `-2 DC` (zählt gegen den globalen `-4` DC‑Senkungs‑Cap) |

## Neider (N) — Trigger & Gegenreaktionen (Soll)

`N` ist der Gegenreaktions‑Zähler: je höher, desto wahrscheinlicher/gefährlicher werden Intrigen/Attentate/Gegenmaßnahmen.

Abwicklung (Soll):
- Wenn am Ende einer Runde `N` eine Schwelle erreicht, wird in der **nächsten Ereignisphase** eine Gegenreaktion ausgelöst.
- Nach Abwicklung sinkt `N` um den Schwellenwert (Rest bleibt bestehen).

Gegenreaktionen nutzen eine **Verteidigungsprobe** (siehe Definition in `docs/rules/soll/facilities.md`).

| N (Schwelle) | Gegenreaktion | Verteidigungsprobe | Effekt bei Fehlschlag |
| --- | --- | --- | --- |
| `>= 3` | Gerüchte / kleine Intrige | DC `10` | verliere **wahlweise** `-4 Gold` **oder** `-4 Einfluss`; zusätzlich `AS -1` |
| `>= 6` | Intrige / Ermittlungen | DC `12` | verliere **wahlweise** `-8 Gold` **oder** `-8 Einfluss`; zusätzlich `KW +2` und `AS -1` |
| `>= 9` | Attentat / harter Gegenschlag | DC `14` | verliere **wahlweise** `-12 Gold` **oder** `-12 Einfluss`; zusätzlich `KW +4` und `AS -2` |

Hinweise:
- „Wahlweise“ bedeutet: der Spieler entscheidet bei Eintritt des Effekts.
- Wenn mehrere Schwellen erfüllt sind (z.B. `N >= 9`), wird **nur die höchste** Gegenreaktion ausgelöst, und `N` wird entsprechend reduziert.
