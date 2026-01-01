// Event table (Ereignistabellen) extracted from Aufbausystem.md
// This is the v1 canonical list; keep effectsText close to the source for traceability.

export type EventTableRow = { roll: number; name: string; effectsText: string };

export const EVENT_TABLE_V1: ReadonlyArray<EventTableRow> = [
  {
    roll: 2,
    name: 'Große Hungersnot',
    effectsText:
      '*Rohstoffe*: Nahrungsmittel-RM werden beim automatischen Umtausch am Rundenende automatisch im Verhältnis 3:1 (statt 4:1) in Gold umgewandelt (4 Runden). | *Verkauf*: +2d6 Gold für alle Nahrungsmittel-Verkäufe. | *Pächter*: Pächter/Anhänger-Loyalität sinkt um 2, wenn nicht 1 Nahrung pro 250 Pächter bereitgestellt wird (4 Runden). | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 3,
    name: 'Seuche',
    effectsText:
      '*Untertanen*: -1 AK pro 500 Pächter/Untertanen/Anhänger/Klienten für Abschnitt. – Stufe (einmalig) für alle Spieler (4 Runden). | *Werkstätte*: Unterhalt aller Werkstätten +1 AK (4 Runden). | *Verkauf*: Medizinische Güter, Kräuter und Tränke +1d8 Gold Wert pro Verkauf.',
  },
  {
    roll: 4,
    name: 'Kriegssteuer',
    effectsText:
      '*Abgaben*: Sonderabgabe von 5 Gold für alle Spieler pro Runde (4 Runden).; Weiter Einmal-Abgabe von 4 Gold pro kleinem Amt, 10 Gold pro mittlerem Amt, 20 Gold pro großem Amt | *Rohstoffe*: Verkauf von Waffen und Rüstungen +1d6 Gold Wert.',
  },
  {
    roll: 5,
    name: 'Aufstand in Nachbarprovinz',
    effectsText:
      '*Rohstoffe*: Militärische Güter (Waffen und Rüstungen) +1d4 Gold Wert. | *Untertanen*: Chance auf Übergreifen des Aufstands auf eigene Stadtbesitz (Loyalitätsprobe für Klienten, Anhänger; Loyalität -1). | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 6,
    name: 'Kultüberprüfung',
    effectsText:
      '*Kulte*: Alle Kulte müssen ebei 1-5 auf w20 ine Probe zum Verbergen (DC 14) bestehen oder verlieren 1d6 Einfluss und 1 Anhängerstufe (4 Runden). | *Kirchenaufsicht*: Kirchenaufsichts-Ämter erhalten +6 Einfluss für den Abschnitt (4 Runden).',
  },
  {
    roll: 7,
    name: 'Zahlungsengpässe der Provinzverwaltung',
    effectsText:
      '*Ämter*: Die Hälfte des Gold-Amtseinkommen entfällt für Abschnitt (4 Runden). | *Geldgewinn*: *Geldverleih*: DC steigt um 4 (4 Runden).',
  },
  {
    roll: 8,
    name: 'Dürresommer',
    effectsText:
      '*Domänen*: Ernteerträge aller Landwirtschaftlich und Tierzucht Domänen halbiert für 1 Runde. | *Rohstoffe*: Nahrungsmittel-RM +1d4 Gold Wert jede Runde. | *Brandgefahr*: (1-5 auf w20) Beschädigung einer zufälligen Einrichtung. 1 Runde.',
  },
  {
    roll: 9,
    name: 'Große Bautätigkeit in der Hauptstadt',
    effectsText:
      '*Rohstoffe*: Baustoffe aller Art +1d4 (Billig und Einfach)/+1d6 Gold (Teuer) Wert. | *Werkstätte*: Unterhalt aller Werkstätten +1 Gold (4 Runden). | *Städtische Ämter*: Curia-Ämter erhalten +2 Einfluss für den Abschnitt (4 Runden).',
  },
  {
    roll: 10,
    name: 'Stagnation',
    effectsText:
      '*Verkauf*: Alle teuren Ressourcen -1d4 Gold Wert auf Markttabelle (4 Runden). | *Handelsunternehmen* erzielen nur Hälfte ihres normalen Ertrags (4 Runden). | *Geldgewinn*: *Geldverleih und Verkauf*: DC steigt um 2.',
  },
  {
    roll: 11,
    name: 'Gute Ernte',
    effectsText:
      '*Domänen*: Ernteerträge aller Landwirtschaftlichen Domänen steigt um +8 RM per Runde (4 Runden). | *Verkauf*: Nahrungsmittelpreise -1 Gold Marktwert. | *Pächter*: Pächter-Loyalität steigt um 1. Pächterstufen um die Hälfte verbilligt (4 Runden).',
  },
  {
    roll: 12,
    name: 'Säuberung des Hofes',
    effectsText:
      '*Für alle Hof- und Ehrenämter:* Verlust bei 1-4 auf w20, starten bei kleinen; maximal 2; | *Hof- und Ehrenämter*: +6 Einfluss (4 Runden). | *Einflussgewinnaktionen*: DC -2.',
  },
  {
    roll: 13,
    name: 'Zusammenbruch einer großen Handelsunternehmung',
    effectsText:
      '*Geldgewinn: Geldverleih*: Erträge aus Geldverleih halbiert für den Abschnitt (4 Runden). | *Handelsunternehmung*: +4 Gold Unterhalt pro eigener Handelsunternehmungsstufe (4 Runden). | *Einrichtungen: Handelsunternehmung*: Möglichkeit, günstig Einrichtungen zu erwerben (Halbierte Kosten für 1 Runde).',
  },
  {
    roll: 14,
    name: 'Magischer Unfall',
    effectsText:
      '*Städtischer Besitz:* Beschädigung einer Einrichtung bei 1-5 auf w20 für normale Einrichtungen, 1-10 auf w 20 für Cammern, Achemielabore und Magomanufakturen (max 2). | *Verkauf*: Magische Paraphernalia +1d6 Gold Wert. | *Kauf*: Chance auf magisches Artefakt zum Verkauf (1-5 auf w20). | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 15,
    name: 'Starke Unwetter und Stürme',
    effectsText:
      '*Einrichtungen*: Schiffe erzielen nur die Hälfte ihres normalen Ertrags (4 Runden). | *Handelsunternehmungen*: +3 Gold Unterhalt pro eigener Handelsunternehmungsstufe (4 Runden). | *Verkauf*: Bauholz und Fisch +1d4 Gold Marktwert. | *Geldgewinn: Verkauf*: +1 DC (4 Runden). | *Sturmschäden*: Chance auf Schaden an einer zufälligen Einrichtung (1d6 Gold) (4 Runden).',
  },
  {
    roll: 16,
    name: 'Räuberbanden und Deserteure/Piraterie',
    effectsText:
      'Bestimme mit 1w20: 1-10 = Räuber, 11-20 = Piraten; | *Falls Räuber*: Domänen müssen auf 1-5 auf w20 Verteidigungsprobe (DC 13) ablegen oder verlieren 1d6 RM (4 Runden). | *Falls Piraten*: Verlust eines Schiffes bei 1-5 auf w20, Beschädigung auf 6-10 auf w 20 (max.2) (4 Runden). | *In jedem Fall:* | *Handelsunternehmungen*: +3 Gold Unterhalt pro eigener Handelsunternehmungsstufe (4 Runden). | *Geldgewinn: Verkauf*: DC +2 (4 Runden).',
  },
  {
    roll: 17,
    name: 'Sperrung wichtiger Pässe, Marodierende Söldner',
    effectsText:
      '*Handelsunternehmungen*: Halbierte Erträge. | *Verkauf*: Alle Teuren SM +2 Gold Marktwert; | *Truppen*: Kosten für 1 Stufe Söldnerrekrutierung pro Runde Halbiert;',
  },
  {
    roll: 18,
    name: 'Korruptionsuntersuchung',
    effectsText:
      '*Alle Ämter*: Halbierter Einfluss (4 Runden). | *Unterweltcircel, Spionageringe und Kulte:* erhalten +2 Einfluss pro Stufe (4 Runden). | *Politische Schritte*: -2 DC (4 Runden). | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 19,
    name: 'Der Fliegende Basar',
    effectsText:
      '*Verkauf*: Alle teuren SM -1d6 Gold Marktwert. | *Kauf*: Chance auf magisches Artefakt zum Verkauf (1-5 auf w20).',
  },
  {
    roll: 20,
    name: 'Alchemistischer Unfall',
    effectsText:
      '*Städtischer Besitz:* Beschädigung einer Einrichtung oder Anhängerstfe bei 1-5 auf w20 für normale Einrichtungen, 1-10 auf w 20 für Achemielabore (max 1). | *Verkauf*: Alchemiche Tränke +1d6 Gold Wert. | *Werkstätten:* +1 Gold Unterhalt per Werkstätte (4 Runden) | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 21,
    name: 'Neues Bergwerk erschlossen',
    effectsText: '*Verkauf*: Metallische Rohstoffe -1d4 Gold Marktwert.',
  },
  {
    roll: 22,
    name: 'Offener Konflikt in Nachbarprovinz',
    effectsText:
      '*Handelsunternehmungen*: +3 Gold Unterhalt per Stufe (4 Runden). | *Ehrenämter und Hofämter*: +4 Einfluss per Runde (4 Runden).',
  },
  {
    roll: 23,
    name: 'Erhöhte Steuereinnahmen',
    effectsText:
      '*Alle Ämter*: +2 Gold per Runde und Stufe (4 Runden). | *Einrichtungen*: Kosten Allgemeiner Amtseinrichtungen Verdoppelt (4 Runden). | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 24,
    name: 'Opulente Religiöse Feiertage und Prozessionen',
    effectsText:
      '*Kulte und Kultaufsichts-Ämter*: +6 Einfluss (4 Runden). | *Untertanen*: Loyalität steigt um 1 (4 Runden). | *Kirchenaufsichts-Ämter*: +3 Gold Unterhalt per Stufe (4 Runden).',
  },
  {
    roll: 25,
    name: 'Kriegszug und Musterung',
    effectsText:
      '*Militärämter*: +4 Einfluss. | *Truppen*: Verdoppelte Kosten für Truppenstufen; | *Söldner*: Können für 8 Gold pro Stufe und Runde abgestellte werden, verlieren 1 Stufe; Dann nicht erhältlich für Abschnitt; | *Verkauf:* Nahrungsmittel und Rüstungsgüter +1d4 Gold.',
  },
  {
    roll: 26,
    name: 'Konflikt mit Nachbarn',
    effectsText:
      '*Handelsunternehmungen*: Alle Handelsunternehmungen im Ausland erzielen nur Hälfte ihres Ertrags (4 Runden). | *Circel und Ämter*: Spionageringe und Militärische Ämter +4 Einfluss. | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera; | *Angriffe*: Erhöhte Gefahr (1-5 auf w20) für Übergriffe auf Domänen und Handelsschiffe und Handelsunternehmungen; Abwehr DC +2, (4 Runden).',
  },
  {
    roll: 27,
    name: 'Aufruhr in Denera',
    effectsText:
      '*Handwerkscollegien*: Verlieren 1 AK per Stufe (4 Runden). | *Werkstattunterhalt*: +1 Gold per Stufe (4 Runden). | *Aufruhr*: Beschädigung einer Städtischen Einrichtung, Circels oder Werkstatt bei 1-5 auf w20 (max.3)',
  },
  {
    roll: 28,
    name: 'Unheilvolle Konstellationen',
    effectsText:
      '*Kulte*: +1 Loyalität der Anhänger (4 Runden); | *Cammern*: +2 Zauberkraft per Stufe (4 Runden); | *Untertanen*: Aller Art (bis auf Kult Anhänger) -1 Loyalität; | *Aufruhr in Denera*: Bei 1-10 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 29,
    name: 'Ausbruch Magischer Bestien',
    effectsText:
      '*Domänen*: Benötigen Verteidigungsprobe (DC 15) oder Ertrag sinkt um 4 RM (4 Runden).',
  },
  {
    roll: 30,
    name: 'Große Feuersbrunst in der Stadt',
    effectsText:
      '*Feuersbrunst*: Beschädigung einer Städtischen Einrichtung oder Werkstatt bei 1-5 auf w20 (max.3) | *Verkauf*: Baumaterial +1d4 Gold | *Gewinn von Posten*: Bei 1-5 auf w20 Preis für Städtischen Besitz halbiert (1 Runde) | *Aufruhr in Denera*: Bei 1-5 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 31,
    name: 'Wirtschaftsaufschwung',
    effectsText:
      '*Geldgewinn*: *Geldverleih und Verkauf*: Alle 2 Investitionen erzielen +1 Gold (4 Runden). | *Verkauf*: Luxusgüter +1d4 Gold Wert.',
  },
  {
    roll: 32,
    name: 'Landflucht',
    effectsText:
      '*Domänen*: -1 AK pro 250 Pächter für 1 Runde. | *Unterweltcircel und Handwerkcircel*: +1 AK pro Stufe;',
  },
  {
    roll: 33,
    name: 'Warenüberschuss',
    effectsText:
      '*Handelsunternehmungen*: + 2 Gold oder +1 SM auf Erträge per Stufe (4 Runden). | *Verkauf*: Teure SM -1d4 Marktwert',
  },
  {
    roll: 34,
    name: 'Erbe der Achäer (Ruinenfunde)',
    effectsText:
      '*Domänen*: Bei 1-10 +4 Magische Sondermaterialien | *Cammern oder Kulte*: +1 Zauberkraft per Stufe | *Aufruhr auf dem Land*: LO-Probe oder Aufruhr der Pächter | *Magischer Einfluss*: Bei 1-10: -1 AK per 2 Pächtestufen;',
  },
  {
    roll: 35,
    name: 'Hedonistische Hysterie',
    effectsText:
      '*Verkauf*: Teure SM +2d6 Gold Marktwert. | *Kulte*: +6 Einfluss per Runde (4 Runden). | *Aufruhr in Denera*: Bei 1-5 auf w20: Aufruhr in Denera;',
  },
  {
    roll: 36,
    name: 'Großes Bauprojekt im Horasiat',
    effectsText:
      '*Verkauf*: Baumaterial +2d4 Gold Marktwert. | *Langzeitprojekte*: Bauarbeiter-AK kosten verdoppelt .',
  },
  {
    roll: 37,
    name: 'Entlassene Söldnertruppe plündert',
    effectsText:
      '*Domänen*: Ländliche Domänen ohne Verteidigungseinrichtungen werden angegriffen (Verteidigungsprobe DC 15 oder Verlust von 2d6 RM und 1d3 Pächterstufen), Maximal 2 Domänen; | *Militärämter und Söldnertruppen*: +6 Einfluss (4 Runden).',
  },
  {
    roll: 38,
    name: 'Großes Wunder in Provinz',
    effectsText:
      '*Kulte*: Bei 1-5 auf w20: +6 Einfluss und +6 Gold per Stufe (4 Runden). | *Gasthäuser, Handelsposten und Herbergen*: +1d6 Gold Ertrag (4 Runden).',
  },
  {
    roll: 39,
    name: 'Provinzinspektion',
    effectsText:
      '*Ämter*: Politische Abwehrprobe (DC 15) oder verlieren 2d6 Einfluss per Stufe per Runde (4 Runden). | *Einflussgewinn-Aktion*: -4 DC',
  },
  {
    roll: 40,
    name: 'Sehr gutes Jahr',
    effectsText:
      '*Domänen*: Ernteerträge aller Landwirtschaftlichen/Tierzucht/Forstwirtschaftlichen Domänen steigt um die Hälfte (1 Runde). +8 RM per Runde für Landwirtschaftlich Spezialisierte Domänen (4 Runden); | *Verkauf*: Nahrungsmittelpreise -1d4 Gold Marktwert. | *Untertanen*: Pächterstufen steigen auf allen Domänen um 1; Pächter-Loyalität steigt um 2.',
  },
] as const;
