# Implementierungsstatus (Myranor Aufbausystem) – Engine `rulesVersion = v1`

Quelle der Regeln (Soll): `docs/rules/soll/aufbausystem.md` (+ Detailkatalog `docs/rules/soll/facilities.md`).

Dieses Dokument ist die **Coverage-/Abweichungsübersicht**: Was ist in der Engine **implementiert**, was ist **teilweise** umgesetzt, und was fehlt – damit Playtests belastbar auswertbar sind.

## Legende

- ✅ Implementiert (Engine verhält sich regeltextnah)
- 🟡 Teilweise implementiert (vereinfachter Scope oder nur Teil-Effekte)
- ❌ Nicht implementiert
- 🧩 Interpretation (Regeltext unklar → Entscheidung dokumentiert)

## Scope (v1)

- ✅ Kernsystem: Phasenmodell, Markt, Ereignis-Abschnitte (4 Runden), Aktionen 1–4 & 6
- ✅ Politische Schritte (v1-light): `KW/AS/N`, `Information`, Neider-Gegenreaktionen
- ✅ Loyalität v1: `LO 0–6`, Aufruhr/Abwanderung, LO-Proben (d6 under)
- ✅ Fachkräfte v1: Anwerben-Check + Tabellen + Trait-Effekte (v1-Interpretation)
- ✅ Produktions-Caps v1: Werkstätten/Lager sind separat an Domänen-/Stadtbesitz-Größe gebunden (City: keine Facility-Slots, nur Produktions-Caps)
- 🟡 Langzeitvorhaben (Bauzeit) v1: `BuildFacility` kann Projekte starten; Fortschritt kostet AK/ZK im Maintenance, Abschluss erzeugt Facility (v1: u.a. `general.medium.city.insulae`)
- 🟡 Privatbastionen (v1-light): `location.kind=personal` + eigener Slot-Pool (max 6) für „persönliche Einrichtungen“; jede persönliche Einrichtung erhöht das Fachkräfte-Cap um `+1` und gibt (wie andere Facilities) Einfluss/Runde.
- ❌ „Das Erste Lager“ (Nomisma/Nahrung/Tiere/Oktrale etc. als eigenes System) – nicht als eigener Ressourcenblock modelliert

## Canonical Docs (v1)

- Implementierte Regeln: `docs/rules/rules-v1.md`
- Tabellen/Listen:
  - Events: `docs/rules/tables/events.md`
  - Markt: `docs/rules/tables/market.md`
  - Materialien: `docs/rules/tables/materials.md`
  - Facilities (v1): `docs/rules/facilities/catalog.md`
- Soll-Änderungen (Change Docs): `docs/rules/soll/changes/README.md`

## Code-Orte (v1)

- Engine/Reducer: `src/core/engine/engine.ts`
- Commands: `src/core/commands/types.ts`
- State/Types: `src/core/domain/types.ts`
- Defaults/Basiswerte: `src/core/rules/v1.ts`
- Materialkatalog: `src/core/rules/materials_v1.ts`
- Markt: `src/core/rules/market_v1.ts`
- Ereignisse: `src/core/rules/eventTable_v1.ts`, `src/core/rules/events_v1.ts`

## Startbedingungen (v1)

- ✅ Startgold: `4`
- ✅ Startchecks: `influence=3`, `money=3`, `materials=3`
- ✅ Starter-Domäne (`tier=starter`): Ertrag `2 AK` + `8 RM` (Default: `rawPicks=[raw.grain]`)
- ✅ 2 permanente Arbeitskraft (`holdings.permanentLabor = 2`)
- ✅ Start-Werkstatt (`workshop-starter`) auf Starter-Domäne (zählt nicht gegen Domänen-Slots)
- ✅ Start-Lager (`storage-starter`) auf Starter-Domäne (zählt nicht gegen Domänen-Slots)
- ✅ Start-Stadtbesitz klein, verpachtet (`city-starter`, `mode=leased`, `tenure=owned`)
- ✅ Start-Amt klein (`office-starter`, `yieldMode=influence`)

## Rundenablauf / Phasen (v1)

- ✅ Phasenmodell: `maintenance → actions → conversion → reset`
- ✅ Markt-Abschnitt: 4 Runden (R1–R4, R5–R8, …)
- ✅ Ereignis-Abschnitt: 4 Runden, Start ab Runde 2 (R2–R5, R6–R9, …)
- ✅ In `maintenance → actions`:
  - Markt-Roll (Abschnittsstart)
  - Event-Roll (Abschnittsstart)
  - Neider-Gegenreaktion (wenn `N>=3/6/9`)
  - Income/Upkeep wird angewandt

## Ressourcenmodell (v1)

- ✅ Gold (+ `pending.gold`)
- ✅ Information (persistent; v1 nutzt sie in Politischen Schritten)
- ✅ Pools pro Runde: Arbeitskraft (`AK`) + Einfluss
- ✅ Inventar: typed RM/SM (`materialId → count`)
- ✅ Politik-Tracker: `KW/AS/N`
- ✅ Truppen / Follower / Fachkräfte als eigene Holdings

## Unterhalt (v1)

- ✅ Unterhalt wird ab Runde 2 berechnet
- ✅ Viele Posten bleiben auch bei negativem Goldstand aktiv (Gold kann negativ werden)
- ✅ Werkstätten/Lager sind nur aktiv, wenn sie in der Runde unterhalten werden können (Labor/Gold reichen)
- ✅ Handelsunternehmungen-Unterhalt (v1): `small/medium/large = (2G+1AK) / (5G+2AK) / (6G+4AK)`
- ✅ Amtseinrichtung `general.medium.office.administrativeReforms`: Build-Regeln (ab mittlerem Amt, mind. 2 Ämter, 1×/Spieler), Unterhalt `2 Gold/Runde`, schaltet `yieldMode=split` frei (kein zusätzlicher Facility‑Einfluss/Runde)
- ✅ Allgemeiner Unterhalt (pro Runde):
  - `ceil(AK/4)` + `ceil(offene KK/2)` + `Follower-Level` Nahrungseinheiten
  - wird aus `food`-getaggten RM/SM bezahlt; Rest wird als Gold-Unterhalt abgerechnet
- ✅ Sonderfall Event 2 (Hungersnot): Fütterung wird separat geprüft; bei Mangel `LO -2`

## Loyalität / Anhänger / Klienten / Pächter (v1)

- ✅ Modell: `FollowersState = { levels, loyalty, inUnrest }` an Domäne/Stadt/Organisation
- ✅ LO-Skala: `0–6` (Cap 6)
- ✅ LO-Probe (wenn gefordert): `1w6`, Erfolg bei `Wurf <= LO`
- ✅ Erträge (wenn Gruppe „aktiv“ / nicht in Unruhe):
  - +1 AK je Stufe (über Basispool)
  - +1 Gold je Stufe (Maintenance)
  - Domänen zusätzlich: `+2` billige RM je Pächterstufe (aus Domänenproduktion; v1: best-effort Mapping)
- ✅ Unruhe/Alternieren:
  - LO `>= 3`: immer aktiv
  - LO `1–2`: Erträge nur jede zweite Runde (via `inUnrest` Toggle)
  - LO `<= 0`: in Unruhe (keine Erträge)
- ✅ Abwanderung (Soll): nur bei LO `<= 0` verliert die Gruppe `-1` Stufe pro Runde

## Fachkräfte (v1)

- ✅ `HireSpecialist` vorhanden (Kosten/Unterhalt, Cap, Check DC 10 + Tiermod)
- ✅ 2w6-Rekrutierungstabelle + 1w20-Charaktertabelle sind umgesetzt:
  - Kostenanpassungen, LO-Setzung (Cap 6), Trait-Roll
  - Sonderfälle: „Prestige“ (+2 Einfluss/Runde), „Lehrling“, Auto-Promotion (nach 4 Runden), Trait-Multiplikatoren (Roll 10/12), „Gelehrt“ (Zweitbereich)
- ✅ Trait-Effekte (v1-Interpretation) sind mechanisch umgesetzt (DC/Unterhalt/Income/Refinement/Defense/LO-Nebeneffekte)

## Politische Schritte / Information / Konsequenzen (v1)

- ✅ `PoliticalSteps` (damageDefend/manipulate/loyaltySecure/convertInformation)
- ✅ `Information` ist persistent; `convertInformation` implementiert (`1 Info → 2 Gold` oder `4 Einfluss`)
- ✅ `KW` beeinflusst DC (Stufenmodell), `AS` beeinflusst Acquire/DCs, `N` triggert Gegenreaktionen
- ✅ Passive Erholung: wenn keine Politischen Schritte in einer Runde, dann `KW-1` und `N-1` (min 0)
- ✅ Spielerwahl „Gold oder Einfluss“ bei Gegenreaktionen ist abgebildet (Command `SetCounterReactionLossChoice`; Playtests setzen heuristisch)

## Markt (v1)

- ✅ Markt-Rolls alle 4 Runden pro Marktinstanz (2d6 Roh + 2d6 SM)
- ✅ Kauf nutzt Marktmodifikatoren als Kostenaufschlag (gefragte Ware ist teurer; Gold-Boni werden zu Zusatzkosten)
- ✅ Handelsunternehmungen erzeugen zusätzliche private Marktinstanzen (auch wenn `mode=produce`; solange nicht beschädigt)
  - ✅ City-Produktions-Caps: `small: 2×small oder 1×medium`, `medium: 1×small+1×medium`, `large: 1×large+1×medium`

## Ereignisse (v1)

- ✅ Abschnitte: 4 Runden; ab Runde 2 werden pro Abschnitt 2 Events gerollt
- 🟡 Eventtexte sind in `eventTable_v1.ts`/`docs/rules/tables/events.md` dokumentiert; einzelne Effekte sind in der Engine teils vereinfacht

## Visibility / Logs

- ✅ Alle Events haben `visibility` (public vs private pro Player)
- ✅ `PublicLogEntryAdded` existiert; Simulation kann es unterdrücken (`emitPublicLogs: false`)
