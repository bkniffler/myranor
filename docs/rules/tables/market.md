# Markttabellen (v1)

Status: canonical (2d6-Tabellen, Modifikatoren pro Investment)

Hinweise:
- Modifikatoren gelten **pro Investment**.
- Gruppen-Namen müssen zu `docs/rules/tables/materials.md` (`marketGroup`) passen.

Diese Tabellen beschreiben die 2d6-Wuerfe fuer Rohmaterial und Sondermaterial.
Die Modifikatoren gelten pro Investment.

## Rohmaterial (2d6)
| Roll | Kategorie | Nachfrage | Modifikatoren (Gruppen) |
| --- | --- | --- | --- |
| 2 | Teuerstes Rohmaterial | Begehrt | rawExpensiveBuilding +2d6, rawExpensiveOther +2d6, alle anderen -1d4 |
| 3 | Billiges Baumaterial | Sehr gefragt | rawCheapBuilding +1d4, alle anderen -1d2 |
| 4 | Billiges Nahrungsmaterial | Sehr gefragt | rawCheapFood +1d4, alle anderen -1d2 |
| 5 | Billiges Verbrauchsgut | Sehr gefragt | rawCheapConsumable +1d4 |
| 6 | Billiges/Einfaches Material | Gefragt | alle rawCheap* +1d2, alle rawBasic* +1d2 |
| 7 | Alle Materialien | Normal | keine Modifikatoren |
| 8 | Einfaches Baumaterial | Sehr gefragt | rawBasicBuilding +1d6 |
| 9 | Einfaches Nahrungsmaterial | Sehr gefragt | rawBasicFood +1d6 |
| 10 | Einfaches Verbrauchsgut | Sehr gefragt | rawBasicConsumable +1d6 |
| 11 | Teures Baumaterial | Gefragt | rawExpensiveBuilding +1d8, alle anderen -1d2 |
| 12 | Teures Material | Nicht gefragt | rawExpensiveBuilding -1d8, rawExpensiveOther -1d8, alle rawCheap* +1d6 |

## Sondermaterial (2d6)
| Roll | Kategorie | Nachfrage | Modifikatoren (Gruppen) |
| --- | --- | --- | --- |
| 2 | Teures Luxusgut | Begehrt | specialExpensiveLuxury +2d8, alle anderen -1d8 |
| 3 | Billiges Handwerksprodukt | Sehr gefragt | specialCheapCraft +1d4, alle anderen -1d2 |
| 4 | Billige Verbrauchsgueter | Sehr gefragt | specialCheapConsumable +1d4, alle anderen -1d2 |
| 5 | Billige Nahrungsveredelung | Gefragt | specialCheapFood +1d2 |
| 6 | Billiges Sondermaterial | Gefragt | specialCheapOther +1d2 |
| 7 | Alle Sondermaterialien | Marktschwankung | alle special* +/-1d2 (1d6: 1-3 = -, 4-6 = +) |
| 8 | Einfache Bauprodukte | Sehr gefragt | specialBasicBuilding +1d6 |
| 9 | Einfache Handwerksprodukte | Sehr gefragt | specialBasicCraft +1d6, alle anderen -1d2 |
| 10 | Teure Bauprodukte | Sehr gefragt | specialExpensiveBuilding +1d10 |
| 11 | Teure Handwerksprodukte | Begehrt | specialExpensiveCraft +2d6, alle anderen -1d2 |
| 12 | Teures Luxusgut | Marktumschwung | specialExpensiveLuxury +/-2d6 oder +/-3d6 (1d6: 1-2 = -2d6, 3-6 = +3d6) |
