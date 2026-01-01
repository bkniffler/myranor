# Einrichtungen & Spezialisierungen (Soll) — Katalog

Status: canonical (Soll)

Dieses Dokument ist die **Source of Truth** für die detaillierten Regeln zu:
- Einrichtungen (allgemein/besonders),
- Werkstätten & Lager (Caps, Betrieb, Umwandlung),
- Pächter/Anhänger/Klienten/Untertanen,
- Fachkräften, Beratern und Handlangern,
- sowie (später) Pylonennetz & Zauberkraft‑Infrastruktur.

Es ergänzt `docs/rules/soll/aufbausystem.md`.

## Begriffe & Konventionen

- **Einrichtung**: eine Modifikation innerhalb eines Postens (Domäne, Stadtbesitz, Amt, Orga, Handelsunternehmung, Truppen).
- **Allgemeine Einrichtung**: “Standard”-Einrichtung eines Postens (zählt auf allgemeine Slot-Caps).
- **Besondere Einrichtung**: spezielle Einrichtungstypen mit eigenen Regeln/Caps (z.B. Werkstatt, Lager).
- **Spezialisierung**: ändert/erweitert Produktionsarten und schaltet besondere Einrichtungen frei (Details je Posten).
- Für Formeln/Skalierungen gilt (wenn nicht anders angegeben): **Tierwert** klein=1, mittel=2, groß=3.

Format einer Einrichtung (Soll):
- **Kosten** (einmalig) und ggf. **Bauzeit** (in Baurunden)
- **Unterhalt** (pro Runde; ab Runde 2 in der Unterhaltsphase)
- **Cap/Prereqs** (Slots, Tier, Host, Voraussetzungen)
- **Effekte** (Ertrag, DC‑Modifikatoren, Markt‑Modifikatoren, Bonusaktionen, Umwandlung)

## Verteidigungsproben (Soll)

Bestimmte Ereignisse, Angriffe oder politische Aktionen können eine **Verteidigungsprobe** gegen einen Posten auslösen (Domäne, Stadtbesitz, Amt, Organisation, Handelsunternehmung, Truppen).

- Standard‑DC: **10** (wenn das auslösende Element nichts anderes sagt).
- Wurf: `1w20 + Attributsmodifikator` (wie in `docs/rules/soll/aufbausystem.md`).
- Modifikatoren: Boni/Mali aus Einrichtungen, Truppen, Ereignissen und Situationen werden addiert.
- Erfolgsstufen: verwenden die allgemeine Erfolgsskala aus `docs/rules/soll/aufbausystem.md`; die konkrete Auswirkung ist beim jeweiligen Ereignis/Angriff definiert.

## Besondere Einrichtungen: Werkstätten & Warenlager

### Platz-/Tier‑Kopplung (Caps)

Diese Einrichtungen sind strikt an **Domänen** oder **Stadtbesitz in Eigenproduktion** gekoppelt (Host‑Cap).

**Domänen (belegen Einrichtungsplätze der Domäne):**
- Kleine Domäne: **1× klein** (Werkstatt **oder** Lager)
- Mittlere Domäne: **1× mittel** (Werkstatt **oder** Lager)
- Große Domäne: **1× klein + 1× mittel** (jeweils Werkstatt **oder** Lager)

**Stadtbesitz (Eigenproduktion; belegen keine Einrichtungsplätze des Stadtbesitzes):**
- Kleiner Besitz: **2× klein** oder **1× mittel**
- Mittlerer Besitz: **1× klein + 1× mittel**
- Großer Besitz: **1× groß + 1× mittel**

> Startpaket‑Ausnahme: Startdomäne hat 1× kleine Werkstatt + 1× kleines Lager, beide slotfrei (siehe `docs/rules/soll/aufbausystem.md`).

### Produktion/Umwandlung (Grundregel)

- Bei Bau wird festgelegt, **welche RM‑Art** in **welche passende SM‑Art** umgewandelt wird.
- Initial gilt: **1 RM‑Art → 1 SM‑Art** (keine “Multi‑Input/Multi‑Output”‑Werkstatt ohne Spezialisierung).
- Umwandlung läuft **automatisch** in der Umwandlungsphase, sofern Unterhalt gezahlt wurde.

### Werkstätten

#### Kleine Werkstatt
- Funktion: wandelt bis zu **8 RM → 2 SM** (4:1) um
- Alternative: wandelt bis zu **8 RM → 8 verbesserte RM** (1:1) um
- Unterhalt: **1 AK**

#### Mittlere Werkstatt
- Funktion: wandelt bis zu **12 RM → 3 SM** (4:1) um
- Alternative: wandelt bis zu **12 RM → 12 verbesserte RM** (1:1) um
- Unterhalt: **2 AK + 1 Gold**
- Vorteil: **+1 SM** wird automatisch zusätzlich produziert

#### Große Werkstatt
- Funktion: wandelt bis zu **24 RM → 6 SM** (4:1) um
- Alternative: wandelt bis zu **24 RM → 24 verbesserte RM** (1:1) um
- Unterhalt: **4 AK + 3 Gold**
- Vorteil: **+2 SM** wird automatisch zusätzlich produziert

### Warenlager

#### Kleines Lager
- Funktion: lagert **15 RM** und **5 SM**
- Unterhalt: **1 AK**

#### Mittleres Lager
- Funktion: lagert **25 RM** und **10 SM**
- Unterhalt: **2 AK**

#### Großes Lager
- Funktion: lagert **40 RM** und **15 SM**
- Unterhalt: **3 AK**

### Veredlung / Verbesserte Rohmaterialien (Soll)

- Werkstätten können (statt RM→SM) RM in **verbesserte RM** (1:1) umwandeln.
- Verbesserte RM haben **eigene Material‑IDs** (separate Einträge im Materialkatalog).
- Materialkatalog (Soll): `docs/rules/soll/tables/materials.md`
- Hauptauswirkung der Veredelung ist der **Verkaufsbonus** (`saleBonusGold`), der im Materialeintrag angegeben ist.
  - Der Verkaufsbonus wird beim Verkauf (Aktion **oder** Autoverkauf) pro **4 Einheiten** angerechnet.

## Pächter, Anhänger, Untertanen (Soll)

Pächter/Anhänger/Klienten sind eine **Sondereinrichtung** von Domänen, Kulten, städtischen Einrichtungen und Circeln.

### Pächterstufen (Domänen)

- 1 Stufe = **250** Personen.
- Effekt pro Pächterstufe:
  - `+1 AK` (pro Runde)
  - `+1 Gold` (pro Runde)
  - zusätzlich auf Domänen: `+2 billige RM` (aus der bereits gewählten Domänen‑Produktion; wenn keine billige RM gewählt wurde: passend zur Spezialisierung)
- Unterhalt (pro Stufe, pro Runde): **1 RM (Nahrung; Preisklasse beliebig)**; wenn nicht verfügbar: **1 Gold**
- Caps:
  - kleine Domäne: max **2**
  - mittlere Domäne: max **4**
  - große Domäne: max **8**

### Anhänger/Klienten (City/Orga)

- Effekt pro Stufe:
  - `+1 AK` (pro Runde)
  - plus **Wahl**: `+1 Gold` **oder** `+1 Einfluss`
- Unterhalt (pro Stufe, pro Runde): **1 RM (Nahrung; Preisklasse beliebig)**; wenn nicht verfügbar: **1 Gold**
- Caps:
  - Stadtbesitz: **2/3/4** (klein/mittel/groß)
  - Circel & Collegien: **1 Stufe pro Circel‑Stufe**
  - Kult: **2/4/8** (klein/mittel/groß)

### Loyalität / Aufruhr / Abwanderung (Soll)

- Skala: `LO` **0–6** (Cap: max. `6`).
- Default (Neuanwerbung): **LO = 3** (kann über Anwerben-/Charaktertabellen abweichen).
- Ausnahme: Truppen starten standardmäßig mit **LO = 2**.
- Loyalität kann durch **Ereignisse** oder **Politische Schritte** steigen/sinken; dadurch können Proben auf Loyalität getriggert werden.
- **LO‑Probe** (wenn gefordert): würfle `1w6`; die Probe gelingt, wenn `Wurf <= LO` (unterwürfeln).
- Effekte:
  - `LO = 1–2`: Boni/Erträge (AK/KK/sonstige Effekte) dieser gebundenen Einheiten stehen nur **jede zweite Runde** zur Verfügung.
  - `LO = 0`: pro Runde wandert **1 Stufe** (Pächter/Anhänger/Klient) ab und geht verloren.
- Recovery/Boost: über **Politische Schritte: Loyalität sichern**.

Interpretation „jede zweite Runde“ (Soll):
- Effekte sind **alternierend** verfügbar (1 Runde aktiv, 1 Runde inaktiv).
- Default: bei Neuanwerbung startet die Einheit **aktiv**; der Zustand wechselt am Rundenende, solange `LO = 1–2` gilt.

Zusatz (Soll): Loyalität bei **Fachkräften/Beratern**
- Fachkräfte haben Loyalität (Startwert: i.d.R. **3**; modifiziert durch Anwerben-/Charaktertabellen).
- Wenn `LO = 2`: alle **4 Runden** `25%` Chance auf **Aufruhr** → der zugehörige Posten ist **2 Runden** lahmgelegt.
- Wenn `LO = 1`: alle **4 Runden** `25%` Chance, dass die Fachkraft **abgeworben** wird.
- Wenn `LO = 0`: die Fachkraft geht **sofort** verloren.

## Pylonennetz (Soll, späteres Spiel)

Charaktere können Pylonen-Netzwerke erbauen, um **Zauberkraft (ZK)** zu transferieren.

- Eine Achäer‑Pylone verbindet einen Ort mit bis zu **4** weiteren.
- Pro Ort (Domäne oder Stadtbesitz) kann insgesamt nur **1 Achäer‑Pylone** (“Achter‑Pylone”) gebaut werden.
- Bronze‑Pylonen sind ein **separater** Einrichtungstyp und nicht Teil des Achäer‑Netzwerks (siehe „Magische Experimental‑Domäne“).
- Material‑Hinweis (Soll):
  - **Mondsilber/Mindorium** sind Flavour‑Namen für `Hochmagische Erze/Metalle` (Materialkatalog: `docs/rules/soll/tables/materials.md`).
  - **Achäerkristalle** sind eine **Spezialwährung** eines separaten Systems (nicht Teil des Materialkatalogs).

### Kleine Achäerpylone
- Bauzeit: **2 Runden**
- Kosten/Material:
  - **8** Granit oder Marmor
  - **4 RM** ungeschliffener Optrilith
  - **1 SM** hochmagisches Metall (Hochmagische Erze/Metalle; z.B. Mondsilber)
  - **1** Achäerkristall (Spezialwährung)
  - **2 AK** während der Bauzeit
- Ertrag:
  - `+1 ZK` lokal
  - `+2 ZK` wenn mit zwei weiteren Pylonen verbunden (Netz‑Synergie)

### Große Achäerpylone
- Bauzeit: **4 Runden**
- Kosten/Material:
  - **20** Granit oder Marmor
  - **8 RM** ungeschliffener Optrilith
  - **4 SM** geschliffener Optrilith
  - **4 SM** hochmagisches Metall (Hochmagische Erze/Metalle; z.B. Mondsilber)
  - **4** Achäerkristalle (Spezialwährung)
  - **6 AK** während der Bauzeit
- Ertrag:
  - Basisertrag: `+1 ZK` lokal pro Runde
  - Kraftstrom (Verbindungen im 4‑Richtungen‑Netz):
    - 0 verbundene Nachbar‑Pylonen: `+0 ZK`
    - 1 verbundene Nachbar‑Pylone: `+1 ZK`
    - 2–3 verbundene Nachbar‑Pylonen: `+2 ZK`
    - 4 verbundene Nachbar‑Pylonen: `+3 ZK`
  - Gesamtertrag: Basis + Kraftstrom (also `+1–4 ZK` lokal pro Runde)

## Fachkräfte, Berater und Handlanger (Soll)

### Kapazitäten (Grundannahmen)

- Engster Beraterstab: **2–5** Rollen (Finanz/Handel, Sicherheit, Einfluss, Strategie/Taktik, …).
- Start: **2** mögliche Berater und **2** mögliche Fachkräfte.
- Kapazität steigt:
  - je **mittlerem** Posten (Circel, Ämter, Truppen, Domänen, Stadtbesitz, Handelsunternehmungen) um `+1`,
  - je **großem** Posten um `+1` (zusätzlich),
  - sowie über persönliche Einrichtungen (Privatbastionen; WIP): `docs/rules/soll/privatbastionen.md`.

### Fachkraft‑Tiers

#### Einfache Fachkraft
- Kosten: **10 Gold**
- Unterhalt: **1 Gold/Runde**
- Basiseffekt:
  - als Berater: `+1` auf relevante Aktions‑Proben
  - an Posten gebunden: `+1` auf relevante Erträge/Kampfkraft
- Bonusaktion: keine
- Einrichtungsäquivalent: **kleine Einrichtung**

#### Erfahrene Fachkraft
- Kosten: **25 Gold**
- Unterhalt: **3 Gold/Runde**
- Basiseffekt:
  - als Berater: `+2` auf relevante Aktions‑Proben
  - an Posten gebunden: `+2` auf relevante Erträge/Kampfkraft
- Bonusaktion: `+1` zusätzliche Spezialaktion alle **4 Runden**
- Einrichtungsäquivalent: **mittlere Einrichtung**

#### Meisterliche Fachkraft
- Kosten: **50 Gold**
- Unterhalt: **5 Gold/Runde**
- Basiseffekt:
  - als Berater: `+4` auf relevante Proben
  - an Posten gebunden: `+4` auf relevante Erträge/Kampfkraft
- Bonusaktion: `+1` zusätzliche Spezialaktion **pro Runde**
- Einrichtungsäquivalent: **große Einrichtung**

> Als Postenverwalter/Inhaber: Basiseffekt + erlaubt zusätzlich `+1` Zusatzaktion „Einrichtungsbau“ (Soll).

### Beraterstab & Kapazitäten (Soll)

- Engster Beraterstab: typischerweise **2–5** Rollen (Finanz & Handel, Sicherheit, Einfluss, Strategie, Taktik).
- Start‑Caps:
  - **2** mögliche **Berater** (gleichzeitig)
  - **2** mögliche **Fachkräfte** (gleichzeitig, an Posten gebunden oder als Berater)
- Cap‑Erhöhung:
  - Die maximale Anzahl an gebundenen Fachkräften steigt um `+1` pro **mittlerem** Posten und um `+1` pro **großem** Posten, den der Spieler besitzt (Posten: Circel, Ämter, Truppen, Domänen, städtischer Besitz, Handelsunternehmungen).
  - Beraterkapazität steigt zusätzlich über **persönliche Einrichtungen** (Privatbastionen; WIP): `docs/rules/soll/privatbastionen.md`.

### Fachkräfte anwerben (Soll)

Das Anwerben einer Fachkraft ist eine Nutzung der **freien Aktion** „Einrichtungen errichten/ausbauen“ (es zählt als Einrichtungsbau).

Ablauf:
1. Typ + Erfahrungsstufe wählen (einfach/erfahren/meisterlich) und Kosten bezahlen.
2. **Anwerben‑Check** würfeln:
   - Basis: **DC 10**
   - Modifikator: `+4` (erfahren), `+8` (meisterlich)
3. Bei Erfolg: Fachkraft wird angeworben; danach:
   - Anwerbetabelle
   - Charaktertabelle

Tabellen (Soll):
- `docs/rules/soll/tables/fachkraefte-anwerbetabelle.md`
- `docs/rules/soll/tables/fachkraefte-charaktertabelle.md`

### Allgemeine Handlanger (Soll)

Notation: erster Wert = als Berater / zweiter Wert = an Posten gebunden.

- **Taktiker**: `+1/+2/+3` Kampfkoordinationsproben; `+1/+2/+3` Kampfkraft aller Truppen; meisterlich zusätzlich `-1` Truppen‑Unterhalt.
- **Zauberer**: `-1/-2/-4 DC` auf magiebezogene Proben; `+1/+2/+4 ZK` pro Runde; zusätzlich erzeugt er mit **10%/20%/30%** Wahrscheinlichkeit pro Runde (einfach/erfahren/meisterlich) `+1` teures SM **„Magisches Artefakt“**.
- **Verwalter**: `-1/-2/-4 DC` Materialgewinn; `+4/6/8 RM` oder `+1/2/3 SM` Ertrag; `+1/+2/+3` Kampfkraft; `-1/-2/-3 Gold` Unterhalt.
- **Stratege**: `+1/+2/+4` Politische Schritte; `+2/+4/+8` Einfluss/Runde **oder** `+2/+4/+8 RM/Runde`.
- **Kleriker**: `+2/+4/+6` Einfluss bei religiösen Aktionen; `+1/+2/+3` auf Loyalitätsproben.
- **Finanzier/Händler**: `-1/-2/-4 DC` Geldgewinn & Verkauf/Ankauf; Gold‑Ertrag:
  - einfach: `+2 Gold/Runde`
  - erfahren: `+1 Gold × (Gesamtstufen der Handelsunternehmungen + Anzahl Schiffe)` pro Runde
  - meisterlich: `+2 Gold × (Gesamtstufen der Handelsunternehmungen + Anzahl Schiffe)` pro Runde
- **Politiker**: `-1/-2/-4 DC` Einflussgewinn; `+4/+8/+16` Einfluss/Runde; +Abwehr gegen politische Angriffe.
- **Baumeister**: zusätzliche Einrichtungs‑Sonderaktionen; Baukosten‑Ersparnis in Gold ist der höhere Wert aus (Flat‑Ersparnis in Gold) oder (%‑Ersparnis der Goldkosten). Richtwerte: `-1/-2/-3 Gold` oder `-10%/-20%/-30%` (einfach/erfahren/meisterlich), Mindestkosten **1 Gold**; Langzeitvorhaben: Bauzeit `-1/-2/-3` Abschnitte (Abschnitt = Baurunde; siehe `docs/rules/soll/privatbastionen.md`).
- **Werkstatt‑Fachkräfte**: `-2 DC` Materialgewinn: Werkstattüberwachung; zusätzlich `+2/+4/+6` teure SM pro Runde (Produkt nach Spezialisierung wählbar). Wenn keine teuren SM möglich sind: stattdessen **doppelte Menge** an einfachem SM.
- **Handlanger/Vollstrecker**: +Abwehr gegen direkte Angriffe; `+2/+3/+4` verdeckte/offene Kampfkraft.

## Weitere Einrichtungen & Spezialisierungen (Soll, Katalog nach Posten)

Der folgende Teil ist der **ausführliche Katalog** der (geplanten) Einrichtungen nach Posten.  
Er wird schrittweise normalisiert (stabile Keys, klare Prereqs/Caps, eindeutige Effekte).

### Domänen (Allgemeine Einrichtungen)

Cap: bis zu **2× Domänengröße** (klein=2, mittel=4, groß=6).

- **Werkstatt**: siehe oben (besondere Einrichtung, zählt als 1 Slot; Tier durch Domänencap).
- **Einfache Verteidigungsanlagen**: Kosten: 3 Gold, 3 RM (Bauholz), 2 AK (einmalig). Effekt: verbesserte Sicherheit; reduziert Überfall‑Wahrscheinlichkeit; `+2` Bonus auf alle Abwehrproben. Upgrades ab mittlerer Domäne: Verteidigungsanlagen (`+4`), starke Verteidigungsanlagen (`+6`), ohne zusätzliche Slots; jeweils Kosten verdoppeln; Baugestein statt Bauholz.
- **Landgewinnung**: Kosten: 2 Baurunden zu 2 AK; 4 Gold; Unterhalt: `+1 AK` permanent. Effekt: `+8 RM` eines Hauptertrags pro Runde; max 1× pro Domänengröße.
- **Kornspeicher**: Kosten: 2 Gold, 2 Ziegel, 2 Bauholz. Effekt: Lagerung von 20 RM Getreide ohne dediziertes Lager; Upgrade ab mittlerer Domäne (ohne Slots): große Kornspeicher (doppelte Kosten, doppelter Effekt).
- **Erweiterte Arbeiterunterkünfte**: Kosten: 5 Gold. Effekt: `+1 AK` permanent; max 2× pro Domänengröße.
- **Ausbau der Pächtersiedlung**: Kosten: 10 Gold. Effekt: +250 Pächter nächste Runde; max 1× pro Domänengröße (klein/mittel), 2× bei großer Domäne.
- **Druidischer Steinkreis**: Kosten: 20 RM Stein. Unterhalt: `-8 RM` Produktion (beliebig), `-1` Nahrung. Ertrag: `+2 ZK` (Natur).
- **Pronoia vergeben**: Kosten: 2 Einfluss pro Pronoia. Unterhalt: 2 Gold + 1 AK **oder** 250 Pächter. Ertrag: `+1 Kampfkraft` (auch für Milizen), frei auf vorhandene Truppen verteilbar.

**Ab mittlerer Domäne:**
- **Großer Oktral‑Schrein**: Kosten: 16 Gold, 6 RM (Baugestein), 2 teure SM (Schmuckwerk). Effekt: `+4 Einfluss/Runde`, `+1` mögliche Pächterstufe. Upgrade ab großer Domäne (ohne Slots): prächtiger Schrein (doppelte Kosten/Wirkung).
- **Marktplatz**: Kosten: 8 Gold. Effekt: `+1 Gold`, `+1 einfache SM`, `+1` Investition auf Geldgewinn: Verkauf+Ankauf. Upgrade ab großer Domäne: großer Marktplatz/Handelsposten (16 Gold, Unterhalt 1 AK, Effekt `+2 Gold` + `+1 teure SM` + `+2` Investitionen; erlaubt Auto‑Umtausch einer billigen RM‑Art 3:1).
- **Günstige Verkaufsverträge**: Kosten: 16 Gold, 12 Einfluss, 1 Fachkraft (Verwalter oder Händler). Effekt: Auto‑Umwandlung am Rundenende `3 RM → 1 Gold`; `+1` Investition auf Geldgewinn: Verkauf+Ankauf.
- **Krypten**: Kosten: 8 Gold, 4 RM (Baugestein), 1 SM Statuen. Effekt: `+1 Einfluss` pro 1000 Pächter (alternativ: +1 SM Untote‑AK wenn Domäne diese herstellt). Upgrade ab großer Domäne (ohne Slots): große Krypten (doppelte Kosten/Wirkung).
- **Domänenvilla**: Kosten: 3 Baurunden zu 4 AK; 30 Gold; 20 RM Baugestein; 5 RM Ziegel; 8 RM teures Baumaterial; 6 SM teures Material. Unterhalt: 4 Gold + 1 AK pro Domänenstufe. Effekt: `+1 permanenter Einfluss` jede zweite Runde; `-1 DC` auf Einflussgewinn (klein+mittel); Unterkunft: untergebrachter Berater/Fachkraft erhält `+1 LO`. Upgrade ab großer Domäne (ohne Slots): luxuriöse Villa (doppelt).

**Nur große Domäne:**
- **Experimental‑Cammern**: Kosten: 4 Baurunden zu 4 AK; 40 Gold; 40 RM Baugestein; 10 RM Bronze; 10 RM Glas; 10 teures Baumaterial; 5 teure SM; 1 Fachkraft (Zauberer).
  - Effekt: Ertrags‑Option wird beim Bau festgelegt; Erträge fallen **alle 4 Runden** an (z.B. Runde 4/8/12 … seit Fertigstellung).
  - Ertragsoption (wähle 1):
    - `+3` Zauberkraft
    - `+2` teure SM (Kleinchimären **oder** Untote)
    - `+1` teure SM (Kampfchimären **oder** Arbeitschimären/Golems)
    - `+2` teure SM (Magische Artefakte)
  - Optional: nach 4 Runden können Erträge **verdoppelt** werden, wenn `+1` permanente AK dauerhaft geopfert wird (AK entfällt vollständig; stackt nicht).
- **Stellares Observatorium**: Kosten: 5 Baurunden zu 4 AK; 50 Gold; 20 Marmor/Granit; 2× hochmagisches Metall (Hochmagische Erze/Metalle; z.B. verarbeitetes Mondsilber); 4× veredeltes Glas (SM); 1× magomechanische Teile. Unterhalt: 3 Gold. Effekt: Einrichtung „Observatorium“ wie bei Privatbastionen (WIP): `docs/rules/soll/privatbastionen.md`.
- **Kleines Kastron**: Kosten: 5 Baurunden zu 8 AK; 180 Gold; 60 RM Baugestein; 60 Einfluss. Unterhalt: 10 Gold + 3 Truppen‑Einheiten (keine Miliz). Effekte/Vorteile:
  - `+5 permanenter Einfluss` pro Runde
  - `+10 KK` für Einheiten, die hier stationiert sind
  - halbiert die Effekte negativer Ereignisse, die die Domäne betreffen
  - halbiert den DC von Verteidigungsproben
  - `+4` auf alle Angriffsreaktionen
  - zusätzliche Verteidigungsaktion für diese Domäne
  - erhöht den Cap für Söldner um `+5`
  - Unterkunft: Adelige/Berater/Fachkräfte erhalten `+1 LO`

### Städtischer Besitz (Allgemeine Einrichtungen)

Cap allgemein: bis zu **2/3/4** (klein/mittel/groß).

- **Organisiere Nerethon und Brajansgarden**: Kosten 4 Gold, 2 Einfluss; Unterhalt 1 AK, 1 Gold; Effekt: `+2` auf Verteidigungswürfe; Ereignis „Unruhen in Denera“ 1 Runde weniger.
- **Suppenküchen sponsoren**: Kosten 4 Gold; Unterhalt 1 RM (Nahrung) per 4 Einfluss; Ertrag `+1 Einfluss` pro Stufe Stadtbesitz; bei Hungersnot (Ereignisse **2/8/17/29**; stackt): `+2 permanenter Einfluss`.
- **Bündnis mit lokalen Banden**: Kosten 5 Gold, 3 Einfluss; Unterhalt 1 Gold; Effekt: `+1` auf Stadtangriffs‑Reaktionen; wenn Circel/Collegium: Unterhalt entfällt, stattdessen `+1 Gold` pro Circelstufe.
- **Organisiere Circel der Arbeiter**: Kosten 8 Gold, 2 Einfluss; Unterhalt 1 Einfluss; Ertrag `+1 AK` pro Stufe Stadtbesitz.
- **Pacht von Marktständen**: Kosten 14 Gold, 4 Einfluss; Effekt: `-1 DC` Geldgewinn (Verkauf) klein; gilt als mittleres Lager; `+1` Investition Verkauf+Ankauf.

**Ab mittlerem Besitz:**
- **Oktral‑Schrein**: Kosten 16 Gold, 6 RM Baugestein, 2 teure SM Schmuckwerk; Effekt `+4 Einfluss/Runde`; Upgrade (ohne Slots) prächtig = doppelt. Alternativ als Kult‑Schrein: `-2/-4 DC` auf Kult‑Ausbau (einfach/prächtig).
- **Insulaebau**:
  - Bauzeit: **4 Baurunden** (während Bau: `2 AK` pro Runde gebunden)
  - Kosten (bei Baubeginn): **14 Gold**, **30 RM** Ziegel, **15 RM** Bauholz
  - Effekt:
    - siedelt **500 Pächter** an (**2 Stufen**, nächste Runde)
    - erhöht die maximal anwerbbaren **Anhänger/Klienten** in dieser Stadt: `+1` Anhängerstufe pro **Circel-/Collegiums‑Stufe** (HQ in dieser Stadt)
  - Mehrfach baubar (nach Besitzgröße): max. `+2/+4` (mittel/groß)
- **Mercatoria** (nur 1× pro Stadt): Kosten 16 Gold; Unterhalt 1 AK; Effekt `+2 Gold` + `+1 teure SM` + `+2` Investitionen Verkauf+Ankauf; Upgrade große Mercatoria (ohne Slots) = doppelt + Bonusaktion; Prereq: nimmt Platz einer großen Werkstatt/Lager ein (Cap‑Slot).
- **Manufakturbetriebe**: 4 Baurunden à 4 AK; Kosten 30 Gold, 30 Ziegel, 20 Holz, 4 teure SM (Maschinenteile); Prereq: mind. mittlere Werkstatt + einfache Fachkraft (Handwerk). Effekt: Werkstatt‑Unterhalt `-1 AK` pro Stufe; Werkstattüberwachung Cap `+1`; schaltet 1 zusätzlichen mittleren Werkstattplatz frei (ohne allgemeine Caps zu erhöhen).
- **(Luxuriöses) Atriumhaus**: 3 Baurunden à 4 AK; Kosten 30 Gold + Baumaterial; Unterhalt 4 Gold pro Besitzstufe; Effekt: permanenter Einfluss (analog Domänenvilla); nimmt mittleren Werkstatt/Lagerplatz ein; Upgrade (ohne Slots) luxuriös = doppelt.
- **Magomanufaktur**: Kosten 100 Gold, 20 Einfluss, 8 ZK, 8 SM Magomechanik; Voraussetzung: **Manufakturbetrieb** + **große Werkstatt** + Fachkraft (Zauberer). Bauzeit: **4 Runden**, währenddessen pro Runde `2 AK` + `4 ZK` gebunden (Betrieb steht erst nach Bauzeit). Unterhalt (im Betrieb): `+2 ZK` pro Runde. Ertrag: `+2` SM (magomechanische) pro Runde. Werkstattüberwachung (Materialgewinn):
  - verdoppelt die Erträge (je Investition `1 AK`) gemäß Erfolgsstufen (alle Stufen ×2),
  - bei großer Werkstatt bleibt die Bonusaktion „Materialgewinn: Werkstattüberwachung“ erhalten.

### Domänen (Spezialisierungen — Übersicht, Soll)

Hinweise:
- Spezialisierung erfolgt über die freie Aktion „Einrichtungen errichten/ausbauen“.
- Spezialisierungen können Produktionsarten neu verteilen/erweitern und Bonus‑Gold für ausgewählte Güter erlauben (siehe `docs/rules/soll/aufbausystem.md`).

#### Landwirtschaft (Felder)
- Kosten (Spezialisierung): 10 Gold, 2 RM (gewünschtes Gut)
- Unterhalt: **2 AK**
- Effekt (Basis): `+12 RM` billiges Nahrungs‑Gut + `+4 RM` anderes einfaches landwirtschaftliches Gut pro Runde
- Auto‑Vorteil: Kornspeicher gilt als automatisch errichtet (slotfrei), kann ausgebaut werden
- Beispiel‑Einrichtungen:
  - Terrassen/Bewässerungssystem: 10 Gold, 2 AK → `+6 RM` Hauptanbauprodukt
  - Große Blumen/Kräutergärten: 6 Gold, 1 AK → `+4` teures RM (Kräuter/Blumen)
  - Exotische/Magische Gewächshäuser: 20 Gold, 2 AK, 1 SM Sonderwerkzeug → `+2` teures RM (magische Pflanzen) **oder** `+1` teures SM (Tränke) alle 2 Runden
  - **Große Mühlanlagen**:
    - Bauzeit: **2 Runden** (während Bau: `1 AK` pro Runde gebunden)
    - Kosten (bei Baubeginn): **5 Gold**, **5 Ziegel**, **2 Holz**
    - Unterhalt (Betrieb): wie Werkstatt‑Unterhalt (`1 AK`)
    - Effekt (Umwandlung in der Umwandlungsphase; Fokus bei Bau wählen):
      - **Ölmühle**: wandle bis zu `3 RM` Oliven → bis zu `6` verbesserte RM **„Olivenöl“** (2:1) pro Runde
      - **Bäckerei/Mühle**: wandle bis zu `4 RM` Getreide → bis zu `8` verbesserte RM **„Brot/Pulpellen“** (2:1) pro Runde
    - Sonderregel: gilt als **kleine Werkstatt** (slotfrei) nur für Landwirtschafts‑RM→verbesserte RM; kann **keine** SM herstellen.
    - Upgrade: **Mechanische Mühlanlage** (ab mittlerer Domäne; slotfrei):
      - Bauzeit: **2 Runden** (während Bau: `2 AK` pro Runde gebunden)
      - Kosten: **10 Gold**, **10 Ziegel**, **4 Holz**, **2 teure SM (Mechanische Teile)**
      - Effekt: Kapazitäten verdoppelt (Öl: bis `6 RM` Oliven → `12` Öl; Brot: bis `8 RM` Getreide → `16` Brot/Pulpellen); gilt als **mittlere Werkstatt** nur für Landwirtschafts‑RM→verbesserte RM; kann keine SM herstellen.

#### Tierzucht
- Kosten (Spezialisierung): 15 Gold, 4 Tiereinheiten
- Unterhalt: **1 AK**
- Effekt (Basis): wähle **1 Paket** (beim Bau festlegen; Produktion darf komplett auf diese Güter umgestellt werden):
  - **Schafe**: `+8` billige RM **„Wolle“** + `+4` billige **verbesserte** RM **„Milch/Käse“** + `+4` einfache **verbesserte** RM **„Fleisch“**
  - **Schweine**: `+8` einfache **verbesserte** RM **„Fleisch“** + `+8` einfache RM **„Schweine/Schafe“**
  - **Rinder**: `+8` einfache **verbesserte** RM **„Milch/Käse“** + `+4` teure RM **„Rinder“**
  - **Varken**: `+4` einfache **verbesserte** RM **„Fleisch“** + `+4` billige RM **„Wolle“** + `+4` einfache **verbesserte** RM **„Milch/Käse“** + `+4` teure RM **„Varken“**
  - **Pferde/Lasttiere**:
    - Wahl: `+2` teure RM **„Pferde/Monokeroi“** + `+2` teure RM **„Lasttiere“** **oder** `+4` von einer Sorte
    - zusätzlich: alle **4 Runden** `+1` **permanente AK**
- Beispiel‑Einrichtungen:
  - **Schlachthaus**:
    - Bauzeit: **2 Runden** (während Bau: `1 AK` pro Runde gebunden)
    - Kosten (bei Baubeginn): **5 Gold**, **5 Ziegel**, **2 Holz**, **1 SM (Werkzeug)**
    - Unterhalt (Betrieb): wie Werkstatt‑Unterhalt (`1 AK`)
    - Effekt (Umwandlung in der Umwandlungsphase; Fokus bei Bau wählen):
      - wandle bis zu `4 RM` Schweine/Schafe/Varken → bis zu `8` verbesserte RM **„Fleisch“** pro Runde
      - oder wandle bis zu `3 RM` Rinder → bis zu `12` verbesserte RM **„Fleisch“** pro Runde
    - Sonderregel: gilt als **kleine Werkstatt** (slotfrei) nur für Tier‑RM→verbesserte RM „Fleisch“; kann **keine** SM herstellen.
    - Upgrade: **Großes Schlachthaus** (ab mittlerer Domäne; slotfrei):
      - Bauzeit: **2 Runden** (während Bau: `2 AK` pro Runde gebunden)
      - Kosten: **10 Gold**, **10 Ziegel**, **4 Holz**, **2 billige SM (Werkzeug)**
      - Effekt: Kapazitäten verdoppelt (bis `8 RM` Tier‑RM → `16` Fleisch; oder bis `5 RM` Rinder → `20` Fleisch); gilt als **mittlere Werkstatt** nur für diese Umwandlung.
  - Käserei/Molkerei/Gerberei: 6 Gold, 1 AK → `+4` billige SM (Käse) oder `+2` billige SM (Leder)
  - Edelzüchtungen: 20 Gold, 2 AK → `+1` teures RM (edle Tiere) oder `+1` AK (Arbeitstiere)
  - **Schlachtrosszüchtungen**: Kosten **30 Gold**; Unterhalt **2 AK**; Voraussetzung 1 Fachkraft (Tiermeister). Effekt (Umwandlung): wandle RM **„Pferde/Reittiere“** im Verhältnis **4:1** zu teurem SM **„Schlachtrösser“** (pro Runde in der Umwandlungsphase).

#### Forstwirtschaft
- Kosten (Spezialisierung): 6 Gold
- Unterhalt: –
- Effekt (Basis): `+16` Holz (billig) und `+4` teures RM (Wildbret)
- Beispiel‑Einrichtungen:
  - **Jagdgebiet**: Kosten 5 Gold. Effekt (bei Bau wählen):
    - `+6` einfache **verbesserte** RM **„Fleisch/Pökelfleisch“** und `+4` teure RM **„Wildbret“** pro Runde, **oder**
    - `+8` teure RM **„Pelze“** pro Runde
  - Imkerei/Metkelterei: 2 Gold → `+2` billiges SM (Honigmet) pro Runde je Domänenstufe
  - Edelholzzucht: 15 Gold, 2 AK → wandelt die Hälfte des Holz‑Ertrags der Domäne in teures RM **„Edelholz“** um

#### Bergbau / Steinbruch
- Kosten (Spezialisierung): 20–50 Gold, 4–8 RM (Bauholz), 1 Fachkraft (Minenaufseher)
- Unterhalt: Steinbruch **3 AK**, Erz-/Edelminen **6 AK** (zusätzlich)
- Effekt (Basis; Fokus beim Bau wählen):
  - **Steinbruch**: Wahl `+16 RM` **„Baugestein“** (einfach) **oder** `+12 RM` **„Marmor/Granit“** (teuer)
  - **Erzmine**: Wahl `+8 RM` **„Eisenerz“** (einfach) **oder** `+8 RM` **„Kupfererz“** (einfach) **oder** `+8 RM` **„Blei/Zinn“** (einfach)
  - **Edelmetall-/Kristallmine**: Wahl `+2 RM` **„Edelmetalle“** (teuer) **oder** `+2 RM` **„Rohedelsteine“** (teuer) **oder** `+2 RM` **„Ungeschliffene Kristalle“** (teuer)
- Beispiel‑Einrichtungen:
  - **Verbesserte Schmelzöfen**: Kosten 8 Gold; Unterhalt `1 AK`. Effekt (Umwandlung): wandle bis zu `4 RM` korrespondierendes Erz → bis zu `8` verbesserte RM **„verhüttetes Metall“** (2:1) pro Runde (Beispiele: Eisenerz→Eisen; Kupfererz + Blei/Zinn→Bronze).
  - **Tiefenschacht** (mittlere Einrichtung; Voraussetzung: mittlere Domäne):
    - Bauzeit: **2 Runden** (während Bau: `4 AK` pro Runde gebunden) + 1 Fachkraft (Verwalter/Baumeister/Handwerker)
    - Kosten (bei Baubeginn): **20 Gold**, **12 Holz**, **4 billige SM (Werkzeug)**
    - Unterhalt (Betrieb): `2 AK` pro Runde
    - Effekt: Wahl
      - `+12 RM` Hauptmaterial (für Erzmienen: Eisenerz oder Kupfererz oder Blei/Zinn; pro Tiefenschacht festlegen), **oder**
      - `+2` teure RM (Edelmetalle/Rohedelsteine/Ungeschliffene Kristalle; pro Tiefenschacht festlegen)
    - Upgrade: **Großer Tiefenschacht** (nur große Domäne; slotfrei):
      - Bauzeit: **4 Runden** (während Bau: `4 AK` pro Runde gebunden) + 1 Fachkraft
      - Kosten: **40 Gold**, **24 Holz**, **8 billige SM (Werkzeug)**
      - Unterhalt: `4 AK` pro Runde
      - Effekt: **verdoppelt** die Erträge des Tiefenschachts
  - **Hüttewerke** (Besondere Einrichtung Bergbaudomäne; nicht für Steinbruch):
    - Voraussetzung: mindestens **mittlere Domäne** (Bergbau/Erzmine)  
      Typ: **mittlere Einrichtung**
    - Bauzeit: **4 Runden** (während Bau: `4 AK` pro Runde gebunden)
    - Kosten (bei Baubeginn): **15 Gold**, **30 Ziegel**, **10 RM Metall (Eisen)**
    - Unterhalt (Betrieb): `2 AK` pro Runde
    - Effekt (Umwandlung in der Umwandlungsphase):
      - wandle bis zu `6 RM` Erze → bis zu `12` verbesserte RM **„verhüttetes Metall“** (Eisen oder Bronze) pro Runde
    - Sonderregel: gilt als **mittlere Werkstatt** (slotfrei) nur für Erz→verhüttetes Metall; belegt keinen Einrichtungsplatz.
    - Upgrade: **Große Hüttewerke** (nur große Domäne; slotfrei):
      - Bauzeit: **4 Runden** (während Bau: `4 AK` pro Runde gebunden)
      - Kosten: **30 Gold**, **50 Ziegel**, **25 RM Metall (Eisen)**
      - Unterhalt: `4 AK` pro Runde
      - Effekt: wandle bis zu `12 RM` Erze → bis zu `24` verbesserte RM **„verhüttetes Metall“** pro Runde; gilt als **große Werkstatt** nur für diese Umwandlung.

#### Magische Experimental‑Domäne (Spezialisierung)

- Voraussetzung: **Etablierte Cammer** (siehe „Experimental‑Cammern“ im Domänen‑Katalog).
- Effekt (Basis): RM‑Produktion der Domäne wird **halbiert**; zusätzlich `+2` lokale **ZK** pro Domänenstufe.
- Unterhalt/Anforderungen:
  - `-1 LO` aller Pächter/Untertanen der Domäne (solange die Spezialisierung aktiv ist)
  - benötigt `1` Fachkraft **Zauberer**

Fokus (bei Spezialisierung wählen):
- **Kryptendomäne**
  - Hälfte der Arbeitskraft der Domäne sind **untote Arbeitskräfte**
  - Unterhalt: `1 ZK` (für die untoten Arbeitskräfte)
  - Ereignis‑Interaktion: bei **Hungersnot/Seuche** entsteht `+1` zusätzliche **permanente** untote Arbeitskraft der Domäne
  - erlaubt den Bau von **2 zusätzlichen kleinen Werkstätten und/oder Krypten** ohne Einrichtungsplatz zu belegen
- **Experimentaldomäne**
  - erlaubt den **freien Bau** einer weiteren **Experimental‑Cammer** (slotfrei)
  - erlaubt den Bau einer **großen** Experimental‑Cammer (doppelte Kosten, doppelte Effekte)

Einrichtungen (Auswahl, Soll):
- **Kleine Bronze‑Pylone**: Kosten `8 SM` verhüttetes Metall (Bronze), `1 RM` Silber, `1 SM` geschliffene Edelsteine. Ertrag: `+1 ZK` pro Runde.
- **Dämonische Gargoyle/Wächterstatuen**: Kosten `5 SM` Statuen, `1 SM` hochmagisches Metall (Hochmagische Erze/Metalle; z.B. Mindorium/Mondsilber). Unterhalt `1 ZK`/Runde. Effekt: Verteidigungs‑DC halbiert; Politische Schritte gegen die Domäne `+2 DC`; Aura der Furcht (narrativ); Untote erhalten in Reichweite Bonus.
- **Gebeinsgruben** (nur Kryptendomäne): Kosten 3 Gold, `2 RM` Silber, `1 SM` Artefakte. Unterhalt `2 ZK` + 2 Gold/Runde (Gold‑Unterhalt entfällt bei Krypten auf Domäne). Ertrag: alle 4 Runden `+1` teures SM **„Untote Kampfkraft“** (max 8); Unterhalt `+1 ZK` pro 4 Einheiten.
- **Geister‑Phylakarien**: Kosten 25 Gold, `3 SM` hochmagisches Metall (Hochmagische Erze/Metalle; z.B. Mondsilber/Mindorium), `1 SM` Artefakte. Unterhalt `1 ZK`/Runde. Ertrag: alle 4 Runden `+1` teures SM **„Untote Kampfkraft“** (max 8); Unterhalt `+1 ZK` pro 4 Einheiten.
- **Alchemistische experimentelle Destille** (mittlere Einrichtung; ab mittlerer Domäne): Kosten 30 Gold, 10 Ziegel, `2 SM` Metallware (Spezialzubehör), `4 SM` Glas; benötigt `1` Fachkraft (Alchemist). Unterhalt `1 Gold + 2 AK`/Runde. Ertrag (alle 4 Runden, bei Bau wählen): `+2` teure SM **„Tränke“** **oder** `+4` billige SM **„Tinkturen/Lacke/Farbe“** **oder** `+2 KK` (Stärketränke, temporär) **oder** alchemischer Dünger (`+4 RM` Getreide pro Domänenstufe jeder Domäne).
- **Äther‑Kondensator**: Kosten `8 RM` Silber, `1 SM` hochmagisches Metall (Hochmagische Erze/Metalle; z.B. Mondsilber), `1 SM` magische Artefakte. Ertrag: `+2 ZK`/Runde.
- **Zucht‑Labore / Golemiden‑Labor** (mittlere Einrichtung; mittlere Domäne): Kosten 8 Gold, 10 RM Baugestein, 4 RM Stahl, 2 RM Silber, `2 SM` Artefakte. Unterhalt `1 ZK + 2 AK` + `4 RM` Tiere (Chimären) **oder** Granit (Golems) + `2` teure RM (exotische Tiere **oder** magische Metalle) pro Runde. Ertrag: alle 4 Runden Wahl `+1` teures SM (chimärische/golemidische Arbeitskraft) **oder** `+1` permanente AK (max 8) **oder** `+1` SM (Kampfchimären/Kampfgolems, max 4). Unterhalt `+1 ZK` pro 4 Einheiten.
- **Artefaktschmiede** (mittlere Einrichtung; ab mittlerem Besitz):
  - Kosten (bei Baubeginn): **25 Gold**, **15 RM** (Baugestein oder Ziegel), `4 SM` Sonderwerkzeug, `2 SM` mindere magische Metalle
  - Voraussetzung: `1` Fachkraft **Zauberer**
  - Unterhalt (Betrieb): `3 Gold + 2 AK + 1 ZK` pro Runde; zusätzlich alle **4 Runden** `1 SM` minderes magisches Metall
  - Ertrag: alle **2 Runden** `+1` teures SM **„Mindere magische Artefakte“**
  - Veredelung (Umwandlungsphase):
    - gilt als **mittlere Werkstatt** (slotfrei) und kann nur RM (Edelsteine/Kristalle/mindere magische Erze) im Verhältnis **2:1** in teures SM **„Mindere magische Artefakte“** umwandeln,
    - für die Veredelungsfunktion fällt zusätzlich **Werkstatt‑Unterhalt in AK** an (mittlere Werkstatt: `2 AK`).

### Städtische Spezialisierungen (Soll, Überblick)

Grundregeln:
- Spezialisierung ist nur **einmal pro Stadtbesitz** möglich und setzt mindestens **mittleren** Stadtbesitz voraus.
- Allgemeine Einrichtungen (Cap): bis zu **2/3/4** (klein/mittel/groß).
- Besondere Einrichtungen aus der Spezialisierung (Cap): bis zu **1/2/3** (klein/mittel/groß).
- Zusätzliche Slots können über Circel/Collegien kommen (siehe `docs/rules/soll/aufbausystem.md`); diese Slots können allgemein **oder** besonders sein.

#### 1) Nahrungsproduktion
- Unterhalt: **2 AK**
- Werkstatt‑Integration: Werkstätten in diesem Stadtbesitz dürfen auf die spezialisierten Waren umgestellt werden (Arten dürfen neu verteilt werden); ein billiges und ein einfaches ausgewähltes SM dürfen Gold‑Bonus haben.
- Fokus (bei Spezialisierung wählen):
  - **Bäckereien**: `+12` billige (verbesserte) RM **„Brot/Pulpellen“** pro Runde
  - **Brauerei/Winzerei**: `+3` SM **„Brand/Wein“** pro Runde
  - **Metzgerei**: `+12` billige (verbesserte) RM **„Pökelfleisch/Fisch“** pro Runde
- Besondere Einrichtungen (freigeschaltet):
  - **Gasthaus**: 8 Gold, `1 AK`; Unterhalt: `1` Brandt/Nahrung. Effekt: `+2 Gold/Runde`. Upgrade (groß, slotfrei): doppelte Kosten/Unterhalt/Ertrag.
  - **Großer Viehmarkt** (nur Metzgerei‑Fokus): 12 Gold, `1 AK`. Effekt: Wahl `+1 SM` Schweine/Schafe **oder** `+2` billige RM Fleisch pro Runde.
  - **Große Destille** (nur Brauerei‑Fokus): 18 Gold, `2 AK`. Effekt: `+2 SM` Brand pro Runde für `2` korrespondierende RM Getreide Unterhalt.

#### 2) Handwerkswaren
- Unterhalt: **2 AK**
- Werkstatt‑Integration: Werkstätten in diesem Stadtbesitz dürfen auf die spezialisierten Waren umgestellt werden; ein billiges und ein einfaches ausgewähltes SM dürfen Gold‑Bonus haben.
- Fokus (bei Spezialisierung wählen):
  - **Tuche**: `+4` billige SM **„Tuche“** pro Runde
  - **Möbel**: `+3` einfache SM **„Möbel“** pro Runde
  - **Alltagswaren**: `+4` billige SM **„Tonwaren“** **oder** **„Lederwaren“** pro Runde
- Besondere Einrichtungen (freigeschaltet):
  - **Große Färberei**: 10 Gold, `1 AK`, `1 SM` Farbstoffe. Effekt: `+2` teure SM **„Teure Tuche“** pro Runde für `2` einfache SM Tuche Unterhalt.
  - **Webkammern**: 12 Gold, `1 AK`. Effekt: `+2` billige SM Tuche pro Runde.
  - **Gerberviertel**: 10 Gold, `1 AK`. Effekt: `+2` einfache SM Lederwaren pro Runde für `1 RM` Rinder Unterhalt.

#### 3) Metallverarbeitung
- Unterhalt: **2 AK** + `2 RM` Bauholz
- Werkstatt‑Integration: Werkstätten in diesem Stadtbesitz dürfen auf die spezialisierten Waren umgestellt werden; ein billiges und ein einfaches ausgewähltes SM dürfen Gold‑Bonus haben.
- Fokus (bei Spezialisierung wählen):
  - **Schmiede**: `+4` billige SM **„Werkzeug“** pro Runde
  - **Hüttewerke**: `+12` einfache RM **„verhütte Erze“** pro Runde
- Besondere Einrichtungen (freigeschaltet):
  - **Gasse der Waffenschmiede**: 18 Gold, `2 AK`, 1 Fachkraft (Waffenschmied). Effekt: `+1` teures SM Waffen **oder** Rüstungen pro Runde für `1 RM` Stahl Unterhalt.
  - **Mechaniker‑Werkstätten**: 22 Gold, `2 AK`, 1 Fachkraft. Effekt: `+1` teures SM **„Mechanische Teile“** alle 2 Runden.
  - **Gießereien**: 15 Gold, `2 AK`, 1 Fachkraft (Hüttenmeister). Effekt: `+2` einfache SM Metallwaren pro 2 korrespondierende RM Metall Unterhalt.
  - **Magische Metallverarbeitung (Magofaktur)** (mittlere Einrichtung; ab mittlerem Besitz):
    - Bauzeit: **5 Runden** (während Bau: `2 AK` pro Runde gebunden)
    - Kosten (bei Baubeginn): **25 Gold**, **30 RM** (Baugestein oder Ziegel), `4 SM` Sonderwerkzeug, `4 SM` magomechanische Teile, `2 SM` hochmagische Erze/Metalle
    - Voraussetzung: `1` Fachkraft **Zauberer**
    - Unterhalt (Betrieb): `3 Gold + 2 AK + 1 ZK` pro Runde; zusätzlich alle **4 Runden** `1 SM` hochmagisches Metall
    - Ertrag: alle **2 Runden** `+1` teures SM **„Magomechanische Teile“**
    - Veredelung (Umwandlungsphase):
      - gilt als **mittlere Werkstatt** (slotfrei) und kann nur RM (Kupfer, Bronze, Eisen) im Verhältnis **2:1** in teures SM **„Mindere magische Metalle/Legierungen“** umwandeln,
      - für die Veredelungsfunktion fällt zusätzlich **Werkstatt‑Unterhalt in AK** an (mittlere Werkstatt: `2 AK`).

#### 4) Edelhandwerk & Kunst
- Unterhalt: **2 AK + 2 Gold**
- Werkstatt‑Integration: Werkstätten in diesem Stadtbesitz dürfen auf die spezialisierten Waren umgestellt werden; ein billiges und ein einfaches ausgewähltes SM dürfen Gold‑Bonus haben.
- Fokus (bei Spezialisierung wählen):
  - **Glaser**: `+2` teure SM **„Glaswaren“** pro Runde
  - **Juweliere & Optrilithschleifer**: `+2` einfache SM **„geschliffene Juwelen“** pro Runde für `1` korrespondierende RM Unterhalt
  - **Parfümeure**: `+2` teure SM **„Parfüms“** pro Runde
- Besondere Einrichtungen (freigeschaltet):
  - **Spezialglashütte**: 22 Gold, `2 AK`, 1 Fachkraft. Effekt: `+1` teures SM **„Glaskunst“** pro Runde.
  - **Experimentelles alchemistisches Labor**: 30 Gold, `1 AK`, 1 Fachkraft (Alchemist). Effekt: `+1` teures SM **„Tränke“** alle 2 Runden.
  - **Goldschmiedegasse**: 12 Gold, `2 AK`, 1 Fachkraft (Goldhandwerker). Unterhalt `1 AK`/Runde. Effekt: Wahl `+2` teure SM Schmuckwerk **oder** `+2` teure SM geschliffene Edelsteine für `2 RM` Edelmetalle **oder** ungeschliffene Edelsteine Unterhalt.
  - **Alchemomanufaktur** (mittlere Einrichtung): Kosten 60 Gold, 20 Ziegel, 10 Einfluss, `4 SM` Metallware (Spezialzubehör), `4 SM` Glas; benötigt 1 Fachkraft (Alchemist). Unterhalt `2 Gold + 2 AK + 1 ZK`/Runde. Effekt: `+3` teure SM Tränke **oder** `+6` billige SM Tinkturen/Lacke/Farbe **oder** alchemischer Dünger (`+4 RM` Getreide pro Domänenstufe jeder Domäne).
  - **Gasse der Kunsthandwerker**:
    - Kosten (bei Baubeginn): `2 SM` Sonderwerkzeug
    - Unterhalt/Voraussetzung: `1` Fachkraft (Kunsthandwerker)
    - Effekt (Umwandlungsphase; pro Runde):
      - Grundlimit: führe **1** Veredelung nach Wahl aus.
      - Skalierung: `+1` zusätzliche Veredelung pro **1000** angesiedelte Pächter (pro `4` Pächterstufen) in diesem Stadtbesitz (Input/Output skaliert linear).
      - Veredelungsoptionen (je Veredelung wähle genau eine):
        - `1` teures RM **Ungeschliffene Kristalle/Edelsteine** **oder** `1` teures RM **Edelmetalle** → `1` teures SM **Geschliffene Edelsteine/Kristall** **oder** `1` teures SM **Schmuck/Schmuckwerk**
        - `4` RM **Quarzsand** → `1` SM **Glaswaren**
        - `4` RM **Kräuter/Blumen** → `1` teures SM **Parfüms** **oder** `1` teures SM **Tränke/Elixiere**
        - `4` Einheiten **Papier** → `1` teures SM **Bücher/Kartenmaterial**
        - `2` RM **Blei/Messing/Zinn** → `1` teures SM **Mechanische Teile**

#### 5) Bau und Bauprodukte
- Unterhalt: **3 AK** + `2 RM` Holz
- Werkstatt‑Integration: Werkstätten in diesem Stadtbesitz dürfen auf die spezialisierten Waren umgestellt werden; ein billiges und ein einfaches ausgewähltes SM dürfen Gold‑Bonus haben.
- Effekt (Basis): beschleunigt Bauprojekte in der Stadt (Meta‑Vorteil; v1: narrativ/Log).
- Fokus (bei Spezialisierung wählen):
  - **Ziegeleien**: `+12` RM Ziegel pro Runde
  - **Zimmerer**: `+12` RM Bauholz pro Runde
- Besondere Einrichtungen (freigeschaltet):
  - **Maurercircel**: 8 Gold. Effekt: `+2 AK` pro Runde.
  - **Baumeistercollegium**: 12 Gold, 1 Fachkraft (Baumeister). Effekt: reduziert Baukosten um `-2 Gold` pro Einrichtung; bei **Großbauprojekten** (Bauzeit: **4+ Baurunden**) `-15%`; verbessert architektonische Qualität.
  - **Mosaik/Bildhauerwerkstätte**: 8 Gold, `1 AK`, 1 Fachkraft. Effekt: `+1` teures SM Kunstmosaik alle 3 Runden.

#### 6) Verbrecher‑ und Schutzgeldbezirk
- Unterhalt: **1 Gold** (Schweigegeld/Bestechungen)
- Effekt:
  - `+1 Einfluss/Runde` pro Stufe Unterweltcircel
  - `+2` auf Verteidigungsproben des Stadtbesitzes
- Mögliche besondere Einrichtungen:
  - **Schäbige Werkstätten**: Effekt: `+2` Plätze für **kleine Werkstätten** zusätzlich zur Cap.
  - **Sluminsulae**: wie Insulaebau, aber zu **halben Kosten** und **halber Bauzeit** (2 Baurunden à `1 AK`). Alle 4 Runden `25%` Wahrscheinlichkeit einzustürzen (`-1w3` Pächterstufen), Einrichtung fällt weg; gleiche Probe bei Feuer oder Aufruhr in Denera.
  - **Netzwerk aus Geheimtunneln**: Kosten 8 Gold, `1 AK` (einmalig). Effekt: `+2 Gold/Runde`; zusätzlich `+2` auf Verteidigungsproben in der Stadt und für diesen Stadtbesitz.
  - **Hehlerring**: Kosten 12 Gold, `1 AK` (einmalig). Effekt: 1 kleines Lager (nur **10 SM**, ohne Slot/Cap/Unterhalt) wird errichtet; zusätzlich `-1 DC` auf Geldgewinn: Ankauf & Verkauf; Bonusaktion: alle 4 Aktionen `+1` Bonusaktion Ankauf+Verkauf (bis zu 4 Investments).
  - **Spielhöllen & Vergnügungseinrichtungen**:
    - Bauzeit: **2 Runden** (während Bau: `2 AK` pro Runde gebunden)
    - Kosten (bei Baubeginn): **18 Gold**
    - Unterhalt: –
    - Effekt: `+2 Gold/Runde`, `+1 permanenter Einfluss`, `+1 Information` alle 4 Runden
    - Upgrade: **Große Spielhöllen** (nur großer Stadtbesitz; nimmt Platz einer **mittleren** Werkstatt/Lager ein; kein zusätzlicher Einrichtungsplatz):
      - Bauzeit: **4 Runden** (während Bau: `4 AK` pro Runde gebunden)
      - Kosten: **18 Gold**, **20** Baugestein/Ziegel, **5** einfache SM (Möbel/Tuche)
      - Unterhalt: `2 AK`/Runde
      - Effekt: `+8 Gold/Runde`, `+4 permanenter Einfluss`, `+1 Information` pro Runde
  - **Exklusives Badehaus** (nur großer Stadtbesitz; nimmt Platz einer **großen** Werkstatt/Lager ein):
    - Bauzeit: **4 Runden** (während Bau: `4 AK` pro Runde gebunden)
    - Kosten: **40 Einfluss**, **20 Gold**, **20** teure RM (Granit/Marmor), **10** einfache RM (Bronze), **5** teure RM (Optrolith/Edelmetalle), **5** SM (mechanische Teile/Glas), **4** einfache SM (Möbel/Tuche)
    - Unterhalt: `2 AK`/Runde
    - Effekt: `+12 Gold/Runde`, `+12 Einfluss/Runde`, `+4 permanenter Einfluss`, `+1 Information` pro Runde
    - Bonusaktion: alle 2 Aktionen `+1` Bonusaktion (Einfluss gewinnen **oder** Posten gewinnen **oder** Politische Schritte)

### Circel & Collegien (Einrichtungen — Übersicht, Soll)

#### Allgemeine Einrichtungen (alle Circel/Collegien)

- **Festes Hauptquartier**: Kosten 4 Gold, 2 Einfluss; Unterhalt 1 Gold/Runde; Effekt `+1` auf Reaktionen gegen Angriffe.
- **Botennetz**: Kosten 8 Gold; Unterhalt 1 AK + 1 Gold/Runde; Effekt `+1` auf Proben für politische Schritte.
- **Veteranen‑Protectoren**: Kosten 8 Gold, 2 Einfluss; Unterhalt 1 Gold/Runde; Ertrag `+2` verdeckte Kampfkraft.
- **Gemeinsames Warenlager**: Kosten 8 Gold, 4 Einfluss; Unterhalt 1 Einfluss/Runde; Effekt: Lagerung von `+5 RM` oder `+3 SM` pro Circelstufe ohne dediziertes Lager.
- **Lehrlings‑Ausbildung**: Kosten 8 Gold, 4 Einfluss; Unterhalt 1 Gold/Runde; Ertrag `+1 AK` pro Circelstufe.
- **Sonderbeiträge** (einmalig): Kosten 15 Einfluss; Effekt `+1` Bonusaktion Geldgewinn (max 2 Investitionen); Nachteil: `+4 DC` für politische Aktionen und Einflussgewinn in der nächsten Runde.

#### Besondere Einrichtungen — Unterwelt (inkl. Spionage‑Kontext)

- **Gnadenlose Geldeintreiber** (nur Unterweltcircel): Kosten 8 Einfluss und `-2 LO` (Pächter); Unterhalt 2 Einfluss/Runde. Ertrag: je `+1 Gold` pro Stadtbesitz + pro 500 Pächter + pro Circelstufe (bis max `+8`). Zusätzlich: Geldgewinn (Verkauf+Ankauf) DC `-1` bei kleinen Unternehmungen; erlaubt Umgehen von Zöllen/Kontrollen.
- **Tiefe Kriegskassen**: Kosten 10 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde. Effekt: Politische Schritte (Manipulieren) DC `-1` gegen städtische Behörden; Verteidigungsreaktion `+2` gegen feindliche Einflussnahme.
- **Schmuggelunternehmungen**: Kosten 12 Gold, 6 Einfluss; Unterhalt 2 Gold/Runde. Ertrag: `+1` teures RM/Runde **oder** `+1` teures SM alle 2 Runden.
- **Geheime Waffenarsenale** (Circel Stufe 2+): Kosten 16 Gold, 5 Einfluss; Unterhalt 2 Gold + 1 AK/Runde. Effekt: `+2` Kampfkraft; Zugang zu illegalem Waffenhandel; `+1 Gold/Runde` bei passenden Marktwürfen.
- **Vollstrecker zur Heuer**: Kosten 16 Gold, 8 Einfluss. Effekt: ungenutzte Protectoren/Schläger‑Kampfkraft wird am Rundenende `1:2` in Gold umgewandelt.

#### Besondere Einrichtungen — Kult

- **Fanatische Anhänger**: Kosten 4 Gold, 4 Einfluss; Unterhalt 1 Einfluss/Runde; Ertrag `+2` verdeckte Kampfkraft.
- **Suppenküchen sponsoren**: Kosten 4 Gold; Unterhalt 1 RM (Nahrung) per 4 Einfluss; Ertrag `+1 Einfluss` pro Stufe der Anhänger; bei Ereignis Hungersnot (Ereignisse **2/8/17/29**; stackt) zusätzlich `+2 permanenter Einfluss` und `+1` Anhängerstufe.
- **Initiation in den Kult**: Kosten 6 Gold, 6 Einfluss; Unterhalt 2 Einfluss/Runde. Effekt: Fachkräfte starten mit Loyalität `+1`; kann erneut durchgeführt werden für insgesamt `+2` Loyalität.
- **Geheime Kultstätte**: Kosten 8 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde; Ertrag `+2 Einfluss/Runde`; `+2` auf Verteidigung gegen städtische Angriffe.
- **Heilige Artefakte**: Rollenspiel‑Inhalt (RPG‑Only); für das Aufbausystem/Engine‑Scope aktuell **ignorieren**.
- **Mysten**: Kosten 12 Gold, 12 Einfluss; Unterhalt 6 Einfluss/Runde. Effekt: `+2` auf Wurf zum Anheuern von Klerikern oder Zauberern; neue Fachkräfte starten mit Loyalität `+1`.
- **Große Gemeinschaftsmahle / Armenfürsorge** (Kult Stufe 2+): Kosten 16 Gold, 8 Einfluss; Unterhalt 4 RM (Nahrung) + 1 (Tiere) + 2 Gold/Runde. Effekt: `+3 Einfluss/Runde`; `+1 permanenter Einfluss` (akkumulierend) alle 2 Runden.
- **Große Opferriten**: Unterhalt 12 RM Tiere **oder** 1 AK pro Runde; Ertrag `+1 ZK` (dämonisch) pro Runde.
- **Primärliturgie** (nur große Kulte): Kosten 40 Gold, 40 Einfluss; Unterhalt 2 Gold + 4 Einfluss/Runde. Effekt: rekrutiert automatisch eine einfache Kleriker‑Fachkraft alle **4 Runden** (ohne Kosten/Probe); neue Kleriker starten mit Loyalität `+2` (Rollenspiel‑Voraussetzungen werden ignoriert).

#### Besondere Einrichtungen — Handwerks-/Handelscollegien

- **Garantierte Qualitätsstandards** (bis zu 3×): Kosten 8 Gold, 2 Einfluss; Unterhalt 1 Gold/Runde. Ertrag: `+1` Sondermaterial/Runde (Produktionseffizienz). Zusätzlich: verbessert die Stufe einer produzierten Wareart einer einzelnen Werkstatt (billig→einfach oder einfach→teuer).
- **Interne Warenbörse**: Kosten 8 Gold, 3 Einfluss; Unterhalt 1 Gold/Runde. Effekt: `±1` auf Marktwürfe (Richtung wählbar).
- **Repräsentationsräume**: Kosten 12 Gold, 2 RM (teures Material); Unterhalt 2 Gold/Runde. Ertrag: `+1 Einfluss/Runde`; Vorteil: senkt Einflussgewinn‑DC um `-1` (kleine Aktionen).
- **Collegiumsprozessionen** (Collegium Stufe 2+): Kosten 12 Gold, 5 Einfluss; Unterhalt 2 Gold + 1 AK/Runde. Ertrag: `+2 Einfluss/Runde` und Collegiumsstufe.
- **Anwerben von Fachkräften**: Kosten 18 Gold, 5 Einfluss; Unterhalt 3 Gold/Runde. Effekt: `-4` auf den **Anwerben‑Check** für Handwerker‑Fachkräfte; zusätzlich: alle 4 Runden kann 1 einfache Handwerker‑Fachkraft zum halben Preis angeworben werden (ohne Probe).

### Ämter (Einrichtungen — Übersicht, Soll)

#### Allgemeine Einrichtungen der Ämter (Cap)

- Cap: bis zu **2/3/4** allgemeine Einrichtungen pro Amt (klein/mittel/groß).

#### Allgemeine Einrichtungen (Auswahl)

Kleines Amt:
- **Regelmäßige politische Gefälligkeiten**: Kosten 10 Gold; Unterhalt 1 Einfluss/Runde. Effekt: senkt Kosten für Politische Schritte und Einflussgewinn um `-1 Einfluss` und `-1 Gold`.
- **Zusätzliche Schreibstuben anmieten**: Kosten **4 Gold**; Unterhalt: **1 Gold alle 2 Runden**. Effekt: reduziert die Kosten anderer Einrichtungen dieses Amtes dauerhaft um `-2 Gold` und `-2 Einfluss` je Einrichtung.
- **Klienten als Botenläufer und Amtsdiener**: Voraussetzung: mind. **1** Stufe Klienten/Anhänger/Pächter. Kosten 8 Gold. Unterhalt: `1 AK` **oder** `1 Gold` pro Runde. Effekt: `+1` auf Politische Schritte; `+1` auf Verteidigungsproben gegen Intrigen; zusätzlich `+1 Information` alle 4 Runden.
- **Rekrutierung fähiger Subalterne**: Kosten 8 Gold, 8 Einfluss; Unterhalt 2 Gold + 2 Einfluss/Runde. Ertrag `+1 AK`; Effekt: `+1` auf Fachkraft‑Anwerben; neue Fachkräfte Loyalität `+1`.

Ab mittlerem Amt:
- **Reiche Repräsentationsräume, Amtssiegel und Trachten**: Kosten 15 Gold, 2 RM (teures Material); Unterhalt 2 Gold/Runde. Ertrag `+1 Einfluss/Runde`; Vorteil: senkt Einflussgewinn‑DC um `-1` (alle).
- **Sonderarchiv**: Kosten 12 Gold, 1 AK; Unterhalt 1 Gold/Runde. Effekt: `+2` auf Verteidigungsproben gegen Intrigen; senkt Kosten für Politische Schritte: **Informationsgewinn** um `-2 Gold`.
- **Griff in die Kassen** (einmalig): Kosten 12 Einfluss; Effekt `+1` Bonusaktion Geldgewinn (max 2 Investitionen); Nachteil: `+4 DC` auf politische Aktionen und Einflussgewinn in der nächsten Runde.
- **Legitimat als Berater**: Kosten 18 Gold, 1 Fachkraft (Jurist/Anwalt); Unterhalt 4 Gold/Runde. Effekt: Bonusreaktion auf politische Reaktionen (rechtliche Angelegenheiten).
- **Ämterverkauf** (ab mittlerem Amt): Kosten 30 Einfluss. Effekt:
  - ab mittlerem Amt: `+4` Einfluss **oder** Gold pro Runde (läuft immer gemeinsam mit der Gold/Einfluss‑Wahl des Amtes)
  - Nachteil: Kosten von Einrichtungen **dieses** Amtes dauerhaft `+2 Gold` **oder** `+4 Einfluss` (Wahl beim Kauf)
  - Großes Amt: Vorteil und Nachteil sind **verdoppelt**
- **Administrative Reformen**: Kosten 20 Gold, 40 Einfluss; Voraussetzung: mind. 2 Ämter; Unterhalt 2 Gold/Runde. Effekt: erlaubt 50:50‑Kombination aus Gold‑ und Einfluss‑Ertrag je Amt.

#### Amtspezialisierungen & besondere Einrichtungen

- Ämter sind **immer spezialisiert** (Spezialisierung wird beim Erwerb gewählt).
- Allgemeine Einrichtungen (Cap): bis zu **2/3/4** pro Amt (klein/mittel/groß).
- Besondere Einrichtungen der Spezialisierung (Cap): pro Amt bis zu **1/2/3** (klein/mittel/groß).

Grundregeln (Soll):
- Fokus ist ab **mittlerem Amt** wählbar; bei **großem Amt** sind Fokus‑Erträge i.d.R. **verdoppelt**.
- DC‑Senkungen aus Posten/Einrichtungen sind stets auf **max. `-4`** begrenzt (Gesamtsumme).

##### Spezialisierung: Kirchenaufsicht

- Effekt (Basis): `+1 Einfluss/Runde`; senkt DC für **kleine** und **mittlere** Einflussgewinn‑Aktionen um `-1`.
- Fokus (ab mittlerem Amt; bei großem Amt verdoppelt):
  - **Städtische Garden & Gerichte**: Ertrag `+2 Einfluss/Runde`; Unterhalt `1 AK`. Vorteil: erhöht Sicherheit städtischer Einrichtungen; zusätzlich `+1 Einfluss` pro Stufe/Runde eines Circels: Unterweltcircel oder Handwerkscircel/Handelscollegium.
  - **Kirchliches Vermögen**: Ertrag `+1 Gold/Runde` pro **250** Pächter/Untertanen (max. `+8 Gold`).
  - **Ritus, Seelsorge & Fürsorge**: Ertrag `+1 Einfluss/Runde`; zusätzlich `+1` **permanente AK** pro **500** Pächter/Untertanen unter deiner Kontrolle.
- Besondere Einrichtungen (Kirchenaufsicht):
  - **Verstärkte Kultüberwachung**: Kosten 6 Gold, 2 Einfluss; Unterhalt 1 Gold + 1 AK/Runde. Effekt: `+2 Einfluss/Runde`; Politische Schritte: Gegner beschädigen DC `-1` (klein); zusätzlich `+2 Einfluss` pro Stufe eines Circels: Kult.
  - **Vergabe kirchlicher Kredite**: Kosten 8 Gold. Effekt: Geldgewinn: Geldverleih DC `-1` für **mittlere** Investments; Einflussgewinn: temporärer Einfluss DC `-1` für **kleine** Investments.
  - **Klosterkontakte**: Kosten 8 Gold. Effekt: `+1` permanente AK; max. **2×** pro Amtsstufe.
- Ab großem Amt:
  - **Große Prozessionen/Opferfeste**: Kosten 14 Gold, 8 Einfluss; Unterhalt 1 Gold + 1 AK + 2 teure RM (Tiere)/Runde. Effekt: `+6 Einfluss/Runde`.
  - **Armenhäuser & Hospital**: Kosten 14 Gold, 8 Einfluss, 1 AK; Unterhalt 2 Gold + 1 AK + 4 RM (Nahrung)/Runde. Effekt: `+1` permanenter Einfluss/Runde (akkumulierend); zusätzlich `+1` permanente AK pro 500 Pächter/Untertanen.
  - **Förderung des echten Klerus**: Kosten 20 Gold, 12 Einfluss. Effekt: Anwerben von **Kleriker‑Fachkräften** kostet `-5 Gold` (min. `0`).
  - **Allianz mit Kirchenoberhaupt**: Kosten 18 Gold, 12 Einfluss (permanent); Unterhalt 2 Gold/Runde. Ertrag `+2 Einfluss/Runde`; Vorteil: Politische Schritte: Manipulieren (Klerus) `-2 DC`.

##### Spezialisierung: Städtische Verwaltung

- Effekt (Basis): `+1 Einfluss` **oder** `+1 Gold` pro Runde pro **500** Pächter; senkt DC für Politische Schritte (klein) um `-1`.
- Fokus (ab mittlerem Amt; bei großem Amt verdoppelt):
  - **Bau & Infrastruktur**: Ertrag `+2 RM` (Bauholz oder Ziegel) pro Runde. Vorteil: Kosten für Bau/Ausbau von Stadtbesitz & städtischen Einrichtungen `-10%`.
  - **Magnat**: Ertrag `+1 Einfluss/Runde`; Unterhalt `1 AK`. Vorteil: Einflussgewinn‑DC für **mittlere** Unternehmungen `-1`; zusätzlich `+1 Einfluss` pro Stufe/Runde eines Unterweltcircels.
  - **Handel & Märkte**: Ertrag `+1 Gold/Runde` pro Stufe eigener Handelsunternehmungen. Vorteil: Geldgewinn‑DC für **mittlere** Unternehmungen `-1`.
  - **Handwerk & Produktion**: Ertrag `+1 SM` (beliebiges billiges/einfaches SM) pro Runde. Vorteil: Unterhalt von Werkstätten im städtischen Besitz `-1 Gold`.
  - **Zölle & Steuern**: Ertrag `+2 Gold/Runde`.
- Besondere Einrichtungen (Städtische Verwaltung):
  - **Arbeitsdienste organisieren**: Kosten 4 Gold. Effekt: `+1` permanente AK; max. **2×** pro Amtsstufe. Zusätzlich: `+1 Einfluss` pro Stufe eines Handwerkscircels.
  - **Vergabe von Sondererlaubnissen**: Kosten 8 Gold. Effekt: `+2 Gold/Runde`; Einflussgewinn: temporärer Einfluss (klein) DC `-1`.
  - **Zollaufsicht**: Kosten 10 Gold, 2 Einfluss, 1 AK. Unterhalt: `1 Gold` **oder** `1 Einfluss` (Wahl). Effekt:
    - `+1/-1` auf den **lokalen Marktwurf** (Richtung wählbar)
    - Ertrag: `+3` Gold **oder** `+3` Einfluss pro Runde (immer das **Gegenteil** des gewählten Unterhalts)
  - **Katasterprüfungen**: Kosten 12 Gold, 4 Einfluss, 1 Fachkraft (Baumeister). Effekt: Bau/Ausbau von Stadtbesitz & städtischen Einrichtungen: Kosten `-2 Gold` je Bau.
- Ab großem Amt:
  - **Netzwerk städtischer Kontakte**: Kosten 12 Gold, 8 Einfluss, 1 Fachkraft (Politiker). Unterhalt 2 Gold + 1 Einfluss/Runde. Ertrag `+1 Gold` + `+1 Einfluss`/Runde; Vorteil: Posten gewinnen (Circel/Collegien) `-2 DC`; Frühwissen (Ereignisse/Entwicklungen; narrativ).
  - **Curator von Stadteinrichtungen**: Kosten 16 Gold, 8 Einfluss, 1 Fachkraft (Verwalter). Unterhalt 1 Gold + 1 AK/Runde. Effekt: `+3 Einfluss/Runde`.

##### Spezialisierung: Hof- & Ehrenämter

- Effekt (Basis): senkt DC für **mittlere & große** Einflussgewinn‑Aktionen und Posten‑Gewinnen um `-1`.
- Fokus (ab mittlerem Amt; bei großem Amt verdoppelt):
  - **Hofhaltung**: Ertrag `+2 Einfluss` **oder** `+2 Gold`/Runde. Vorteil: Politische Schritte (mittel/groß) `-1 DC`.
  - **Repräsentation & Zeremoniell**: Ertrag `+2 Einfluss/Runde` und pro Stufe der Privatbastion (Privatbastionen: WIP).
  - **Magisches Zeremoniell**: Ertrag `+1 ZK/Runde`; senkt DC für magische Rituale/Verzauberungen um `-1` (Meta; WIP).
- Besondere Einrichtungen (Hof- & Ehrenämter):
  - **Fälschen von Privilegien**: Kosten 10 Gold, 2 Einfluss. Unterhalt `2 Einfluss` **oder** `2 Gold`/Runde. Ertrag `+2 Gold` **oder** `+2 Einfluss`/Runde (immer das Gegenteil des Unterhalts).
  - **Neue Titel etablieren**: Kosten 10 Gold, 4 Einfluss. Vorteil: Posten gewinnen: kleine Ämter kosten `-2 Gold` und `-1 Einfluss`.
  - **Prunkgemächer renovieren**: Kosten 15 Gold, 2 teure RM, 2 teure SM. Unterhalt 2 Gold/Runde. Effekt: `+2 permanenter Einfluss/Runde` zusätzlich zum Fokus‑Bonus; senkt DC für **große** Einflussgewinn‑Aktionen um `-1`.
  - **Exklusiver Zirkel**: Kosten 20 Gold, 15 Einfluss. Ertrag `+1 ZK` **oder** `+2 Einfluss`/Runde. Vorteil: `+1` Bonusaktion Politische Schritte jede zweite Runde.
- Ab großem Amt:
  - **Empfänge ausrichten**: Kosten 30 Gold, 20 Einfluss, 1 Fachkraft (Verwalter). Unterhalt 3 teure RM + 1 teure SM/Runde. Ertrag `+1` permanenter Einfluss (akkumulierend) alle 2 Runden; Vorteil: Posten gewinnen: mittlere Ämter kosten `-5 Gold` und `-5 Einfluss`.
  - **Vertrauter des Herrschers**: Kosten 30 Gold, 30 Einfluss (permanent). Unterhalt 6 Einfluss/Runde. Ertrag `+1` permanenter Einfluss/Runde (akkumulierend). Vorteil: Intervention 1× pro 5 Runden (narrativ).
  - **Kontakte zum Horashof**: Kosten 40 Gold, 40 Einfluss, 1 Fachkraft (Politiker). Unterhalt 4 Einfluss + 4 Gold/Runde. Effekt: `+1` Bonusaktion Einfluss gewinnen pro Runde; Politische Schritte (groß) `-1 DC`; Posten gewinnen: mittlere & große Ämter kosten `-10 Gold` und `-10 Einfluss`.

##### Spezialisierung: Provinzverwaltung & Landaufsicht

- Effekt (Basis): `+1 AK/Runde`; senkt DC für Materialgewinn: Domänenverwaltung um `-1`.
- Fokus (ab mittlerem Amt; bei großem Amt verdoppelt):
  - **Domänen‑Administration**: Ertrag `+8 RM` (beliebiges billiges/einfaches RM aus Landwirtschaft) pro Runde.
  - **Zoll- & Steuerverwaltung**: Ertrag `+1 Gold/Runde` pro 500 Pächter/Untertanen.
  - **Infrastruktur & Logistik**: Ertrag `+1 Gold/Runde` pro Domäne im Besitz des Spielers; Vorteil: erleichtert Materialtransport; „Wegezoll & Lagerhäuser“ ist aktuell **Flavour** (keine Zusatzregeln).
- Besondere Einrichtungen (Provinzverwaltung):
  - **Stundung der Abgaben**: Kosten 8 Einfluss. Ertrag `+2 Einfluss/Runde`.
  - **Prospektor‑Berichte**: Kosten 8 Gold, 1 Fachkraft (Aufseher). Unterhalt 1 Gold + 1 AK/Runde. Effekt: `+1 RM` (beliebiges einfaches/teures RM aus Bergbau‑Domänen) pro Runde zusätzlich zum Fokus‑Bonus.
  - **Zwangsumsiedelungen**: Kosten 8 Gold, 8 Einfluss. Effekt: `+250` Pächter/Untertanen pro Amtsstufe.
  - **Arbeitsdienste umleiten**: Kosten 10 Gold, 6 Einfluss. Unterhalt 1 Gold/Runde. Effekt: `+2 RM` (billiges/einfaches Landwirtschafts‑RM) pro Runde; senkt DC Domänenverwaltung um `-1`.
  - **Steuerprivilegien erfinden**: Kosten 12 Einfluss; Unterhalt 1 Einfluss/Runde. Vorteil: Domänen‑Unterhalt `-2 Gold`.
- Ab großem Amt:
  - **Neue Landvermessungen**: Kosten 10 Gold, 10 Einfluss. Unterhalt 1 Gold + 1 AK/Runde. Effekt: Domänenkauf kostet `-10 Gold`.
  - **Staatliche Lagerhäuser nutzen**: Kosten 15 Gold, 1 AK. Unterhalt 1 Gold/Runde. Effekt: `+1` mittleres Lager (kostenlos, ohne Caps) pro Amtsstufe.
  - **Staatliche Werkstätten nutzen**: Kosten 15 Gold, 1 AK. Unterhalt 1 Gold/Runde. Effekt: `+1` mittlere Werkstatt (kostenlos, ohne Caps) pro Amtsstufe.
  - **Staatliche Arbeitsdienste nutzen**: Kosten 30 Gold, 30 Einfluss. Effekt: `+1` Bonusaktion Materialgewinn: Domänenverwaltung.

##### Spezialisierung: Offiziersposten

- Effekt (Basis): `+1` Kampfkraft/Runde (permanent); senkt DC für militärbezogene Aktionen um `-2` (Meta; WIP).
- Fokus (ab mittlerem Amt; bei großem Amt verdoppelt):
  - **Shinxirgarde & Söldner**: Ertrag `+1 Gold` + `+1` permanente Kampfkraft pro 500 Pächter/Untertanen im städtischen Besitz. Vorteil: erhöht Sicherheit der Domänen.
  - **Militärverwaltung**: Ertrag `+1 Gold/Runde`.
  - **Offizier der horasialen Taxiarcha**: Ertrag `+1 Einfluss` + `+1` Kampfkraft/Runde.
- Besondere Einrichtungen (Militär):
  - **Private Waffensammlung**: Kosten 4 Einfluss. Unterhalt 1 Gold/Runde. Effekt: `+1` Kampfkraft der Leibgarde; besondere Waffen (narrativ).
  - **Soldaten abwerben**: Kosten 8 Einfluss. Unterhalt 1 Gold/Runde. Effekt: `+1` Kampfkraft für die Leibgarde.
  - **Versorgungskontrakte verhandeln**: Kosten 8 Einfluss. Effekt: `+1 Gold/Runde`; zusätzlich erhält jede Aktion **Geldgewinn: Ankauf & Verkauf** einen Flat‑Bonus von `+1d4 Gold` auf das Ergebnis.
  - **Versorgungsgüter abzweigen**: Kosten 8 Einfluss. Effekt: `+2` einfache RM/Runde.
- Ab großem Amt:
  - **Söldnerkontrakte verhandeln**: Kosten 12 Einfluss. Wahl: `+3 Gold` **oder** `+3 Einfluss`/Runde. Unterhalt: `2 Gold` **oder** `2 Einfluss`/Runde (immer das Gegenteil). Vorteil: Unterhalt von Söldner‑Truppen wird um `-1 Gold` pro Einheit reduziert.
  - **Permanenter Stab**: Kosten 15 Gold, 1 Fachkraft (Militärberater). Unterhalt 2 Gold/Runde. Effekt: `+4 Kampfkraft`; Boni auf militärische Planung/Führung.
  - **Staatliche Arsenale nutzen**: Kosten 15 Gold, 1 AK. Unterhalt 1 Gold/Runde. Effekt: `+1` kleines Lager (kostenlos) pro Amtsstufe.
  - **Staatliche Werkstätten nutzen**: Kosten 15 Gold, 1 AK. Unterhalt 1 Gold/Runde. Effekt: `+1` kleine Werkstatt (kostenlos) pro Amtsstufe.
  - **Kommando über Proionare**: Kosten 20 Gold, 20 Einfluss. Ertrag: `+1` permanente Kampfkraft pro **500** Pächter/Untertanen in deinen Domänen. Vorteil: Sicherheit in Domänen: `+1` auf jede Verteidigungsprobe je Domäne.

### Handelsunternehmungen (Einrichtungen — Übersicht, Soll)

#### Allgemeine Einrichtungen (Auswahl)

- **Günstige Abnahmeverträge**: Kosten 8 Gold, 2 Einfluss; Unterhalt 1 AK/Runde. Effekt: senkt Geldgewinn‑DC (Verkauf) um `-1` bei kleinen Investitionen.
- **Mieten von Lagerplätzen**: Kosten 10 Gold, 1 AK (einmalig); Unterhalt 1 AK/Runde. Effekt: Lagerung von `10 RM` oder `5 SM` pro Handelsunternehmungsstufe (slotfrei; zusätzlich zu Lagern).
- **Schreibstuben**: Kosten 8 Gold, 1 AK; Unterhalt 1 Gold/Runde. Effekt: `-1 DC` auf Geldgewinn (Ankauf/Verkauf); reduziert Kosten für Handelsunternehmungs‑Ausbauten um `-2 Gold` pro Stufe.
- **Missionen zu den Mächtigen**: Kosten 15 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde. Ertrag: `+2 Einfluss/Runde` und Stufe der Unternehmung.

Ab mittlerer Handelsunternehmung:
- **Honoratische Handelsagenten**: Kosten 15 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde. Ertrag `+2 Einfluss/Runde` und Stufe; Vorteil: `-1 DC` auf kleine/mittlere Politische Schritte.
- **Konstante Handels‑Missionen**: Kosten 16 Gold, 4 Einfluss; Unterhalt 2 Gold + 1 RM/Runde. Effekt: `+2 Gold` und `+2 Einfluss` pro Runde.
- **Investitionsgemeinschaft**: Kosten 20 Gold, 10 Einfluss; Unterhalt `+2 Gold + 2 Einfluss` pro Runde. Effekt: erhöht maximale Investitionen bei Geldverleih um `+1` pro Handelsunternehmungsstufe.
- **Handelskarawane** (mittlere allgemeine Einrichtung; benötigt mittlere Handelsunternehmung):
  - Kosten: **10 Gold**, **10 RM** (Vorräte/Ausstattung), `2` Lasttiere
  - Unterhalt: `1` Fachkraft (Händler), `1 AK`, `1 KK` (Söldner), `1 Gold` pro Runde
  - Ertrag: alle **3 Runden** Wahl:
    - `+4` teure SM (davon `2` nach Wahl, `2` zufällig), **oder**
    - Investment: `1` einfaches SM **oder** `8` einfache RM → `+15 Gold` (Auszahlung alle 3 Runden)
- **Regionaler Handelsstützpunkt**: Kosten 20 Gold, 12 Einfluss; Unterhalt 3 Gold + 1 SM (teures Material)/Runde. Ertrag `+2 Einfluss/Runde`; `+1` Absatzmarkt (zusätzlicher Markt).

Nur große Handelsunternehmung:
- **Lokales Warenmonopol**: Kosten 40 Gold, 30 Einfluss; Unterhalt 4 Gold + 4 Einfluss/Runde. Effekt: Kontrolle über Warengruppe; `+1d8 Gold/Runde` im Marktsystem; `+1` Bonusaktion Geldgewinn: Verkauf alle 2 Runden.

#### Besondere Einrichtungen (Handelsunternehmungen)

- Cap: bis zu **3** besondere Einrichtungen pro Stufe der Handelsunternehmung.
- Unterhalt-Skalierung (Soll): Unterhalt besonderer Einrichtungen kann sich pro Schiff erhöhen (`+1` Unterhalt alle 2 Schiffe).

- **Handelsschiff**:
  - Kosten: 1 Fachkraft (Kapitän), 20 Gold, 30 RM (Bauholz), 6 SM (Werkzeug, Tuch)
  - Unterhalt: 3 AK + 2 Gold
  - Ertrag:
    - `+5` Kampfkraft zur See (solange Schiff aktiv)
    - alle **2 Runden** Wahl:
      - `+4` Sondermaterial, **oder**
      - investiere je `4` Sondermaterial → `+16 Gold` (Auszahlung alle 2 Runden)

### Truppen (Einrichtungen — Soll)

Hinweis: Truppen‑Einrichtungen sind an einen Standort/Posten gebunden (Domäne, Stadtbesitz, Organisation etc.) und wirken für die dort stationierten Einheiten.

#### Allgemeine Truppeneinrichtungen (für alle Truppentypen)

- **Loyalität sichern**: Kosten 8 Gold, 5 Einfluss. Effekt: `+1` auf Loyalität für die Runde.
- **Waffenkammer**: Kosten 10 Gold, 4 RM (Waffen). Effekt: `+1` offene Kampfkraft pro **2** Truppenstufen am Standort (gilt für alle Truppentypen dort); Cap: max. `+4` offene Kampfkraft (bei 16 Truppenstufen).
- **Unterkünfte**: Kosten 12 Gold, 6 RM (Bauholz/Ziegel); Unterhalt 1 Gold/Runde. Effekt: reduziert Unterhalt um `-1 Gold` pro 2 Kampfkraftstufen; bei Überraschungsangriff `+2` Kampfkraft erste Runde.
- **Erfahrene Ausbilder**: Kosten 18 Gold, 2 Fachkräfte (Kampftrainer); Unterhalt 3 Gold/Runde. Effekt: `+1` Kampfkraft für alle Truppentypen.

#### Mittlere Truppen‑Einrichtungen

- **Aktive Rekrutierung**: Kosten 14 Gold, 8 Einfluss; Unterhalt 1 Gold/Runde. Effekt: Rekrutierungskosten `-2 Gold` pro Einheit.
- **Veteranen‑Unterführer**: Kosten 16 Gold, 8 Einfluss; Unterhalt 3 Gold/Runde. Effekt: `+2` auf Kampfkoordinationsproben; `+1` Kampfkraft pro 2 Truppenstufen; zusätzlich **10%** Chance pro Runde, eine **einfache Handlanger‑Fachkraft** kostenlos und ohne Probe zu erhalten.
- **Feldscher und Wundärzte**: Kosten 20 Gold, 3 SM (Tränke/Elixire), 1 Fachkraft (Chirurg); Unterhalt 3 Gold + 1 SM (Tränke/Elixire)/Runde. Effekt: reduziert Verluste, beschleunigt Genesung (WIP; genaue Prozentwerte TBD).
- **Altenteile und Pensionskasse**: Kosten 25 Gold, 10 Einfluss; Unterhalt: 2 Gold pro Kampfkraftstufe alle **4 Runden**. Effekt: `+1` auf Loyalitätsproben; `-2 DC` auf Posten‑Gewinnen; Reserve: im Verteidigungsfall `+1` temporäre Kampfkraftstufe pro 4 reguläre Stufen.

#### Besondere Einrichtungen: Leibgarde / Haustruppen

- **Prunkrüstungen**: Kosten 8 Gold, 1 SM (teure Tuche) pro 2 Leibgardestufen. Effekt: `+2 Einfluss` pro 2 Leibgardestufen.
- **Göttliche Treueschwüre**: Kosten 8 Gold, 5 Einfluss. Effekt: `+2` auf Loyalitätsproben der Leibgarde; Überläuferrisiko = 0.
- **Spezialwaffen**: Kosten 10 Gold, 2 SM (Waffen); Unterhalt 2 Gold/Runde. Effekt: `+1` offene Kampfkraft pro Leibgardestufe; `+2` auf Verteidigungsproben.
- **Waffen- und Rüstungssiegel**: Kosten 15 Gold, 2 SM (Waffen); Unterhalt 2 Gold/Runde + 1 ZK. Effekt: wie Spezialwaffen; zusätzlich magische Qualität.
- **Elite der Garde**: Kosten 15 Gold, 5 Einfluss, 1 Fachkraft (Waffenmeister); Unterhalt 2 Gold/Runde. Effekt: 10er‑Einheit wird Elite (zählt als 2 Leibgardestufen); Voraussetzung: mind. 4 Leibgardestufen.
- **Berittene Garde** (mehrmals): Kosten 20 Gold, 2 teure RM (Pferde) pro Leibgardestufe; Unterhalt 4 Gold + 2 Nahrung/Runde pro Leibgardestufe. Effekt: `+2` offene Kampfkraft pro Leibgardestufe; `+1` Bonusreaktion bei Überfällen.
- **Magische Waffenkammer**: Kosten 30 Gold, 4 SM (magische Paraphernalia), 1 Fachkraft (Magier); Unterhalt 4 Gold + 1 ZK + 1 SM (magische Paraphernalia)/Runde. Effekt: `+3` Kampfkraft pro 2 Leibgardestufen; wirksam gegen magische Gegner. Voraussetzung: Cammer/Zugang zu magischen Ressourcen.

#### Besondere Einrichtungen: Milizen

- **Waffenübungen**: Kosten 3 Gold, 1 AK. Effekt: `+1` offene Kampfkraft pro 4 Milizstufen.
- **Schützenwettbewerbe**: Kosten 2 Gold; Unterhalt 1 SM (Wein/Brandt) + 1 SM (Nahrung) pro 4 Milizeinheiten. Effekt: `+1` offene Kampfkraft pro 4 Milizstufen.
- **Allgemeine Waffenpflicht**: Kosten 3 Gold, 3 Einfluss, 2 SM (Waffen); Unterhalt 1 Einfluss/Runde. Effekt: erhöht Miliz‑Cap um `+1` pro 250 Pächter/Untertanen; einmal pro 5 Runden Notfall‑Mobilisierung `+1` Milizstufe für 2 Runden.
- **Wach- und Glockentürme**: Kosten 4 RM (Bauholz), 1 einfaches SM (Bronzewaren) pro Domäne; Unterhalt –. Effekt: `+2` auf Verteidigungsproben gegen Überfälle + Frühwarnvorteile für alle Domänen; Gegner‑DC für Politische Schritte: Beschädigen (Domäne) `+1`.
- **Gewählte Kentiarchen**: Kosten 8 Gold, 1 Fachkraft (Veteran); Unterhalt 2 Einfluss/Runde. Effekt: `+1` offene Kampfkraft pro 2 Milizstufen; Voraussetzung: mind. 3 Milizstufen.
- **Regelmäßige Patrouillen**: Kosten 6 Gold, 2 AK; Unterhalt 1 Gold + 1 AK/Runde. Effekt: verringert Wahrscheinlichkeit von Überfällen/Schmuggel.
- **Erbprivilegien & Pronoia**: Kosten 16 Gold, 10 Einfluss; Unterhalt 2 Gold + 4 Einfluss/Runde. Effekt: `+1` offene Kampfkraft pro 4 Milizstufen; `+2 LO`. Besonderheit: alle 5 Runden entsteht 1 kostenloser einfacher Handlanger (Fachkraft).

#### Besondere Einrichtungen: Söldner

- **Feste Lager**: Kosten 8 Gold, 4 RM (Bauholz). Effekt: reduziert Unterhalt einer Söldnereinheit um `-1 Gold`; Kapazität: 2× 25er‑Einheiten pro Domäne/Stadtbesitz.
- **Regelmäßige Kontrakte**: Kosten 12 Einfluss; Unterhalt 1 Einfluss/Runde. Effekt: `+2 Gold` pro Söldnerstufe und Runde.
- **Plünderungsrecht & Beuteanteil**: Kosten 10 Gold, 10 Einfluss; Unterhalt 4 Einfluss/Runde. Effekt: reduziert Unterhalt einer Söldnereinheit um `-1 Gold`; Voraussetzung: mind. 2 Söldnerstufen.
- **Späher & Botenreiter**: Kosten 10 Gold, 2 SM (Waffen); Unterhalt 2 Gold/Runde. Effekt: `+2` verdeckte Kampfkraft; Besonderheit: Hinterhaltvorbereitung `+3` Kampfkraft in der ersten Kampfrunde.
- **Quartier & Zahlmeister**: Kosten 20 Gold, 1 AK; Unterhalt 2 Gold/Runde. Effekt: reduziert Unterhalt aller Söldnereinheiten um `-1 Gold`; erhöht max. Anzahl Söldnereinheiten um `+2`.
- **Brutale Zuchtmeister**: Kosten 18 Gold, 10 Einfluss, 1 Fachkraft (Zuchtmeister); Unterhalt 2 Gold/Runde. Effekt: `+2` offene Kampfkraft.
- **Rekrutierung von Barbaren**: Kosten 25 Gold, 8 Einfluss; Unterhalt 4 Gold/Runde. Effekt: ermöglicht Barbaren‑Einheiten; `+2` offene Kampfkraft pro Barbareneinheit (25 Mann).
- **Feldkleriker/Kampfpriester**: Kosten 15 Gold, 12 Einfluss, 1 Fachkraft (Priester); Unterhalt 2 Gold + 1 Einfluss/Runde. Effekt: `+1 LO`; `+1` Kampfkraft pro 3 Truppenstufen; Besonderheit: Segen vor Schlacht `+2` (1 Runde).

#### Besondere Einrichtungen: Protectoren / Schläger (inkl. Kult)

- **Persönliches Schutzgeldsystem**: Kosten 8 Gold, 6 Einfluss; Unterhalt 1 Einfluss/Runde. Effekt: reduziert Unterhalt einer Söldnereinheit um `-1 Gold`.
- **Blutbruderschaft‑Zeremonie**: Kosten 8 Gold, 8 Einfluss. Effekt: `+1 LO`.
- **Kampfgrube**: Kosten 10 Gold, 3 RM (Bauholz); Unterhalt 2 Gold/Runde. Effekt: `+1` offene Kampfkraft.
- **Loyalität durch Blut**: Kosten 12 Gold, 8 Einfluss; Unterhalt 2 Einfluss/Runde. Effekt: `+1` auf Loyalitätsproben.
- **Gefürchtete Vollstrecker**: Kosten 10 Gold, 10 Einfluss; Unterhalt 3 Gold + 2 Einfluss/Runde. Effekt: 25er‑Einheit wird Elite (zählt als 2 Protektorenstufen für verdeckte Kampfkraft); Voraussetzung: mind. 2 Protektorenstufen.
- **Mystische Initiationsrituale** (nur Kult): Kosten 18 Gold, 3 SM (magische Paraphernalia), 1 Fachkraft (Schamane); Unterhalt 2 SM (magische Paraphernalia) pro 6 Runden. Effekt: `+2` auf Kampfproben, `+3` auf Schmerzresistenzproben.
- **Hüter des Sanktums** (nur Kult): Kosten 20 Gold, 15 Einfluss, 2 SM (goldene Reliquien); Unterhalt 4 Gold + 4 Einfluss/Runde. Effekt: `+2` verdeckte Kampfkraft.
