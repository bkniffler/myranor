# Strategien (LLM, core-v1-strategies)

Diese Datei listet die LLM-Strategien fuer das Szenario `core-v1-strategies`.

## Amtsfokus
- Risiko: aggressive
- Primaer:
  - Aemter sammeln (klein -> mittel -> gross), wenn bezahlbar
  - Temporaeren Einfluss nutzen, um Aemter frueh zu sichern
  - Grosse Domaene anstreben (small -> medium -> large), sobald finanzierbar
- Sekundaer:
  - Staedtischer Besitz fuer Einfluss/Gold
  - Geldgewinnaktionen zur Finanzierung
  - Lager bauen, um RM/SM zu halten (bei schlechtem Markt)
  - Organisationen (Kult/Collegium), wenn moeglich
- Guardrails:
  - Goldreserve >= 6
  - Wenn Einfluss < 4: Einfluss gewinnen
  - Aemter nicht erzwingen, wenn Cap erreicht oder Ressourcen fehlen
  - Nicht nur Einfluss waehlen, wenn Verkauf/Material sinnvoll ist

## Handel & Geld
- Risiko: aggressive
- Primaer:
  - Geldgewinn (MoneySell/MoneyLend) priorisieren
  - Handelsunternehmungen erwerben
  - RM kaufen, wenn Markt guenstig (MoneyBuy/MoneySellBuy)
  - Lager bauen, um RM/SM zu halten und spaeter teurer zu verkaufen
  - Grosse Domaene anstreben (Cap + Rohstoffzufuhr)
- Sekundaer:
  - Staedtischer Besitz fuer Gold/Einfluss
  - Werkstattaufsicht fuer SM
  - Werkstatt bauen, wenn genug RM fuer Umwandlung
- Guardrails:
  - Goldreserve >= 4
  - Wenn Inventar leer: Materialgewinn priorisieren
  - Wenn Markt schlecht und Lager vorhanden: nicht verkaufen

## Stadt & Unterwelt
- Risiko: aggressive
- Primaer:
  - Staedtischen Besitz aufbauen
  - Unterwelt-Organisation priorisieren
  - Geldgewinn fuer Stabilitaet
  - Grosse Domaene anstreben, wenn bezahlbar
- Sekundaer:
  - Einflussgewinn fuer Orga-Kosten
  - Werkstattaufsicht wenn AK uebrig
  - Lager bauen, wenn Markt schlecht und Vorrat sinnvoll
- Guardrails:
  - Goldreserve >= 6
  - HQ-Anforderung fuer Orga beachten
  - Nicht zu frueh in Domaenen investieren, wenn Stadt/Orga stockt

## Werkstattfokus
- Risiko: conservative
- Primaer:
  - Werkstaetten aufbauen/ausbauen
  - RM kaufen, wenn Markt guenstig (MoneyBuy/MoneySellBuy)
  - Lager bauen, um RM/SM zu puffern
  - Staedtischer Besitz fuer Produktionskapazitaet
  - Grosse Domaene anstreben (Rohstoffbasis)
- Sekundaer:
  - Geldgewinn bei Ueberschuss
  - Handwerkscollegium, wenn moeglich
- Guardrails:
  - AK nicht unter 1 druecken
  - Goldreserve >= 6
  - Nicht verkaufen, wenn Werkstaetten Input brauchen

## Domaenenfokus
- Risiko: conservative
- Primaer:
  - Domaenen erwerben (small -> medium -> large)
  - Materialgewinn Domaene
  - Lager bauen, um RM/SM zu halten
  - Verkauf von RM/SM, wenn Markt gut
- Sekundaer:
  - Handelsunternehmung, wenn Gold uebrig
  - Werkstatt bauen, wenn RM-Ueberschuss
- Guardrails:
  - Goldreserve >= 6
  - Wenn Inventar voll: MoneySell priorisieren
  - Nicht in Stadt/Orga investieren, bevor grosse Domaene erreichbar ist
