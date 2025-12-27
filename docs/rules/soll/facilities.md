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

Format einer Einrichtung (Soll):
- **Kosten** (einmalig) und ggf. **Bauzeit** (in Baurunden)
- **Unterhalt** (pro Runde; ab Runde 2 in der Unterhaltsphase)
- **Cap/Prereqs** (Slots, Tier, Host, Voraussetzungen)
- **Effekte** (Ertrag, DC‑Modifikatoren, Markt‑Modifikatoren, Bonusaktionen, Umwandlung)

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
- Verbesserte RM gelten als “höhere” Qualitätsstufe der Ausgangsware und erhalten typischerweise einen **Bonus auf Verkauf** (genaue Markt-/Preislogik: TBD; Anbindung an Markttabellen/Materialgruppen erforderlich).

## Pächter, Anhänger, Untertanen (Soll)

Pächter/Anhänger/Klienten sind eine **Sondereinrichtung** von Domänen, Kulten, städtischen Einrichtungen und Circeln.

### Pächterstufen (Domänen)

- 1 Stufe = **250** Personen.
- Effekt pro Pächterstufe:
  - `+1 AK` (pro Runde)
  - `+1 Gold` (pro Runde)
  - zusätzlich auf Domänen: `+1 einfaches RM` (Spezialisierung nach Domäne; Auswahl TBD)
- Caps:
  - kleine Domäne: max **2**
  - mittlere Domäne: max **4**
  - große Domäne: max **8**

### Anhänger/Klienten (City/Orga)

- Effekt pro Stufe:
  - `+1 AK` (pro Runde)
  - plus **Wahl**: `+1 Gold` **oder** `+1 Einfluss`
- Caps:
  - Stadtbesitz: **2/3/4** (klein/mittel/groß)
  - Circel & Collegien: **1 Stufe pro Circel‑Stufe**
  - Kult: **2/4/8** (klein/mittel/groß)
    - zusätzlicher Unterhalt/Preis je Anhängerstufe: **1 Gold oder 1 Einfluss** (Wahl; Präzisierung TBD)

### Loyalität / Aufruhr / Abwanderung (Soll)

- Pächter/Anhänger haben **Loyalität**.
- Bei niedriger Loyalität:
  - können sie in **Aufruhr** geraten (Posten/Einrichtungen ruhen),
  - oder **abwandern** (Stufenverlust).
- Konkrete Mechanik (Würfe, Schwellen, Dauer): TBD (Phase 2, muss an Ereignisse/Politik anschließen).

## Pylonennetz (Soll, späteres Spiel)

Charaktere können Pylonen-Netzwerke erbauen, um **Zauberkraft (ZK)** zu transferieren.

- Eine Achäer‑Pylone verbindet einen Ort mit bis zu **4** weiteren.

### Kleine Achäerpylone
- Bauzeit: **2 Runden**
- Kosten/Material:
  - **8** Granit oder Marmor
  - **4 RM** ungeschliffener Optrilith
  - **1 RM** Mondsilber
  - **1 RM** Achäerkristalle
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
  - **4 RM** Mondsilber
  - **4 RM** Achäerkristalle
  - **6 AK** während der Bauzeit
- Ertrag:
  - `+1–4` lokale ZK (je nach Verbindungen)
  - plus `+1–3` je nach Macht des Kraftstroms (TBD: System/Skalierung)

## Fachkräfte, Berater und Handlanger (Soll)

### Kapazitäten (Grundannahmen)

- Engster Beraterstab: **2–5** Rollen (Finanz/Handel, Sicherheit, Einfluss, Strategie/Taktik, …).
- Start: **2** mögliche Berater und **2** mögliche Fachkräfte.
- Kapazität steigt:
  - je **mittlerem** Posten (Circel, Ämter, Truppen, Domänen, Stadtbesitz, Handelsunternehmungen) um `+1`,
  - je **großem** Posten um `+1` (zusätzlich),
  - sowie über persönliche Einrichtungen (TBD).

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

### Allgemeine Handlanger (Soll)

Notation: erster Wert = als Berater / zweiter Wert = an Posten gebunden.

- **Taktiker**: `+1/+2/+3` Kampfkoordinationsproben; `+1/+2/+3` Kampfkraft aller Truppen; meisterlich zusätzlich `-1` Truppen‑Unterhalt.
- **Zauberer**: `-1/-2/-4 DC` auf magiebezogene Proben; `+1/+2/+4 ZK` pro Runde; erfahren/meist. ggf. Artefakt‑Option (TBD).
- **Verwalter**: `-1/-2/-4 DC` Materialgewinn; `+4/6/8 RM` oder `+1/2/3 SM` Ertrag; `+1/+2/+3` Kampfkraft; `-1/-2/-3 Gold` Unterhalt.
- **Stratege**: `+1/+2/+4` Politische Schritte; `+2/+4/+8` Einfluss/Runde **oder** `+2/+4/+8 RM/Runde`.
- **Kleriker**: `+2/+4/+6` Einfluss bei religiösen Aktionen; `+1/+2/+3` auf Loyalitätsproben.
- **Finanzier/Händler**: `-1/-2/-4 DC` Geldgewinn & Verkauf/Ankauf; `+2 Gold/Runde` (einfach); erfahren/meist. skaliert mit Handelsunternehmung/Schiffen (TBD).
- **Politiker**: `-1/-2/-4 DC` Einflussgewinn; `+4/+8/+16` Einfluss/Runde; +Abwehr gegen politische Angriffe.
- **Baumeister**: zusätzliche Einrichtungs‑Sonderaktionen; Baukostenreduktion (Gold oder %); Bauzeitreduktion bei Langzeitprojekten (TBD).
- **Werkstatt‑Fachkräfte**: `-2 DC` Werkstattüberwachung; `+2/+4/+6` teure SM pro Runde (TBD: Integration in Werkstattoutput).
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
- **Domänenvilla**: Kosten: 3 Baurunden zu 4 AK; 30 Gold; 20 RM Baugestein; 5 RM Ziegel; 8 RM teures Baumaterial; 6 SM teures Material. Unterhalt: 4 Gold + 1 AK pro Domänenstufe. Effekt: `+1 permanenter Einfluss` jede zweite Runde; `-1 DC` auf Einflussgewinn (klein+mittel); Loyalitäts-/Host‑Effekte (TBD). Upgrade ab großer Domäne (ohne Slots): luxuriöse Villa (doppelt).

**Nur große Domäne:**
- **Experimental‑Cammern**: Kosten: 4 Baurunden zu 4 AK; 40 Gold; 40 RM Baugestein; 10 RM Bronze; 10 RM Glas; 10 teures Baumaterial; 5 teure SM; 1 Fachkraft (Zauberer). Effekt: Wahl‑Ertrag (alle 4 Runden teure SM / Artefakte etc.; Details TBD).
- **Stellares Observatorium**: Kosten: 5 Baurunden zu 4 AK; 50 Gold; 20 Marmor/Granit; 2× verarbeitetes Mondsilber (SM); 4× veredeltes Glas (SM); 1× magomechanische Teile. Unterhalt: 3 Gold. Effekt: `+1 ZK` (stellar) und Bastion‑Nutzung (TBD).
- **Kleines Kastron**: Kosten: 5 Baurunden zu 8 AK; 180 Gold; 60 RM Baugestein; 60 Einfluss. Unterhalt: 10 Gold + 3 Truppen‑Einheiten (keine Miliz). Effekt: `+5 permanenter Einfluss/Runde`, `+10 KK` stationierte Einheiten; halbiert negative Ereignis‑Effekte; halbiert DC von Verteidigungsproben; weitere Vorteile (TBD).

### Städtischer Besitz (Allgemeine Einrichtungen)

Cap allgemein: bis zu **2/3/4** (klein/mittel/groß).

- **Organisiere Nerethon und Brajansgarden**: Kosten 4 Gold, 2 Einfluss; Unterhalt 1 AK, 1 Gold; Effekt: `+2` auf Verteidigungswürfe; Ereignis „Unruhen in Denera“ 1 Runde weniger.
- **Suppenküchen sponsoren**: Kosten 4 Gold; Unterhalt 1 RM (Nahrung) per 4 Einfluss; Ertrag `+1 Einfluss` pro Stufe Stadtbesitz; bei Hungersnot: `+2 permanenter Einfluss`.
- **Bündnis mit lokalen Banden**: Kosten 5 Gold, 3 Einfluss; Unterhalt 1 Gold; Effekt: `+1` auf Stadtangriffs‑Reaktionen; wenn Circel/Collegium: Unterhalt entfällt, stattdessen `+1 Gold` pro Circelstufe.
- **Organisiere Circel der Arbeiter**: Kosten 8 Gold, 2 Einfluss; Unterhalt 1 Einfluss; Ertrag `+1 AK` pro Stufe Stadtbesitz.
- **Pacht von Marktständen**: Kosten 14 Gold, 4 Einfluss; Effekt: `-1 DC` Geldgewinn (Verkauf) klein; gilt als mittleres Lager; `+1` Investition Verkauf+Ankauf.

**Ab mittlerem Besitz:**
- **Oktral‑Schrein**: Kosten 16 Gold, 6 RM Baugestein, 2 teure SM Schmuckwerk; Effekt `+4 Einfluss/Runde`; Upgrade (ohne Slots) prächtig = doppelt. Alternativ als Kult‑Schrein: `-2/-4 DC` auf Kult‑Ausbau (einfach/prächtig).
- **Insulaebau**: Kosten 16 Gold, 10 RM Ziegel, 10 RM Bauholz; +250 Pächter nächste Runde; max +2/+4 (mittel/groß).
- **Mercatoria** (nur 1× pro Stadt): Kosten 16 Gold; Unterhalt 1 AK; Effekt `+2 Gold` + `+1 teure SM` + `+2` Investitionen Verkauf+Ankauf; Upgrade große Mercatoria (ohne Slots) = doppelt + Bonusaktion; Prereq: nimmt Platz einer großen Werkstatt/Lager ein (Cap‑Slot).
- **Manufakturbetriebe**: 4 Baurunden à 4 AK; Kosten 30 Gold, 30 Ziegel, 20 Holz, 4 teure SM (Maschinenteile); Prereq: mind. mittlere Werkstatt + einfache Fachkraft (Handwerk). Effekt: Werkstatt‑Unterhalt `-1 AK` pro Stufe; Werkstattüberwachung Cap `+1`; schaltet 1 zusätzlichen mittleren Werkstattplatz frei (ohne allgemeine Caps zu erhöhen).
- **(Luxuriöses) Atriumhaus**: 3 Baurunden à 4 AK; Kosten 30 Gold + Baumaterial; Unterhalt 4 Gold pro Besitzstufe; Effekt: permanenter Einfluss (analog Domänenvilla); nimmt mittleren Werkstatt/Lagerplatz ein; Upgrade (ohne Slots) luxuriös = doppelt.
- **Magomanufaktur**: Kosten 100 Gold, 20 Einfluss, 8 ZK, 8 SM Magomechanik; Prereq: große Werkstatt + Manufakturbetrieb + Fachkraft (Zauberer). Unterhalt +2 ZK; Ertrag +2 SM Magomechanische; verbessert Werkstattüberwachung großer Werkstätten (4:1) + Bonusaktion (TBD‑Details).

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
  - Große Mühlanlagen: (Bauzeit) → gilt als kleine Werkstatt (slotfrei) für Landwirtschafts‑RM→verbesserte RM; kann zu mechanischer Mühlanlage (mittlere Werkstatt) ausgebaut werden (Details TBD)

#### Tierzucht
- Kosten (Spezialisierung): 15 Gold, 4 Tiereinheiten
- Unterhalt: **1 AK**
- Effekt (Basis): wähle Paket (Schafe/Rinder/Schweine/Varken/Pferde …; Details TBD)
- Beispiel‑Einrichtungen:
  - Schlachthaus: (Bauzeit) → gilt als kleine Werkstatt (slotfrei) für Nahrung/verbesserte RM (Details TBD)
  - Käserei/Molkerei/Gerberei: 6 Gold, 1 AK → `+4` billige SM (Käse) oder `+2` billige SM (Leder)
  - Edelzüchtungen: 20 Gold, 2 AK → `+1` teures RM (edle Tiere) oder `+1` AK (Arbeitstiere)
  - Schlachtrosszüchtungen: 15 Gold, 1 AK, 1 Fachkraft → verbessert Reittiere zu teurem SM (Details TBD)

#### Forstwirtschaft
- Kosten (Spezialisierung): 6 Gold
- Unterhalt: –
- Effekt (Basis): `+16` Holz (billig) und `+4` teures RM (Wildbret)
- Beispiel‑Einrichtungen:
  - Jagdgebiet: 5 Gold → +RM Fleisch/Pelze (Details TBD)
  - Imkerei/Metkelterei: 2 Gold → `+2` billiges SM (Honigmet) pro Runde je Domänenstufe
  - Edelholzzucht: 15 Gold, 2 AK → wandelt Holz teilweise zu teurem RM um

#### Bergbau / Steinbruch
- Kosten (Spezialisierung): 20–50 Gold, 4–8 RM (Bauholz), 1 Fachkraft (Minenaufseher)
- Unterhalt: Steinbruch **3 AK**, Erz-/Edelminen **6 AK** (zusätzlich)
- Effekt (Basis): wähle Fokus (Stein/Erz/Edelmetall/Kristalle …; Details TBD)
- Beispiel‑Einrichtungen:
  - Verbesserte Schmelzöfen: 8 Gold, Unterhalt 1 AK → verbesserte RM Metall/Stahl aus Erz (Details TBD)
  - Tiefenschacht / Hüttewerke: mittlere Einrichtung, Bauzeit, Ertrag+Unterhalt (Details TBD)

#### Magische Experimental‑Domäne (später)
- Effekt (Basis): halbierte RM‑Produktion; `+2` lokale ZK pro Domänenstufe
- Voraussetzungen/Einrichtungen: Cammern, Bronze‑Pylonen, Phylakarien, Golemiden‑Labore etc. (TBD)

### Städtische Spezialisierungen (Soll, Überblick)

Nur einmal pro städtischem Besitz (ab mittlerem Besitz). Pro Spezialisierung wird typischerweise `+1` besondere Einrichtung pro Stufe/Größe des Stadtbesitzes freigeschaltet (Details je Spezialisierung TBD).

#### 1) Nahrungsproduktion
- Unterhalt: **2 AK**
- Fokus (Beispiel): Bäckereien / Brauerei/Winzerei / Metzgerei
- Beispiel‑Einrichtungen: Gasthaus, Viehmarkt, Destille (Details TBD)

#### 2) Handwerkswaren
- Unterhalt: **2 AK**
- Fokus (Beispiel): Tuche / Möbel / Alltagswaren
- Beispiel‑Einrichtungen: große Färberei, Webkammern, Gerberviertel (Details TBD)

#### 3) Metallverarbeitung
- Unterhalt: **2 AK** + ggf. Holz‑Unterhalt
- Fokus (Beispiel): Schmiede / Hüttewerke
- Beispiel‑Einrichtungen: Waffenschmiede, Mechaniker‑Werkstätten, Gießereien (Details TBD)

#### 4) Edelhandwerk & Kunst
- Unterhalt: **2 AK + 2 Gold**
- Fokus (Beispiel): Glaser / Juweliere / Alchemisten / Parfümeure
- Beispiel‑Einrichtungen: Spezialglashütte, Labor, Goldschmiedegasse, Alchemomanufaktur (Details TBD)

#### 5) Bau und Bauprodukte
- Unterhalt: **3 AK** + ggf. Holz‑Unterhalt
- Fokus (Beispiel): Ziegeleien / Zimmerer
- Beispiel‑Einrichtungen: Maurercircel, Baumeistercollegium, Bildhauerwerkstätte (Details TBD)

#### 6) Verbrecher‑ und Schutzgeldbezirk
- Unterhalt: **1 Gold** (Schweigegeld/Bestechungen)
- Effekt: +Einfluss über Circel; erhöht Sicherheit gegen feindliche Unterwelt (Details TBD)
- Beispiel‑Einrichtungen: Geheimtunnel, Hehlerring, Spielhöllen, Badehaus, “schäbige Werkstätten” (Details TBD)

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
- **Suppenküchen sponsoren**: Kosten 4 Gold; Unterhalt 1 RM (Nahrung) per 4 Einfluss; Ertrag `+1 Einfluss` pro Stufe der Anhänger; bei Ereignis Hungersnot zusätzlich `+2 permanenter Einfluss` und `+1` Anhängerstufe (Soll‑Interpretation: Trigger/Stacking TBD).
- **Initiation in den Kult**: Kosten 6 Gold, 6 Einfluss; Unterhalt 2 Einfluss/Runde. Effekt: Fachkräfte starten mit Loyalität `+1`; kann erneut durchgeführt werden für insgesamt `+2` Loyalität.
- **Geheime Kultstätte**: Kosten 8 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde; Ertrag `+2 Einfluss/Runde`; `+2` auf Verteidigung gegen städtische Angriffe.
- **Heilige Artefakte**: Kosten 12 Gold, 6 Einfluss; Effekt: `+4 Einfluss/Runde`; zusätzlicher permanenter Vorteil (Schip/Artefakt; TBD).
- **Mysten**: Kosten 12 Gold, 12 Einfluss; Unterhalt 6 Einfluss/Runde. Effekt: `+2` auf Wurf zum Anheuern von Klerikern oder Zauberern; neue Fachkräfte starten mit Loyalität `+1`.
- **Große Gemeinschaftsmahle / Armenfürsorge** (Kult Stufe 2+): Kosten 16 Gold, 8 Einfluss; Unterhalt 4 RM (Nahrung) + 1 (Tiere) + 2 Gold/Runde. Effekt: `+3 Einfluss/Runde`; `+1 permanenter Einfluss` (akkumulierend) alle 2 Runden.
- **Große Opferriten**: Unterhalt 12 RM Tiere **oder** 1 AK pro Runde; Ertrag `+1 ZK` (dämonisch) pro Runde.
- **Primärliturgie** (nur große Kulte): Kosten 40 Gold, 40 Einfluss; Unterhalt 2 Gold + 4 Einfluss/Runde. Effekt: rekrutiert automatisch eine einfache Kleriker‑Fachkraft alle 6 Runden; neue Kleriker starten mit Loyalität `+3` (Voraussetzungen: göttliche Queste/Frömmigkeit; TBD).

#### Besondere Einrichtungen — Handwerks-/Handelscollegien

- **Garantierte Qualitätsstandards** (bis zu 3×): Kosten 8 Gold, 2 Einfluss; Unterhalt 1 Gold/Runde. Ertrag: `+1` Sondermaterial/Runde (Produktionseffizienz). Zusätzlich: verbessert die Stufe einer produzierten Wareart einer einzelnen Werkstatt (billig→einfach oder einfach→teuer).
- **Interne Warenbörse**: Kosten 8 Gold, 3 Einfluss; Unterhalt 1 Gold/Runde. Effekt: `±1` auf Marktwürfe (Richtung wählbar).
- **Repräsentationsräume**: Kosten 12 Gold, 2 RM (teures Material); Unterhalt 2 Gold/Runde. Ertrag: `+1 Einfluss/Runde`; Vorteil: senkt Einflussgewinn‑DC um `-1` (kleine Aktionen).
- **Collegiumsprozessionen** (Collegium Stufe 2+): Kosten 12 Gold, 5 Einfluss; Unterhalt 2 Gold + 1 AK/Runde. Ertrag: `+2 Einfluss/Runde` und Collegiumsstufe.
- **Anwerben von Fachkräften**: Kosten 18 Gold, 5 Einfluss; Unterhalt 3 Gold/Runde. Effekt: Bonus auf Rekrutierung Handwerker‑Fachkräfte (Wurf/Modifikator TBD); zusätzliche einfache Fachkraft (Handwerker) alle 4 Runden zu halben Kosten (Soll‑Text).

### Ämter (Einrichtungen — Übersicht, Soll)

#### Allgemeine Einrichtungen der Ämter (Cap)

- Cap: bis zu **2/3/4** allgemeine Einrichtungen pro Amt (klein/mittel/groß).

#### Allgemeine Einrichtungen (Auswahl)

Kleines Amt:
- **Regelmäßige politische Gefälligkeiten**: Kosten 10 Gold; Unterhalt 1 Einfluss/Runde. Effekt: senkt Kosten für Politische Schritte und Einflussgewinn um `-1 Einfluss` und `-1 Gold`.
- **Zusätzliche Schreibstuben anmieten**: Kosten 8 Gold; Unterhalt 1 Gold/Runde. Ertrag `+1 Einfluss/Runde`. Effekt: reduziert die Kosten anderer Einrichtungen um `-2 Gold` und `-2 Einfluss` je Einrichtung.
- **Klienten als Botenläufer und Amtsdiener**: Kosten 8 Gold; Unterhalt 1 AK + 1 Gold/Runde. Effekt: `+1` auf Politische Schritte und Verteidigung (genaues Mapping TBD).
- **Rekrutierung fähiger Subalterne**: Kosten 8 Gold, 8 Einfluss; Unterhalt 2 Gold + 2 Einfluss/Runde. Ertrag `+1 AK`; Effekt: `+1` auf Fachkraft‑Anwerben; neue Fachkräfte Loyalität `+1`.

Ab mittlerem Amt:
- **Reiche Repräsentationsräume, Amtssiegel und Trachten**: Kosten 15 Gold, 2 RM (teures Material); Unterhalt 2 Gold/Runde. Ertrag `+1 Einfluss/Runde`; Vorteil: senkt Einflussgewinn‑DC um `-1` (alle).
- **Sonderarchiv**: Kosten 12 Gold, 1 AK; Unterhalt 1 Gold/Runde. Effekt: bessere Verteidigung gegen Intrigen; senkt Kosten/Schwierigkeit politischer Informationsgewinn (TBD).
- **Griff in die Kassen** (einmalig): Kosten 12 Einfluss; Effekt `+1` Bonusaktion Geldgewinn (max 2 Investitionen); Nachteil: `+4 DC` auf politische Aktionen und Einflussgewinn in der nächsten Runde.
- **Legitimat als Berater**: Kosten 18 Gold, 1 Fachkraft (Jurist/Anwalt); Unterhalt 4 Gold/Runde. Effekt: Bonusreaktion auf politische Reaktionen (rechtliche Angelegenheiten).
- **Ämterverkauf**: Kosten 30 Einfluss; Ertrag `+3` Einfluss **oder** Gold/Runde (Wahl); Nachteil: Kosten von Einrichtungen dauerhaft `+5 Gold` **oder** `+5 Einfluss` (Wahl/Bindung TBD).
- **Administrative Reformen**: Kosten 20 Gold, 40 Einfluss; Voraussetzung: mind. 2 Ämter; Unterhalt 2 Gold/Runde. Effekt: erlaubt 50:50‑Kombination aus Gold‑ und Einfluss‑Ertrag je Amt.

#### Amtspezialisierungen & besondere Einrichtungen

- Ämter sind **immer spezialisiert** (Spezialisierung wird beim Erwerb gewählt).
- Pro Amtsstufe (klein/mittel/groß) ist typischerweise `+1` zusätzliche **besondere** Einrichtung zulässig (Soll; genaue Caps je Spezialisierung TBD).

Aktueller Stand: Detailkatalog wird in diesen Abschnitt übernommen/normalisiert (Kirchenaufsicht, Städtische Verwaltung, Hof- & Ehrenämter, Provinzverwaltung, Offiziersposten). TBD.

### Handelsunternehmungen (Einrichtungen — Übersicht, Soll)

#### Allgemeine Einrichtungen (Auswahl)

- **Günstige Abnahmeverträge**: Kosten 8 Gold, 2 Einfluss; Unterhalt 1 AK/Runde. Effekt: senkt Geldgewinn‑DC (Verkauf) um `-1` bei kleinen Investitionen; besserer Marktzugang (TBD).
- **Mieten von Lagerplätzen**: Kosten 10 Gold, 1 AK (einmalig); Unterhalt 1 AK/Runde. Effekt: Lagerung von `10 RM` oder `5 SM` pro Handelsunternehmungsstufe (slotfrei; zusätzlich zu Lagern).
- **Schreibstuben**: Kosten 8 Gold, 1 AK; Unterhalt 1 Gold/Runde. Effekt: `-1 DC` auf Geldgewinn (Ankauf/Verkauf); reduziert Kosten für Handelsunternehmungs‑Ausbauten um `-2 Gold` pro Stufe.
- **Missionen zu den Mächtigen**: Kosten 15 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde. Ertrag: `+2 Einfluss/Runde` und Stufe der Unternehmung.

Ab mittlerer Handelsunternehmung:
- **Honoratische Handelsagenten**: Kosten 15 Gold, 4 Einfluss; Unterhalt 2 Gold/Runde. Ertrag `+2 Einfluss/Runde` und Stufe; Vorteil `+1` auf Politische Schritte (TBD).
- **Konstante Handels‑Missionen**: Kosten 16 Gold, 4 Einfluss; Unterhalt 2 Gold + 1 RM/Runde. Effekt: `+2 Gold` und `+2 Einfluss` pro Runde.
- **Investitionsgemeinschaft**: Kosten 20 Gold, 10 Einfluss; Unterhalt `+2 Gold + 2 Einfluss` pro Runde. Effekt: erhöht maximale Investitionen bei Geldverleih um `+1` pro Handelsunternehmungsstufe.
- **Regionaler Handelsstützpunkt**: Kosten 20 Gold, 12 Einfluss; Unterhalt 3 Gold + 1 SM (teures Material)/Runde. Ertrag `+2 Einfluss/Runde`; `+1` Absatzmarkt (zusätzlicher Markt).

Nur große Handelsunternehmung:
- **Lokales Warenmonopol**: Kosten 40 Gold, 30 Einfluss; Unterhalt 4 Gold + 4 Einfluss/Runde. Effekt: Kontrolle über Warengruppe; `+1d8 Gold/Runde` im Marktsystem; `+1` Bonusaktion Geldgewinn: Verkauf alle 2 Runden.

Besondere Einrichtungen: Handelsschiffe, Karawanen, Monopole (Details TBD).

### Truppen (Einrichtungen — Übersicht, Soll)

#### Allgemeine Truppeneinrichtungen (Auswahl)

- **Loyalität sichern**: Kosten 8 Gold, 5 Einfluss; Effekt: `+1` auf Loyalität für die Runde.
- **Waffenkammer**: Kosten 10 Gold, 4 RM (Waffen); Effekt: `+1` offene Kampfkraft pro 2 Stufen einer Kampfkrafteinheit; kann mehrere Typen am Standort bedienen (TBD).
- **Unterkünfte**: Kosten 12 Gold, 6 RM (Bauholz/Ziegel); Unterhalt 1 Gold/Runde; Effekt: reduziert Unterhalt um `-1 Gold` pro 2 Kampfkraftstufen; bei Überraschungsangriff `+2` Kampfkraft erste Runde.
- **Erfahrene Ausbilder**: Kosten 18 Gold, 2 Fachkräfte (Kampftrainer); Unterhalt 3 Gold/Runde; Effekt: `+1` Kampfkraft für alle Truppentypen.

#### Mittlere Truppen‑Einrichtungen (Auswahl)

- **Aktive Rekrutierung**: Kosten 14 Gold, 8 Einfluss; Unterhalt 1 Gold/Runde; Effekt: Rekrutierungskosten `-2 Gold` pro Einheit.
- **Veteranen‑Unterführer**: Kosten 16 Gold, 8 Einfluss; Unterhalt 3 Gold/Runde; Effekt: `+2` auf Kampfkoordinationsproben; `+1` Kampfkraft pro 2 Truppenstufen; kann neue “verbesserte Kämpfer” erzeugen (TBD).
- **Feldscher und Wundärzte**: Kosten 20 Gold, 3 SM (Medizin), 1 Fachkraft (Chirurg); Unterhalt 3 Gold + 1 SM (Medizin)/Runde; Effekt: reduziert Verluste, beschleunigt Genesung (Prozente TBD).
- **Altenteile und Pensionskasse**: Kosten 25 Gold, 10 Einfluss; Unterhalt 2 Gold pro Kampfkraftstufe alle 5 Runden; Effekt: `+4` Loyalität; `+2` auf Rekrutierung; Reserveeffekte (TBD).

Besondere je Truppentyp (Auswahl): Leibgarde‑Prunkrüstungen, Miliz‑Wach‑ und Glockentürme, Söldner‑Kontrakte, Schläger‑Schutzgeldsystem, Kult‑Rituale, etc. (TBD).
