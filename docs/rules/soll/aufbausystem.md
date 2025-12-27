# Myranor Aufbausystem (Soll) — Source of Truth

Status: canonical (Soll)

Dieses Dokument beschreibt das **intendierte Regelsystem** (Soll). Wenn wir Regeln ändern wollen, geschieht das **hier** (Docs zuerst).

Implementations-Stand (Engine v1): `docs/rules/rules-v1.md`  
Änderungshistorie (Change Documents): `docs/rules/soll/changes/README.md`

## Startbedingungen

Jeder Spieler startet mit:

1) **Ausbaubedürftige ländliche Domäne** (Startdomäne)  
   - Ertrag pro Runde: **2 AK**, **8 RM** (Ausnahme gegenüber normaler kleiner Domäne)  
   - Produktion festlegen: **2 RM‑Arten** (1× billig, 1× einfach); **keine** RM‑Art mit Bonus‑Gold beim Verkauf (`saleBonusGold`)  
   - Ausbau (freie Aktion „Einrichtungen errichten/ausbauen“): **8 Gold** + **4 AK** → wird zu einer **kleinen Domäne**
2) **2 permanente Arbeitskraft** (Arbeitsdienste der Untertanen)
3) **1 kleine Werkstatt** als (Sonder‑)Einrichtung der Startdomäne (nimmt **keinen** Domänen‑Einrichtungs‑Slot)
4) **1 kleines Lager** als (Sonder‑)Einrichtung der Startdomäne (nimmt **keinen** Domänen‑Einrichtungs‑Slot)
5) **1 kleiner städtischer Besitz**, Startmodus: **verpachtet**
6) **1 kleines Amt**, Startmodus: **Einflussgewinn**
7) **4 Gold**

## Rundenablauf

Der Ablauf jeder Runde besteht aus:

1) **Global** (einmal pro Runde, gilt für alle Spieler)  
2) **Pro Spieler** (der Reihe nach)

### Global: Ereignisphase + Marktphase

#### Ereignisphase

- Ab **Runde 2** werden zu Beginn jedes Ereignis-Abschnitts **2 Ereignisse** aus der Zufallstabelle gewürfelt.
- Ein Ereignis-Abschnitt dauert **4 Runden** (Beispiel: R2–R5, R6–R9, …).
- Beide Ereignisse gelten für **alle Spieler** (sofern nicht anders angegeben).

#### Marktphase

- Zu Beginn jedes Markt-Abschnitts wird je **1× Rohmaterial-Markt** und **1× Sondermaterial-Markt** gewürfelt (Markttabellen).
- Ein Markt-Abschnitt dauert **4 Runden** (Beispiel: R1–R4, R5–R8, …); danach wird neu gewürfelt.
- Der **Startmarkt** gilt für **alle Spieler**.
- Später können Spieler durch Posten/Einrichtungen **zusätzliche Märkte** freischalten, die nur für sie gelten und separat gewürfelt werden.

### Pro Spieler: Phasen 1–4

#### 1) Ressourcenphase (Reset & Ausschüttung)

- **Reset** der temporären Pools (Arbeitskraft, Kampfkraft, Einfluss) für diese Runde.
- **Ausschüttung** erneuerbarer Ressourcen aus Posten, Einrichtungen und anderen Quellen.
- Bei **Wahl-Erträgen** (z.B. Ämter: **Gold oder Einfluss**) legt der Spieler hier fest, was er in dieser Runde erhält.
- **Runden-verzögerte** Ressourcen werden hier freigegeben.
- Ressourcen sind – mit Ausnahme von **Gold** – **temporär**.

#### 2) Unterhaltsphase

- Ab **Runde 2** werden Unterhaltskosten am **Anfang jeder Runde** bezahlt.
- Unterhalt kann Kosten in **Gold** und/oder **Arbeitskräften** verursachen (je nach Posten/Einrichtung).
- Kann Unterhalt nicht bezahlt werden, **ruhen die Funktionen** der betroffenen Posten/Einrichtungen, bis Unterhalt wieder erbracht wird.

Zusätzlicher allgemeiner Unterhalt (ab Runde 2):
- Arbeitskräfte (AK) und Kampfkraft (KK) kosten:
  - **1 RM (Nahrung)** pro **4 AK / 2 KK**, **oder**
  - **1 Gold** pro **4 AK / 2 KK**.
- Untote Arbeits- und Kampfkräfte benötigen stattdessen **Zauberkraft** (Details/Skalierung TBD).

#### 3) Spieleraktionen

- Aktionen finden **zwischen Unterhaltsphase und Umwandlungsphase** statt.
- Pro Runde gibt es **2 Standardaktionen** (aus „Aktionen und Reaktionen“).
- Innerhalb der beiden Standardaktionen dürfen **keine zwei Aktionen wiederholt** werden.
  - Unteraktionen gelten **nicht** als dieselbe Aktion (Beispiel: „Einflussgewinn: permanent“ und „Einflussgewinn: temporär“ sind getrennt).
- Zusätzlich gibt es pro Runde **immer** die **freie Zusatzaktion „Einrichtungsausbau“**, die den Bau/Ausbau von Einrichtungen erlaubt, sofern Caps/Voraussetzungen erfüllt sind.
- Einrichtungen dürfen auch mit einer normalen Standardaktion erbaut werden.
- Bonusaktionen:
  - können erworben werden,
  - sind auf bestimmte **Unter-Aktionstypen** beschränkt,
  - dürfen auch dann eine Aktion ausführen, wenn sie in der Runde bereits ausgeführt wurde.

#### 4) Umwandlungsphase

- In dieser Phase werden temporäre Ressourcen umgewandelt.
- Umwandlungen geschehen meist durch Einrichtungen – vor allem Werkstätten – **sofern der Unterhalt bezahlt wurde**.
- Es kann auch andere Elemente geben, die Ressourcen umwandeln.

**Lager**
- Wenn ein Lager (in Domäne oder Stadtbesitz) unterhalten wird, können Rohmaterialien und Sondermaterialien bis zur Lagerkapazität gelagert werden und zerfallen nicht am Rundenende.

**Automatische Umwandlung (Rundenende)**
- Am Rundenende werden vorhandene, nicht verbrauchte temporäre Ressourcen erfasst und automatisch umgewandelt:
  - Rohmaterial, Arbeitskräfte und temporärer Einfluss: **4 Einheiten = 1 Gold**
  - Sondermaterial: **1 Sondermaterial = 2 Gold**
  - Werkstätten wandeln Rohmaterial automatisch nach ihrer Kapazität in Sondermaterial um.

**Ressourcen-Reset (Rundenende)**
- Arbeitskraft, Kampfkraft und Einfluss werden am Rundenende zurückgesetzt; die Pools der nächsten Runde basieren auf den aktuellen permanenten Posten/Quellen.

## Erfolgswürfe & Checks

### Grundprinzip

- Jede regelrelevante Aktion hat einen **Schwierigkeitsgrad (DC)**.
- Probe: `1w20 + Attributsmodifikator` gegen `DC`.
- Eine Probe gilt als **geschafft**, wenn das Ergebnis **mindestens** dem DC entspricht (`>= DC`).

### Attributsmodifikator (Progression)

- Start: **+3**
- Steigerung: voraussichtlich **alle 6 Runden +1**
- Default-Abbildung (Soll):
  - Runde 1–6: +3
  - Runde 7–12: +4
  - Runde 13–18: +5
  - …

### DC (Schwierigkeitsgrad) und Modifikatoren

- **Grund-DC** ist abhängig von Aktion/Unteraktion und dort angegeben.
- **Investitions-/Größen-Modifikator (Standard):**
  - Kleine Investition / kleiner Erwerb: DC unverändert
  - Mittlere Investition / mittlerer Erwerb: `+4` DC
  - Große Investition / großer Erwerb: `+8` DC
- Was als *klein/mittel/groß* gilt, ist in der jeweiligen Aktion definiert (z.B. über Anzahl Investitionen oder Tier des Ziels).

### DC-Senkungen (Cap)

- Manche Posten/Einrichtungen senken den DC für bestimmte Aktionen.
- **Die maximale DC-Senkung ist insgesamt auf `-4` begrenzt**, auch wenn mehrere Effekte zusammenkommen.

### Erfolgsskala

Für jede Probe wird anhand des Ergebnisses relativ zum DC eine Erfolgsstufe bestimmt:

- **Sehr gut geschafft**: Ergebnis ist `DC + 10` oder höher.
- **Gut geschafft**: Ergebnis ist `DC + 5` bis `DC + 9`.
- **Geschafft**: Ergebnis ist `DC` bis `DC + 4`.
- **Schlecht geschafft**: Ergebnis ist `DC - 5` bis `DC - 1`.
- **Fehlschlag**: Ergebnis ist **mehr als 5 Punkte** unter DC (`< DC - 5`).

Die konkreten Auswirkungen je Erfolgsstufe sind in den Aktionen angegeben.

## Aktionen (Kurzfassung)

Hinweise:
- Viele Aktionen arbeiten mit **Investitionen** (standardisierte “Einheiten” an eingesetzten Ressourcen).
- Bei “Unteraktionen” zählt z.B. `Einflussgewinn: temporär` nicht als dieselbe Aktion wie `Einflussgewinn: permanent` (für das “keine Wiederholung”-Limit der Standardaktionen).
- Beim Erwerb/Ausbau gelten zusätzlich die **Posten-Caps** aus `Permanente Posten (Soll)`.

### 1) Einflussgewinn

Beschreibung: Erhöhe deinen politischen und sozialen Einfluss durch Prunk, Feierlichkeiten, Bestechung, Spenden, Reden und Wohltätigkeit usw.

**Kosten / Investitionen**
- **Temporärer Einfluss**: `1 Gold` → `4 temporärer Einfluss` (= 1 Investition)
- **Permanenter Einfluss**: `2 Gold` → `1 permanenter Einfluss` (= 1 Investition; akkumuliert)

**Deckelung (Investitions-Caps)**
- Temporärer Einfluss:
  - max. **4** Investitionen ohne Amt/Circel/Collegium
  - max. **6** Investitionen mit kleinem Amt/Circel/Collegium
  - max. **8** Investitionen mit mittlerem Amt/Circel/Collegium
  - max. **12** Investitionen mit großem Amt/Circel/Collegium
- Permanenter Einfluss:
  - max. **2** Investitionen pro Runde
  - plus **1× pro Stufe** jedes erworbenen Amts/Circels/Collegiums (Klein/Mittel/Groß; jedes zählt separat)

**DC**
- Grund-DC: **12**
- Attribute: (WIS/INT/CHA)
- Investitionsgröße:
  - ab **8** Investitionen: **mittlere** Unternehmung (`+4 DC`)
  - ab **12** Investitionen: **große** Unternehmung (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge**
- Sehr gut geschafft: `+4 temporärer Einfluss` **oder** `+2 permanenter Einfluss` **pro Investition zusätzlich**
- Gut geschafft: `+2 temporärer Einfluss` **oder** `+1 permanenter Einfluss` **pro Investition zusätzlich**
- Geschafft: Standard-Ertrag (4 temp pro Invest; 1 perm pro Invest)
- Schlecht geschafft: nur **halber** Einfluss pro Investition (auf mindestens 1 runden)
- Fehlschlag: kein Gewinn; investiertes Gold ist verloren

### 2) Geldgewinn

Beschreibung: Erhöhe dein Gold durch Investitionen, Handel oder Verkauf von Materialien.

#### 2a) Geldverleih

**Kosten / Investitionen**
- Investiere `2 Gold` (= 1 Investition).

**Ertrag**
- Standard: `+4 Gold` pro Investition in der **nächsten Runde**.

**Deckelung**
- max. **2** Investitionen ohne permanente Handelsunternehmung
- max. **4** Investitionen bei kleiner Handelsunternehmung
- max. **6** Investitionen bei mittlerer Handelsunternehmung
- max. **10** Investitionen bei großer Handelsunternehmung

**Option: Sichere Anlage**
- Ab **2 Investitionen** wählbar:
  - erhalte **diese Runde** Einfluss (in **halber** Investment-Höhe),
  - erhalte den Goldgewinn erst **übernächste Runde**,
  - dafür `DC -2`.

**DC**
- Grund-DC: **14**
- Attribute: (INT/CHA)
- Investitionsgröße:
  - ab **4** Investitionen: **mittlere** Investition (`+4 DC`)
  - ab **8** Investitionen: **große** Investition (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge (Geldverleih)**
- Sehr gut geschafft: `+12 Gold` pro Investition (nächste Runde)
- Gut geschafft: `+8 Gold` pro Investition (nächste Runde)
- Geschafft: `+4 Gold` pro Investition (nächste Runde)
- Schlecht geschafft: Standard: verliere `1 Gold` pro Investition, erhalte `1 Gold` zurück
- Fehlschlag: Standard: Investition verloren

#### 2b) Verkauf und Ankauf von Materialien

**Kosten / Investitionen**
- Pro Investition kannst du **verkaufen oder kaufen**:
  - `6 Rohmaterial` **oder**
  - `1 Sondermaterial` **oder**
  - `1 temporäre Arbeitskraft (AK)`

**Deckelung (Investitions-Caps)**
- Start: max. **4** Investitionen ohne permanente Handelsunternehmung
- Cap-Erhöhung:
  - `+2` Investitionen pro Stufe (Klein/Mittel/Groß) einer permanenten Handelsunternehmung
  - `+1` Investition pro Stufe einer Domäne

**Besonderheit: Verkauf + Ankauf kombinieren**
- Verkauf und Ankauf können in derselben Unteraktion gemeinsam stattfinden (Gold-Gewinne/-Ausgaben werden verrechnet).
- Gekauftes Material steht erst in der **nächsten Runde** zur Verfügung.

**Markt / Ereignisse / Material-Boni**
- Beim **Verkauf** werden Boni aus Materialart (Gold-Bonus), Markttabelle(n) und Ereignistabelle berücksichtigt.
- Beim **Ankauf** werden Materialart und Marktlage **umgedreht**:
  - gefragte Ware wird **teurer** für den Käufer,
  - ein Gold-Bonus (`+X Gold`) wird zu zusätzlichen **Kosten** (`+X Gold`).

**DC**
- Grund-DC: **14**
- Attribute: (INT/CHA)
- Investitionsgröße:
  - ab **4** Investitionen: **mittlere** Investition (`+4 DC`)
  - ab **8** Investitionen: **große** Investition (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge (Verkauf/Kauf)**
- Sehr gut geschafft:
  - Verkauf: `+3` Zusatzgold pro Investition (± Marktwert)
  - Kauf: `-4 Gold` Kosten (min. 1 Gold)
- Gut geschafft:
  - Verkauf: `+2` Zusatzgold pro Investition (± Marktwert)
  - Kauf: `-2 Gold` Kosten (min. 1 Gold)
- Geschafft:
  - Verkauf: `3 Gold` für den Verkauf von 6 RM / 1 SM / 1 temporärer AK (± Marktwert)
  - Kauf: `6 RM für 2 Gold` **oder** `1 SM für 3 Gold` **oder** `1 temporäre AK für 3 Gold`
- Schlecht geschafft:
  - Verkauf: nur normaler Umwandelwert (± Marktwert)
- Fehlschlag:
  - Verkauf: nur normaler Umwandelwert `-1 Gold` (± Marktwert)

### 3) Materialgewinn

Beschreibung: Sammle zusätzliches Roh- oder Sondermaterial durch effiziente Domänenverwaltung oder Werkstättenbetrieb.

#### 3a) Domänenverwaltung

**Kosten / Investitionen**
- `1 Arbeitskraft (AK)` (= 1 Investition)

**Deckelung**
- max. `4 Investitionen` pro Stufe (Klein/Mittel/Groß) der Domäne

**DC**
- Grund-DC: **10**
- Attribute: (WIS/INT/CHA)
- Investitionsgröße:
  - ab **8** Investitionen: **mittel** (`+4 DC`)
  - ab **12** Investitionen: **groß** (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge**
- Sehr gut geschafft: `16 Rohmaterial` pro Investition
- Gut geschafft: `12 Rohmaterial` pro Investition
- Geschafft: `8 Rohmaterial` pro Investition
- Schlecht geschafft: `1 Rohmaterial` pro Investition
- Fehlschlag: keine Gewinne, Investition verloren

#### 3b) Überwachung der Werkstätten

**Kosten / Investitionen**
- `1 Arbeitskraft (AK)` (= 1 Investition)

**Deckelung**
- max. `2 Investitionen` pro Stufe (Klein/Mittel/Groß) der Werkstatt

**DC**
- Grund-DC: **12**
- Attribute: (WIS/INT/CHA)
- Investitionsgröße:
  - ab **8** Investitionen: **mittel** (`+4 DC`)
  - ab **12** Investitionen: **groß** (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge**
- Sehr gut geschafft: `4 Sondermaterial` pro Investition
- Gut geschafft: `3 Sondermaterial` pro Investition
- Geschafft: `2 Sondermaterial` pro Investition
- Schlecht geschafft: `1/2 Sondermaterial` pro Investition
- Fehlschlag: keine Gewinne, Investition verloren

### 4) Gewinn permanenter Posten oder Sondereinrichtungen

Beschreibung: Erweitere dein Reich durch den Erwerb von Domänenland, Werkstätten oder Ämtern.

#### Kosten & Anforderungen (Auszug)

**Domänen**
- Klein: **30 Gold**
- Mittel: **80 Gold**
- Groß: **140 Gold**

**Städtischer Grundbesitz**
- Klein: **12 Gold**
- Mittel: **25 Gold**
- Groß: **60 Gold**

**Werkstätten/Lager** (werden i.d.R. über Aktion 6 gebaut; hier der Vollständigkeit halber)
- Werkstatt/Lager klein: **8 Gold**
- Werkstatt/Lager mittel: **16 Gold** (+ 1 einfache Fachkraft; nur Werkstätten)
- Werkstatt/Lager groß: **40 Gold** (+ 1 erfahrene Fachkraft; nur Werkstätten)

**Ämter**
- Klein: **10 Gold & 4 Einfluss** *oder* **10 Einfluss & 4 Gold**
- Mittel: **20 Gold & 10 Einfluss** *oder* **20 Einfluss & 10 Gold**
- Groß: **80 Gold & 20 Einfluss** *oder* **20 Gold & 80 Einfluss**

**Pächter/Klienten/Anhänger/Untertanen**
- je 250: **12 Gold, 4 Einfluss**
- Mittel: 500, Groß: 1000

**Unterweltcircel / Spionagering**
- Kosten pro Stufe (Klein/Mittel/Groß): **16 Gold, 6 Einfluss**

**Kult**
- Kosten pro Stufe (Klein/Mittel/Groß): **8 Gold, 6 Einfluss**

**Handwerks-/Handelscollegium**
- Kosten pro Stufe (Klein/Mittel/Groß): **20 Gold, 2 Einfluss**

**Truppen (je Einheit)**
- Milizen: **6 Gold, 1 SM (Waffen)**
- Schläger/Protectoren: **4 Gold, 2 Einfluss**
- Leibgarde: **12 Gold, 4 Einfluss, 1 SM (Rüstung), 1 SM (Waffen)**
- Söldner: **8 Gold**

#### DC

- Werkstätten, Grundbesitz, Domänen:
  - DC **10** (WIS/CHA)
  - `+4` DC für mittlere Posten
  - `+8` DC für große Posten
- Ämter, Kulte, Circel, (Handwerks-/Handels-)Collegien, Klienten/Pächter etc.:
  - DC **14** (CHA/INT)
  - pro Stufe über Klein: `+2` DC (Mittel: 16, Groß: 18)
- Truppen:
  - DC **10** (WIS/CHA)
  - `+4` DC für **5** Einheiten
  - `+8` DC für **10** Einheiten

DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

#### Erfolge

- Sehr gut geschafft: Kosten um **25%** reduziert.
- Gut geschafft: Kosten um **10%** reduziert.
- Geschafft: Standardkosten.
- Schlecht geschafft: Kostensteigerung um **20%**; wenn Ressourcen nicht vorhanden → Kauf scheitert, Ressourcen bleiben aber erhalten.
- Fehlschlag: Aktion nicht erfolgreich, Ressourcen bleiben aber erhalten.

### 5) Politische Schritte (WIP)

Beschreibung: Führe politische Aktionen durch, wie Reformen, Bündnisse oder Intrigen.

**Kosten**
- Basis: `1 Einfluss` und `1 Gold` pro Größenstufe

**Beschädigen/Verteidigen**
- Investiere je `1 Kampfkraft` (verdeckt oder offen) **oder** `6 Einfluss` (= 1 Investition)
- Deckelung: max. `4 Investitionen` pro Stufe (Klein/Mittel/Groß) von Amt oder Unterweltcircel/Spionagering oder Kult

**Manipulieren**
- Investiere je `6 Einfluss & 2 Gold` **oder** `6 Gold & 2 Einfluss` (= 1 Investition)
- Deckelung: max. `2 Investitionen` pro Stufe (Klein/Mittel/Groß) von Amt oder Unterweltcircel/Spionagering oder Kult

**DC**
- Grund-DC: **12** (WIS/INT/CHA)
- Investitionsgröße:
  - ab **4** Investitionen: **mittel** (`+4 DC`)
  - ab **8** Investitionen: **groß** (`+8 DC`)
- DC-Senkungen aus Posten/Einrichtungen: max. `-4` gesamt.

**Erfolge**
- Sehr gut geschafft: Kosten um 2 reduziert; Konsequenzen um 4 reduziert; erhalte 3 Informationen und schädige Fraktion/verbessere Ruf.
- Gut geschafft: Kosten um 1 reduziert; Konsequenzen um 2 reduziert; erhalte 2 Information oder schädige Fraktion oder verbessere Ruf.
- Geschafft: Aktion erfolgreich, Kosten unverändert; erhalte 1 Information.
- Schlecht geschafft: -1 Einfluss oder Ansehensverlust; Konsequenzen um 2 erhöht.
- Fehlschlag: -1 Einfluss und Ansehensverlust; Konsequenzen um 4 erhöht.

### 6) Einrichtungen errichten/ausbauen (Freie Aktion)

Diese Sonderaktion gelingt **automatisch** und ist **einmal pro Runde** zulässig.
Sie zählt nicht zum Aktionsmaximum, darf aber auch mit normalen Aktionen durchgeführt werden.

#### Ausbau eines Postens (Tier-Upgrade)

- Alle Posten (außer Ämter) können mit der freien Aktion **um 1 Stufe pro Runde** ausgebaut werden (nächste höhere Stufe).
- Regelmechanik wie „Gewinn permanenter Posten“ (Aktion 4), aber:
  - DC ist um `-2` gesenkt,
  - Kosten werden um die Kosten des vorigen Postens reduziert.

Beispiel (Soll, mit obigen Domänenkosten):
- Domäne klein → mittel: Basis-DC 14 (10 + 4) wird zu 12; Kosten: `80 - 30 = 50 Gold`.

#### Spezialisierung einer Domäne

- Landwirtschaft: `10 Gold`, `2 RM` (gewünschtes Gut)
- Tierzucht: `15 Gold`, `4 Tiereinheiten`
- Forstwirtschaft: `6 Gold`
- Bergbau/Steinbruch: `20` (Steinbruch) bis `50 Gold`, `4–8 RM` (Bauholz), `1 Fachkraft` (Minenaufseher)

#### Spezialisierungen eines städtischen Besitzes

- Bauproduktion: `10 Gold`, `2 AK (permanent, zusätzlich)`, `1 SM` (Sonderwerkzeug)
- Handwerkswaren: `15 Gold`, `2 AK (permanent, zusätzlich)`, `2 SM` (Sonderwerkzeug)
- Luxusproduktion: `30 Gold`, `1 AK (permanent, zusätzlich)`, `2 SM` (spezifische Sonderwerkzeuge), `1 Fachkraft` (Edelhandwerker)
- Nahrungsproduktion: `8 Gold`, `2 AK (permanent, zusätzlich)`, `1 SM` (z.B. Öfen, Kessel, Fässer)
- Metallverarbeitung: `20 Gold`, `2 AK (permanent, zusätzlich)`, `3 SM` (Sonderwerkzeug); zusätzlicher Unterhalt: `4 Holz`

#### Allgemeine/Besondere Einrichtungen

Wenn nicht anders angegeben:
- Allgemeine Einrichtung: Klein `8 Gold`, Mittel `12 Gold`, Groß `30 Gold`
- Besondere Einrichtung: Klein `10 Gold`, Mittel `20 Gold`, Groß `40 Gold`

#### Werkstätten und Lager

- Klein: `8 Gold`
- Mittel: `16 Gold`
- Groß: `40 Gold`

#### Anheuern von Fachkräften

- Einfach: `10 Gold`
- Erfahren: `25 Gold`
- Meisterlich: `50 Gold`

## Einrichtungen (Soll)

Einrichtungen sind besondere Modifikationen **innerhalb eines Postens** (und von Werkstätten). Sie verändern Erträge, Unterhalt, DCs, Caps, Umwandlungen oder schalten neue Optionen frei.

### Grundregeln

- Jeder Posten erlaubt den Bau einer bestimmten Menge an **Allgemeinen Einrichtungen** (Einrichtungs‑Cap).
- Einrichtungen können **Arbeitskräfte** verbrauchen (meist als Unterhalt oder als Betriebs-/Umwandlungskosten).
- Pro Runde kann eine Einrichtung über die **freie Aktion „Einrichtungen errichten/ausbauen“** (Aktion 6) gebaut/ausgebaut werden, ohne eine Standardaktion zu verbrauchen.

### Einrichtungs‑Caps (allgemein)

- Domänen (allgemeine Einrichtungen): in der Regel **2 Einrichtungen pro Stufe** (Klein/Mittel/Groß).
  - Klein: 2
  - Mittel: 4
  - Groß: 6
- Städtischer Besitz (allgemeine Einrichtungen): in der Regel **2/3/4** (Klein/Mittel/Groß).
  - Klein: 2
  - Mittel: 3
  - Groß: 4
- Andere Posten haben eigene Caps/Regeln (z.B. Circel/Collegien, Handelsunternehmungen, Ämter) – siehe `Permanente Posten (Soll)`.

### Werkstätten (besondere Einrichtung)

- Werkstätten sind **besondere Einrichtungen**, die nur auf:
  - **Domänen**, oder
  - **Stadtbesitz in Eigenproduktion** (also unverpachtet)
  gebaut werden können.
- Werkstätten haben eine **strikte Platz-/Tier-Kopplung** an ihre Host-Posten (Domäne/Stadtbesitz) und unterliegen **Sonder‑Caps**.
- Bei Bau wird festgelegt, **welche RM‑Art** in **welche passende SM‑Art** umgewandelt wird (anfangs: **1 RM‑Art → 1 SM‑Art**; Wechsel nur über Spezialisierung/Regel‑Effekte).
- Betrieb/Umwandlung erfolgt in der **Umwandlungsphase** automatisch, sofern der Unterhalt gezahlt wurde:
  - kleine Werkstatt: bis zu **8 RM → 2 SM** (4:1) oder alternativ **8 RM → 8 „verbesserte RM“** (1:1); Unterhalt: **1 AK**
  - mittlere Werkstatt: bis zu **12 RM → 3 SM** (4:1) oder alternativ **12 RM → 12 „verbesserte RM“** (1:1); Unterhalt: **2 AK + 1 Gold**; Vorteil: **+1 SM** zusätzlich
  - große Werkstatt: bis zu **24 RM → 6 SM** (4:1) oder alternativ **24 RM → 24 „verbesserte RM“** (1:1); Unterhalt: **4 AK + 3 Gold**; Vorteil: **+2 SM** zusätzlich
- Domain‑Regel: Werkstätten belegen auf Domänen **Einrichtungsplätze** (siehe Domänen‑Caps unten).
- City‑Regel: Werkstätten auf Stadtbesitz in Eigenproduktion belegen **keine** Einrichtungsplätze des Stadtbesitzes (siehe Stadt‑Caps unten).
- Startpaket‑Ausnahme: Die Startdomäne enthält bereits **1 kleine Werkstatt** (siehe Startbedingungen), die **keinen** Domänen‑Einrichtungs‑Slot belegt.

### Lager (besondere Einrichtung)

- Lager sind besondere Einrichtungen zur Lagerung von Roh- und Sondermaterial.
- Lager haben eine **strikte Platz-/Tier-Kopplung** an Domänen bzw. Stadtbesitz (Eigenproduktion) und unterliegen **Sonder‑Caps** (analog Werkstätten).
- Kapazität und Unterhalt:
  - kleines Lager: **15 RM + 5 SM**; Unterhalt: **1 AK**
  - mittleres Lager: **25 RM + 10 SM**; Unterhalt: **2 AK**
  - großes Lager: **40 RM + 15 SM**; Unterhalt: **3 AK**
- Domain‑Regel: Lager belegen auf Domänen **Einrichtungsplätze** (siehe Domänen‑Caps unten).
- City‑Regel: Lager auf Stadtbesitz in Eigenproduktion belegen **keine** Einrichtungsplätze des Stadtbesitzes (siehe Stadt‑Caps unten).
- Startpaket‑Ausnahme: Die Startdomäne enthält bereits **1 kleines Lager** (siehe Startbedingungen), das **keinen** Domänen‑Einrichtungs‑Slot belegt.

### Pächter / Klienten / Anhänger (als Zusatz‑Einrichtung)

- Pächter und Klienten/Anhänger/Untertanen gelten als **Zusatz‑Einrichtungen**, die an
  - Domänen,
  - Stadtbesitz,
  - Circel/Collegien
  gebunden sind.
- Sie haben **eigene Caps** (je Postenart und Größe) und können Ertrag/Unterhalt/LO beeinflussen (siehe `Permanente Posten (Soll)`).

## Spezialisierungen (Soll)

Spezialisierungen sind ein besonderer Teil der Einrichtungen:

- Posten können **spezialisiert** werden (über die freie Aktion „Einrichtungen errichten/ausbauen“).
- Grundsätzlich ist pro Posten nur **eine** Spezialisierung möglich.
  - Ausnahme: bei **großen** Werkstätten, **großem** Stadtbesitz oder **großen** Domänen können mehrere Spezialisierungen möglich sein (Soll, genaue Regeln TBD).
- Eine Spezialisierung:
  - erlaubt den Ausbau weiterer Rohmaterial- oder Sondermaterialarten über die anfängliche Auswahl hinaus,
  - erlaubt die **Änderung** der Rohmaterial-Art (z.B. Produktionsausrichtung),
  - schaltet weitere **besondere Einrichtungen** frei, die nur auf spezialisierten Posten gebaut werden können.
- Ämter sind **immer spezialisiert**, ohne eine zusätzliche Aktion zu benötigen: die Spezialisierung wird **bei Erwerb des Amtes** gewählt.

### Details / Kataloge

- Konkrete Einrichtungen & Spezialisierungen (Soll): `docs/rules/soll/facilities.md`
- Engine v1 (implementierte Keys/Kosten/Grundeffekte): `docs/rules/facilities/catalog.md`

## Permanente Posten (Soll)

### Begriff & Überblick

**Posten** sind die zentralen, permanenten Bausteine deines “Reichs”:

- Domänen
- Städtischer Besitz
- Circel und Collegien
- Ämter
- Handelsunternehmungen
- Truppen

Allgemeine Eigenschaften von Posten:
- Posten können durch **Einrichtungen** aufgebessert werden, die **streng mit ihnen verbunden** sind.
- **Pächter** und **Klienten/Anhänger/Untertanen** können an Posten gebunden werden.
- Posten können **spezialisiert** werden (Details je Postenart).
- Posten können durch Gegner angegriffen oder durch Ereignisse beeinträchtigt werden.
- Erwerb erfolgt über Aktion **4) Gewinn permanenter Posten** (oder über Ausbau via Aktion 6, wo angegeben).

### Posten-Größen

Als Richtwert für “Größe” (stufe/tier) gilt:
- Klein: ca. **250** Pächter/Arbeiter
- Mittel: ca. **500–1000** Pächter/Arbeiter
- Groß: ca. **2000** Pächter/Arbeiter

### Posten-Caps (global)

Grundannahme (Soll):
- Pro Postenart **und** pro Größe dürfen maximal **4** Posten gehalten werden.
  - Beispiel: max. 4× kleiner Stadtbesitz, max. 4× mittlerer Stadtbesitz, max. 4× großer Stadtbesitz.
- Ausnahme: **kleine Ämter** dürfen bis zu **8** gehalten werden.
  - Mittlere und große Ämter bleiben bei der **4er-Cap**.
- Truppen haben **keinen** Cap nach Einheiten (aber separate Caps/Begrenzungen je Truppentyp).

### Posten-Erträge (Maintenance/Ressourcenphase)

Die folgenden Werte beschreiben den Standardzustand (Soll):
- **Erträge** werden in der **Ressourcenphase** ausgeschüttet (wenn Posten aktiv sind).
- **Unterhalt** wird in der **Unterhaltsphase** gezahlt (ab Runde 2); wenn Unterhalt nicht gezahlt werden kann, **ruhen Funktionen** des Postens (inkl. seiner Einrichtungen), bis wieder gezahlt wird.

> Hinweis: DC-Senkungen unterliegen dem globalen Cap aus „Erfolgswürfe & Checks“: insgesamt max. `-4`.

---

## Pächter, Anhänger, Untertanen (Soll)

Pächter/Anhänger/Klienten gelten als **Sondereinrichtung** (Zusatz‑Einrichtung), die an Posten gebunden wird (Domäne/Stadtbesitz/Circel/Kult etc.).

### Pächterstufen (Domänen)

- 1 Pächterstufe = ca. **250** Personen.
- Effekt pro Stufe:
  - `+1 AK` (temporär pro Runde)
  - `+1 Gold` (pro Runde)
  - zusätzlich auf Domänen: `+1 einfaches RM` (passend zur Domäne/Spezialisierung; Details in `docs/rules/soll/facilities.md`)
- Caps:
  - kleine Domäne: max. **2** Pächterstufen
  - mittlere Domäne: max. **4** Pächterstufen
  - große Domäne: max. **8** Pächterstufen

### Anhänger/Klienten (Stadtbesitz, Circel, Kult)

- Effekt pro Stufe (wenn an Stadtbesitz/Orga gebunden):
  - `+1 AK` (temporär pro Runde)
  - plus **Wahl**: `+1 Gold` **oder** `+1 Einfluss` (Wahl in der Ressourcenphase)
- Caps:
  - Stadtbesitz: max. **2/3/4** Stufen (klein/mittel/groß)
  - Circel & Collegien: max. **1 Stufe Anhänger pro Circel‑Stufe**
  - Kulte: max. **2/4/8** Stufen (klein/mittel/groß)
    - Unterhalt für Anhänger‑Stufen: **1 Gold oder 1 Einfluss pro Stufe** (Wahl; genaue Abwicklung TBD)

### Loyalität (Soll)

- Pächter/Anhänger/Klienten haben **Loyalität**.
- Bei Unterschreiten von Schwellenwerten kann es zu **Aufruhr** kommen (Posten ruhen/liegen lahm) oder zu **Abwanderung** (Verlust von Stufen).
- Konkrete Trigger/Proben/Skalierung: siehe `docs/rules/soll/facilities.md` (TBD/Phase 2).

## Domänen

### Ausbaubedürftige ländliche Domäne (Startdomäne)

Gilt als **kleine Domäne**, außer wie folgt:
- Ertrag: **2 AK**, **8 RM**
- Rohmaterial-Auswahl (Produktion):
  - **1× billige** Rohmaterial-Art + **1× einfache** Rohmaterial-Art
  - **kein** RM mit Bonus-Gold (saleBonusGold) erlaubt, außer eine Einrichtung erlaubt/produziert dies
- Ausbau (freie Aktion „Einrichtungen errichten/ausbauen“): **8 Gold** + **4 AK** → wird zu einer **kleinen Domäne**

### Kleine Domäne
- Unterhalt: **2 Gold/Runde**
- Ertrag: **2 AK**, **12 RM**
- Rohmaterial-Auswahl (Produktion):
  - **2× billige** Rohmaterial-Arten + **1× einfache** Rohmaterial-Art
  - pro gewählter Art müssen mindestens **4 RM** aus dieser Art stammen (Verteilung)
  - **kein** RM mit Bonus-Gold (saleBonusGold) erlaubt, außer eine Einrichtung erlaubt/produziert dies
- Vorteil: senkt **Materialgewinn-DC** bei **kleinen Aktionen** um `-1`

### Mittlere Domäne
- Unterhalt: **4 Gold/Runde**
- Ertrag: **4 AK**, **24 RM**
- Rohmaterial-Auswahl (Produktion):
  - **3× billige** Rohmaterial-Arten + **2× einfache** Rohmaterial-Arten
  - genau **eine** der gewählten Arten darf Bonus-Gold haben
  - pro gewählter Art mindestens **4 RM**
  - keine weiteren Bonus-Gold-RM, außer durch Einrichtungen
- Vorteil: senkt **Materialgewinn-DC** bei **mittleren Aktionen** um `-1`

### Große Domäne
- Unterhalt: **8 Gold/Runde**
- Ertrag: **8 AK**, **36 RM**
- Rohmaterial-Auswahl (Produktion):
  - **4× billige** Rohmaterial-Arten + **3× einfache** Rohmaterial-Arten
  - genau **eine** der gewählten Arten darf Bonus-Gold haben
  - **eine** einfache Art darf durch **eine teure RM-Art** ersetzt werden
  - pro gewählter Art mindestens **4 RM**
  - keine weiteren Bonus-Gold-RM, außer durch Einrichtungen
- Vorteil: senkt **Materialgewinn-DC** bei **großen Aktionen** um `-1`

### Werkstätten und Lager (Domäne) – Caps

Werkstätten und Lager sind **strikt** an Domänen gekoppelt (pro Domäne eigene Plätze) und durch die Domänengröße gedeckelt. Auf Domänen belegen sie **Einrichtungsplätze**.

- kleine Domäne: **1× klein** (Werkstatt **oder** Lager)
- mittlere Domäne: **1× mittel** (Werkstatt **oder** Lager)
- große Domäne: **1× klein + 1× mittel** (jeweils Werkstatt **oder** Lager)

---

## Städtischer Grundbesitz

Städtischer Besitz kann **gekauft** oder **gepachtet** werden.
- Gepachteter Besitz: Unterhalt fällt an (wie unten); Nutzung ist i.d.R. Eigenproduktion (Details/TBD).
- Gekaufter Besitz: kann entweder **verpachtet** (Ertrag) oder für **Eigenproduktion** genutzt werden.

### Kleiner Besitz
- Unterhalt: **2 Gold/Runde** (fällt nur an, wenn **nicht** verpachtet)
- Ertrag wenn verpachtet: **1 AK**, **1 Einfluss**, **2 Gold**
- Vorteil wenn verpachtet: `-1 DC` auf **Einflussgewinn** und **Politische Schritte** bei **kleinen Aktionen**
- Ertrag wenn Eigenproduktion: **2 AK**
- Vorteil wenn Eigenproduktion: erlaubt **2× klein** oder **1× mittel** Werkstatt/Lager (belegen **keine** Einrichtungsplätze des Stadtbesitzes)

### Mittlerer Besitz
- Unterhalt: **4 Gold/Runde** (fällt nur an, wenn **nicht** verpachtet)
- Ertrag wenn verpachtet: **2 AK**, **2 Einfluss**, **5 Gold**
- Vorteil wenn verpachtet: `-1 DC` auf **Einflussgewinn** und **Politische Schritte** bei **mittleren Aktionen**
- Ertrag wenn Eigenproduktion: **3 AK**
- Vorteil wenn Eigenproduktion: erlaubt **1× klein + 1× mittel** Werkstatt/Lager (belegen **keine** Einrichtungsplätze des Stadtbesitzes)

### Großer Besitz
- Unterhalt: **8 Gold/Runde** (fällt nur an, wenn **nicht** verpachtet)
- Ertrag wenn verpachtet: **4 AK**, **4 Einfluss**, **12 Gold**
- Vorteil wenn verpachtet: `-1 DC` auf **Einflussgewinn** und **Politische Schritte** bei **großen Aktionen**
- Ertrag wenn Eigenproduktion: **6 AK**
- Vorteil wenn Eigenproduktion: erlaubt **1× groß + 1× mittel** Werkstatt/Lager (belegen **keine** Einrichtungsplätze des Stadtbesitzes)

---

## Circel und Collegien

Allgemein:
- Permanente Posten, die **Anhänger/Klienten** (oder Pächter) gewinnen können; repräsentieren Personenzusammenschlüsse.
- Allgemeiner “Ertrag” (strukturell): erlauben den Bau von **zusätzlichen** städtischen Einrichtungen.
  - Pro Stufe: `+1` zusätzliche **allgemeine oder besondere** städtische Einrichtung (Soll-Text).
- Einrichtungscaps (Circel/Collegium):
  - max. **3 Einrichtungen** (allgemein + besonders) pro Stufe, bis max. **9**.
- Anhänger/Klienten (allgemein):
  - Circel/Collegien können Klienten/Anhänger von **1/2/3 Stufen** (Stufe = 250) pro Circel-Stufe erreichen;
  - Kulte und Banden weichen davon ab (siehe unten).
- HQ-Beschränkung:
  - benötigt einen **kleinen/mittleren/großen Stadtbesitz** pro Stufe als Hauptquartier (Tier-gekoppelt).
- DC-Senkungen:
  - gelten **nur einmal** und akkumulieren **nicht** bei mehreren Circeln derselben Art.
- Zusätzliche Slots (Soll-Text, Präzisierung/TBD):
  - pro Stufe `+1` **allgemeine** Einrichtung,
  - plus je nach Circel-Art `+1` **besondere** Einrichtung.

### Unterweltcircel
- Unterhalt: **1 Gold + 1 AK** pro Stufe
- Ertrag:
  - Stufe 1: `+3 Gold` und `+2 Einfluss` pro Stufe/Runde, dazu `+1 Gold` pro Stufe/Größe jedes Stadtbesitzes
  - ab Stufe 2: `+6 Gold` und `+4 Einfluss`, dazu `+1 Gold` und `+1 Einfluss` pro Stufe/Größe jedes Stadtbesitzes
  - ab Stufe 3: `+8 Gold` und `+6 Einfluss`, dazu `+2 Gold` und `+1 Einfluss` pro Stufe/Größe jedes Stadtbesitzes
- Anhänger (Banden/Pächter):
  - max. **2/4/6** pro Stufe (Soll-Text)
  - Kosten: **12 Gold + 10 Einfluss** pro Anhängerstufe

### Spionagering
- Unterhalt: **2 Gold** pro Stufe
- Ertrag: `+6 Einfluss` pro Stufe/Runde
- Zusatz ab Stufe 2: `+1 permanenter Einfluss`
- Zusatz ab Stufe 3: `+2 permanenter Einfluss`; Bonusaktion: **Politische Schritte** alle 2 Runden
- Vorteile: `-1 DC` auf **Politische Schritte** pro Stufe
- Anhänger: keine

### Kult
- Unterhalt: **1 Gold** pro Stufe
- Ertrag: `+5 Einfluss` und `+1 AK` pro Stufe/Runde
- Zusatz ab Stufe 2: `+2 permanenter Einfluss`
- Zusatz ab Stufe 3: `+4 permanenter Einfluss`; Bonusaktion: **Einflussgewinn**
- Vorteile: `-1 DC` auf **Einflussgewinn** pro Stufe
- Anhänger:
  - max. **2/4/8** (Soll-Text)
  - Kosten: **8 Gold + 8 Einfluss** pro Anhängerstufe

### Handwerkscollegium / Handelscollegium (Gilde)
- Wahl: muss Handwerks- **oder** Handelscollegium sein
- Unterhalt: **2 Gold**
- Ertrag: `+3 AK` pro Stufe
- Zusatz ab Stufe 3: Bonusaktion: **Geldgewinn** oder **Materialgewinn**
- Vorteile:
  - Handelscollegium: `-2 DC` auf **Geldgewinn** pro Stufe
  - Handwerkscollegium: `-2 DC` auf **Materialgewinn** pro Stufe

---

## Ämter

Besonderheit:
- Ämter können nicht “ausgebaut” werden; sie werden **behalten und kumuliert**.
- Kleine Ämter bis zu **8**; mittlere/große Ämter bis zu **4** (Posten-Cap).
- Voraussetzungen:
  - je **2 kleine Ämter** erlauben **1 mittleres Amt** anzutreten
  - je **2 mittlere Ämter** erlauben **1 großes Amt** anzutreten

### Kleines Amt
- Ertrag: **4 Einfluss** *oder* **3 Gold** pro Runde (Wahl in der Ressourcenphase)
- Vorteile:
  - `-1 DC` auf **Politische Schritte** und **Einflussgewinn** bei **kleinen Aktionen**
  - `-1 DC` auf **Posten gewinnen** bei **mittleren Ämtern**

### Mittleres Amt
- Voraussetzung: 2 kleine Ämter
- Ertrag: **8 Einfluss** *oder* **10 Gold** pro Runde (Wahl in der Ressourcenphase)
- Vorteile:
  - `-1 DC` auf **Politische Schritte** und **Einflussgewinn** bei **mittleren Aktionen**
  - `-1 DC` auf **Posten gewinnen** bei **großen Ämtern**

### Großes Amt
- Voraussetzung: 2 mittlere Ämter
- Ertrag: **16 Einfluss** *oder* **20 Gold** pro Runde (Wahl in der Ressourcenphase)
- Vorteile:
  - Bonusaktion: **Einflussgewinn** oder **Politische Schritte**
  - `-1 DC` auf **Politische Schritte** und **Einflussgewinn** bei **großen Aktionen**
  - senkt die **Kosten** für “Posten gewinnen” bei allen Ämtern um **10%**

---

## Handelsunternehmungen

Allgemein:
- Jede Stufe der Handelsunternehmung stellt ein zusätzliches Marktsystem bereit.
- Beschränkung: nur **1 Handelsunternehmung pro Markt**.
- Einrichtungen: je **2 allgemeine Einrichtungen** pro Stufe der Handelsunternehmung.

### Klein
- Unterhalt: **2 Gold + 1 AK**
- Ertrag (Wahl; Auszahlung in der nächsten Runde):
  - **2 Sondermaterial**, oder
  - für **1 investiertes Sondermaterial**: **4 Gold** (folgende Runde) ± Marktsystem
- Vorteil: `-1 DC` auf **Geldgewinn** für **kleine Investments**

### Mittel
- Unterhalt: **5 Gold + 2 AK**
- Ertrag (Wahl; Auszahlung in der nächsten Runde):
  - **3 Sondermaterial**, oder
  - für **2 investierte Sondermaterial**: **10 Gold** (folgende Runde) ± Marktsystem
- Vorteil: `-1 DC` auf **Geldgewinn** für **mittlere Investments**

### Groß
- Unterhalt: **6 Gold + 4 AK**
- Ertrag (Wahl; Auszahlung in der nächsten Runde):
  - **6 Sondermaterial**, oder
  - für **4 investierte Sondermaterial**: **24 Gold** (folgende Runde) ± Marktsystem
- Vorteil: `-1 DC` auf **Geldgewinn** für **große Investments**

---

## Truppen

Truppen haben keinen “4er-Posten-Cap” nach Einheiten, aber je Truppentyp eigene Begrenzungen.

### Leibgarde / Haustruppen
- Kosten: **12 Gold, 4 Einfluss, 1 SM (Rüstung), 1 SM (Waffen)** pro Stufe/Einheit
- Einheitengröße: je Leibgardenstufe (10 Gardisten): `+2` offene Kampfkraft, `+1` verdeckte Kampfkraft
- Unterhalt: **3 Gold, 1 Einfluss** pro 10er-Einheit; `1 RM` Nahrung pro 50 Mann
- Beschränkungen:
  - anfangs nur **3 Stufen** erlaubt; ab 4 ist mittlere Größe
  - Cap-Erhöhung durch Ämter: kleine `+1`, mittlere `+3`, große `+4` Leibgardestufen
- Vorteile: Bonusreaktion bei Angriffen auf den Inhaber; `+2` auf Verteidigungswürfe; höhere Basis (LO+1)

### Milizen
- Kosten: **6 Gold, 1 SM (Waffen)** pro 25er-Einheit
- Einheitengröße: je Milizstufe (25 Milizionäre): `+1` offene Kampfkraft
- Unterhalt: **1 Gold, 1 Einfluss** pro 50er-Einheit; ab 100 Mann `+1 Einfluss` pro zusätzlichem Trupp
- Beschränkungen:
  - ab **5 Einheiten** ist mittlere Größe
  - Domänen-Caps: klein max **2**, mittel max **4**, groß max **12** Milizstufen
- Besonderheiten: `+2` auf Verteidigungswürfe gegen Überfälle/Plünderungen im eigenen Gebiet

### Söldner
- Einheitengröße: je Söldnerstufe (25 Krieger): `+2` offene Kampfkraft, `+1` verdeckte Kampfkraft
- Kosten: **8 Gold** pro 25er-Einheit
- Unterhalt: **3 Gold** pro 25er-Einheit; `+1 RM` Nahrung pro 100 Mann
- Beschränkungen:
  - anfangs auf **4** beschränkt; ab 5 ist mittlere Größe
- Besonderheiten: können jederzeit entlassen werden (Unterhalt entfällt), müssen dann neu angeworben werden

### Protectoren und Schläger
- Einheitengröße: je Protektorenstufe (25 Schläger): `+1` verdeckte Kampfkraft; `+1` offene Kampfkraft pro 50 Schläger
- Kosten: **4 Gold, 2 Einfluss** pro 25er-Einheit
- Unterhalt: **1 Gold, 1 Einfluss** pro 25er-Einheit; `+1 RM` Nahrung pro 100 Mann
- Beschränkungen:
  - Stadtbesitz-Cap: **1/2/3** Protektorenstufen je nach Stadtgröße
  - Unterwelt/Kult-Cap: **2 Protektorenstufen pro Circelstufe**
  - ab **4** ist mittlere Größe
- Besonderheiten:
  - `+1` auf alle städtischen Verteidigungswürfe je 4 Protektoren-Einheiten (max. 4)
  - als einzige Truppen unbegrenzt in Stadt zulässig
