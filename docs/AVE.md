Grundkonzept: Die "Aktionswert-Einheit" (AVE)

Wir definieren eine abstrakte "Aktionswert-Einheit" (AVE). Das Ziel ist, dass jede generierte Aktion, nach Verrechnung aller Faktoren, einen Netto-Erwartungswert von ungefähr 1 AVE hat. Das bedeutet, der Spieler investiert Ressourcen und Risiko und erhält im Erfolgsfall einen Nutzen, der diese Investition (im Durchschnitt und über die Zeit) leicht übersteigt, was den Anreiz schafft, die Aktion durchzuführen.

1. Komponenten einer Dynamischen Aktion:

Jede dynamisch generierte Aktion braucht folgende Komponenten:

Aktions-Archetyp: Die Grundart der Aktion (z.B. Einflussnahme, Ressourcengewinnung, Sabotage, Aufbau, Informationsbeschaffung).
Zielobjekt/Kontext: Worauf/auf wen zielt die Aktion (Person, Gruppe, Ort, Ressource, Organisation).
Fluff-Text: Eine narrative Beschreibung.
Kosten:
Direkte Ressourcen (Gold, Einfluss, AK, RM, SM).
Indirekte Kosten (Zeitverlust, Opportunitätskosten, Reputationsrisiko).
Nutzen (bei Erfolg):
Direkte Ressourcen (Gold, Einfluss, AK, RM, SM).
Temporäre Vorteile (z.B. Bonus auf nächste Aktion, DC-Senkung).
Langfristige Vorteile (z.B. neuer permanenter Posten, Freischaltung neuer Optionen, dauerhafte DC-Senkung).
Informationen.
Schwierigkeitsgrad (DC): Die Grundschwelle für den Erfolg.
Risiko/Konsequenzen bei Fehlschlag:
Verlust der eingesetzten Ressourcen.
Zusätzliche negative Effekte (z.B. negativer Einfluss, Feinde, Beschädigung von Posten).
Erfolgsskala: Wie in deinem System (Sehr gut, Gut, Geschafft, Schlecht geschafft, Fehlschlag), die den Nutzen/Schaden moduliert.
2. System zur Berechnung der Variablen und des AVE:

Schritt A: Basiswerte für Ressourcen und Effekte (AVE-Äquivalente)

Zuerst müssen wir jeder Ressource und jedem Effekt einen ungefähren AVE-Wert zuweisen. Dies ist der schwierigste und subjektivste Teil und erfordert viel Playtesting und Anpassung. Die Werte sind relativ zueinander zu sehen.

Beispielhafte AVE-Äquivalente (muss stark angepasst werden!):

1 Gold ≈ 0.1 AVE
1 Temporärer Einfluss ≈ 0.05 AVE
1 Semipermanenter Einfluss (pro Runde) ≈ 0.2 AVE
1 Permanent anfallender Einfluss (pro Runde) ≈ 0.5 AVE
1 AK (temporär für die Aktion) ≈ 0.15 AVE
1 AK (permanent pro Runde) ≈ 0.8 AVE
1 RM (Durchschnittswert) ≈ 0.02 AVE
1 SM (Durchschnittswert, da 1 SM = 2 Gold) ≈ 0.2 AVE
Zeit (1 Aktion "wert") ≈ 1.0 AVE (Opportunitätskosten, was hätte man sonst tun können)
DC-Punkt (Senkung um 1) ≈ 0.05 - 0.1 AVE (je nach Kontext)
Freischaltung einer neuen Option ≈ 0.5 - 2.0 AVE (je nach Mächtigkeit)
Kleiner permanenter Posten (z.B. kleine Werkstatt) ≈ Summe seiner Erträge über X Runden, diskontiert.
Schritt B: Definition von Aktions-Archetypen und ihren Modifikatoren

Erstelle eine Bibliothek von Archetypen mit Basisparametern und Skalierungsfaktoren.

Beispiel Archetyp: "Beamten bestechen"

Ziel: Einfluss gewinnen, Information erhalten, Genehmigung.
Basis-Kosten: Gold, temporärer Einfluss.
Basis-Nutzen: Temporärer/Semipermanenter Einfluss, Information.
Basis-DC: Mittel.
Basis-Fehlschlag: Goldverlust, kleiner Reputationsschaden.
Modifikatoren:

Zielrang:
Niedriger Rang: Kosten x0.5, Nutzen x0.5, DC -2.
Mittlerer Rang: Kosten x1, Nutzen x1, DC +0.
Hoher Rang: Kosten x2, Nutzen x2, DC +3.
Ziel-Integrität (zufällig oder aus Weltdaten):
Korrupt: Kosten x0.7, DC -2.
Integer: Kosten x1.5, DC +2, Risiko bei Fehlschlag höher.
Spieler-Reputation/Beziehung zum Ziel: Modifiziert DC, Kosten.
Schritt C: Der Generierungs- und Balancing-Algorithmus

Auswahl des Archetyps und Zielobjekts:

Kann zufällig sein, vom Spieler getriggert (z.B. "Ich will den Kämmerer beeinflussen") oder kontextabhängig (z.B. Spieler braucht mehr RM -> Generiere "Mine erschließen" oder "Handelsabkommen für RM").
Bestimmung der "Größenordnung" der Aktion:

Klein, Mittel, Groß (analog zu deinen Investitionsgrößen). Dies skaliert alle folgenden Werte. Ziel ist es, dass eine "große" Aktion einen entsprechend größeren Nutzen hat, aber auch höhere Kosten/Risiken, um den Netto-AVE von ~1 zu halten.
Berechnung der Roh-Kosten (K_roh_AVE):

Basierend auf Archetyp, Ziel, Größenordnung. Multipliziere die benötigten Ressourcen mit ihren AVE-Äquivalenten.
K_roh_AVE = (Gold * AVE_Gold) + (Einfluss * AVE_Einfluss) + ...
Berechnung des Roh-Nutzens bei Erfolg (N_roh_AVE):

Basierend auf Archetyp, Ziel, Größenordnung. Multipliziere die erhaltenen Ressourcen/Effekte mit ihren AVE-Äquivalenten.
N_roh_AVE = (Gold_Ertrag * AVE_Gold) + (Einfluss_Ertrag * AVE_Einfluss) + ...
Langfristige Nutzen: Müssen diskontiert werden. Ein permanenter Ertrag von +1 Gold/Runde ist nicht unendlich viel wert. Schätze eine "Nutzungsdauer" (z.B. 10-20 Runden) und multipliziere damit, ggf. mit einem Abzinsungsfaktor für spätere Erträge.
Bestimmung des Basis-DC und der Erfolgswahrscheinlichkeit (P_erfolg):

Basierend auf Archetyp, Ziel, Größenordnung.
Um P_erfolg zu schätzen, braucht die KI eine Annahme über die durchschnittliche Fähigkeit/Boni des Spielers (z.B. Spieler schafft DC 12 mit 60% Wahrscheinlichkeit, DC 15 mit 45% usw.).
P_fehlschlag = 1 - P_erfolg.
Modifiziere P_erfolg durch die Erfolgsskala:
P(Sehr gut), P(Gut), P(Geschafft), P(Schlecht geschafft).
Der Nutzen wird entsprechend skaliert (z.B. Sehr gut = N_roh_AVE * 1.5, Geschafft = N_roh_AVE * 1.0, Schlecht geschafft = N_roh_AVE * 0.5).
Gewichteter Durchschnittsnutzen (N_erwartet_AVE): Summe von (P(Erfolgsgrad_i) * Nutzen_AVE_i).
Bestimmung der Kosten bei Fehlschlag (K_fehlschlag_AVE):

Verlust der eingesetzten Ressourcen (K_roh_AVE).
Zusätzliche negative Effekte (z.B. Reputationsverlust * AVE_Reputation).
K_total_fehlschlag_AVE = K_roh_AVE + K_zusatz_fehlschlag_AVE.
Berechnung des Netto-Erwartungswerts (NEV_AVE):

NEV_AVE = (N_erwartet_AVE * P_erfolg) - (K_roh_AVE) - (K_total_fehlschlag_AVE * P_fehlschlag)
Alternative, einfachere Formel, wenn K_roh_AVE bei Fehlschlag immer verloren geht: NEV_AVE = (N_erwartet_AVE * P_erfolg) - K_roh_AVE - (K_zusatz_fehlschlag_AVE * P_fehlschlag)
Noch einfacher, wenn man den Nutzen nur bei "Geschafft" betrachtet und P_erfolg die Wahrscheinlichkeit für mind. "Geschafft" ist: NEV_AVE = (N_roh_AVE * P_erfolg) - K_roh_AVE - (K_zusatz_fehlschlag_AVE * P_fehlschlag)
Balancing-Loop – Ziel: NEV_AVE ≈ 1 (oder ein kleiner positiver Zielwert):

Wenn NEV_AVE zu hoch:
Erhöhe K_roh_AVE (mehr Gold, mehr Einfluss nötig).
Reduziere N_roh_AVE (weniger Ertrag).
Erhöhe den DC (senkt P_erfolg).
Erhöhe K_zusatz_fehlschlag_AVE (schlimmere Konsequenzen).
Wenn NEV_AVE zu niedrig (sogar negativ):
Reduziere K_roh_AVE.
Erhöhe N_roh_AVE.
Senke den DC.
Reduziere K_zusatz_fehlschlag_AVE.
Die KI iteriert diese Anpassungen, bis der NEV_AVE im Zielbereich liegt (z.B. 0.8 bis 1.2 AVE).
Priorisiere Anpassungen, die thematisch Sinn ergeben (z.B. Bestechung eines hohen Beamten sollte eher teuer sein als einen sehr niedrigen DC haben).
Fluff-Text Generierung:

Nutze Templates basierend auf Archetyp, Ziel, Kosten und Nutzen.
Beispiel: "Der zwielichtige Hafenmeister Grumbol scheint ein offenes Ohr für klingende Münze zu haben. Für [Kosten: X Gold, Y Einfluss] könnte er 'übersehen', dass Eure nächste Schiffsladung [Nutzen: +Z RM einer bestimmten Art] ohne die üblichen Zölle durchgeht. Aber Vorsicht, wird Euer Versuch entdeckt [Fehlschlag: Verlust des Geldes, -W Ruf bei der Stadtwache], könnte das ernste Konsequenzen haben. (DC [DC-Wert])"
Schritt D: Implementierung und Verfeinerung

Datenbanken: Für Archetypen, Zielobjekte, Fluff-Schnipsel, AVE-Äquivalente.
Kontextsensitivität: Das System sollte den aktuellen Spielzustand berücksichtigen (z.B. vorhandene Posten des Spielers können Kosten senken oder Nutzen erhöhen, aktuelle Marktsituation kann AVE von RM/SM beeinflussen).
"Coolness-Faktor": Manchmal darf eine Aktion auch einen etwas höheren NEV_AVE haben, wenn sie besonders thematisch passend oder "episch" ist. Nicht alles muss mathematisch perfekt sein, der Spielspaß zählt.
Transparenz für den Spieler (optional): Man könnte dem Spieler ungefähre Angaben zu Risiko/Chance/möglichem Ertrag geben, ohne die genauen Zahlen preiszugeben.
Herausforderungen:

AVE-Definition: Das Herzstück. Muss ständig angepasst werden. Was ist 1 Einfluss "wert" im Vergleich zu 1 Gold? Ändert sich das im Spielverlauf?
Langfristige Effekte: Wie bewertet man den Nutzen einer Aktion, die erst viele Runden später Früchte trägt oder neue strategische Optionen eröffnet? Hier sind Diskontierungsfaktoren und Schätzungen nötig.
Kombinationseffekte: Aktionen können sich gegenseitig beeinflussen.
Spielerwahrnehmung: Selbst wenn mathematisch balanciert, muss es sich für den Spieler fair und lohnend anfühlen.
Beispielhafte Anwendung des "Gesamtwert 1" Prinzips:

Angenommen, unser Ziel-NEV_AVE ist 0.2 AVE (d.h. im Schnitt macht der Spieler einen kleinen "Gewinn" in abstrakten Werteinheiten).

Aktion "Informanten bezahlen":
Kosten: 5 Gold (0.5 AVE), 2 Temp. Einfluss (0.1 AVE) => K_roh_AVE = 0.6 AVE
Nutzen (bei Erfolg "Geschafft"): Wichtige Info (geschätzt 1.0 AVE)
DC 13 (angenommene P_erfolg für "Geschafft" = 50%)
Fehlschlag: Gold weg, -1 Temp. Einfluss (0.05 AVE) => K_zusatz_fehlschlag_AVE = 0.05 AVE
NEV_AVE = (1.0 * 0.5) - 0.6 - (0.05 * 0.5) = 0.5 - 0.6 - 0.025 = -0.125 AVE
System-Anpassung: NEV zu niedrig. Reduziere Goldkosten auf 3 (0.3 AVE).
Neuer K_roh_AVE = 0.4 AVE.
NEV_AVE = (1.0 * 0.5) - 0.4 - (0.05 * 0.5) = 0.5 - 0.4 - 0.025 = 0.075 AVE.
System-Anpassung: Immer noch etwas niedrig. Erhöhe den Nutzen auf "Info + kleiner temporärer Bonus auf nächste Spionageaktion" (Gesamtnutzen 1.2 AVE).
NEV_AVE = (1.2 * 0.5) - 0.4 - (0.05 * 0.5) = 0.6 - 0.4 - 0.025 = 0.175 AVE.
Das ist jetzt im Zielbereich (z.B. 0.15 - 0.25 AVE). Aktion wird generiert.
Dieses System ist ein Rahmen. Die Kunst liegt in der Definition der AVE-Werte, der Archetypen und dem intelligenten Balancing-Algorithmus. Es wird viel Iteration und Feintuning erfordern, aber das Ergebnis könnte eine sehr lebendige und dynamische Spielwelt sein!