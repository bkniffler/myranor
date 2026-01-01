# Materialkatalog (Soll)

Status: Source of Truth für **Soll**‑Regeln (`docs/rules/soll/*`).  
Hinweis: Market‑Gruppen orientieren sich zunächst an `docs/rules/tables/market.md` (v1) und können in Soll später separat versioniert werden.

Konventionen:
- `id` ist stabil und wird (später) im Code als Schlüssel verwendet.
- `kind`: `raw` (= Rohmaterial/RM) oder `special` (= Sondermaterial/SM).
- `tier`: `cheap` / `basic` / `expensive` (Preis-/Seltenheitsstufe).
- `saleBonusGold`: zusätzlicher Goldbonus **pro 4 Einheiten**, wenn verkauft/auto‑umgewandelt (siehe `docs/rules/soll/aufbausystem.md`).
- Verbessertes Rohmaterial ist `kind=raw` und trägt das Tag `improved`.
- „Doppelt veredeltes“ Sondermaterial ist `kind=special` und trägt das Tag `refined2`.
- Flavour‑Namen (Soll): **Mindorium/Mondsilber/Arkanium/Endurium** sind Varianten von `special.highMagicOres` (**Hochmagische Erze/Metalle**).

| id | label | kind | tier | marketGroup | saleBonusGold | tags |
| --- | --- | --- | --- | --- | --- | --- |
| raw.clay | Ton | raw | cheap | rawCheapBuilding | 0 | building |
| raw.quartzSand | Quarzsand | raw | cheap | rawCheapBuilding | 0 | building |
| raw.tar | Teer | raw | cheap | rawCheapBuilding | 0 | building,military |
| raw.wood | Holz | raw | cheap | rawCheapBuilding | 0 | building,military |
| raw.wool | Wolle | raw | cheap | rawCheapConsumable | 0 | consumable |
| raw.fruit | Obst | raw | cheap | rawCheapFood | 0 | food,consumable |
| raw.grapes | Weinreben/Trauben | raw | cheap | rawCheapFood | 0 | food,consumable |
| raw.grain | Getreide | raw | cheap | rawCheapFood | 0 | food,military |
| raw.vegetables | Gemüse | raw | cheap | rawCheapFood | 0 | food |
| raw.herbsFlowers | Kräuter/Blumen | raw | cheap | rawCheapConsumable | 0 | consumable,medicine |
| raw.olives | Oliven | raw | cheap | rawCheapFood | 0 | food |
| raw.stone | Stein | raw | cheap | rawCheapBuilding | 0 | building |
| raw.pottery | Tonware (verbessert) | raw | cheap | rawCheapConsumable | 1 | consumable,improved |
| raw.bread | Brot (verbessert) | raw | cheap | rawCheapFood | 1 | food,military,improved |
| raw.lumber | Bauholz (verbessert) | raw | cheap | rawCheapBuilding | 1 | building,military,improved |
| raw.bricks | Ziegel (verbessert) | raw | cheap | rawCheapBuilding | 1 | building,improved |
| raw.dairy | Milch/Käse (verbessert) | raw | cheap | rawCheapFood | 1 | food,improved |
| raw.charcoal | Holzkohle (verbessert) | raw | cheap | rawCheapConsumable | 1 | consumable,improved |
| raw.fishPreserved | Fisch/Pökelfisch (verbessert) | raw | cheap | rawCheapFood | 1 | food,military,improved |
| raw.buildStone | Baugestein | raw | basic | rawBasicBuilding | 0 | building |
| raw.honey | Honig | raw | basic | rawBasicConsumable | 0 | consumable,food |
| raw.ironOre | Eisenerz | raw | basic | rawBasicConsumable | 0 | metal,building,military |
| raw.leather | Leder | raw | basic | rawBasicConsumable | 0 | consumable,military |
| raw.copperOre | Kupfererz | raw | basic | rawBasicConsumable | 0 | metal,building |
| raw.leadBrassTin | Blei/Messing/Zinn | raw | basic | rawBasicConsumable | 1 | metal,building |
| raw.salt | Salz | raw | basic | rawBasicConsumable | 1 | food,military,consumable |
| raw.pigsSheepVarken | Schweine/Schafe/Varken | raw | basic | rawBasicFood | 2 | animal,food,military |
| raw.aquavit | Aquavit (verbessert) | raw | basic | rawBasicConsumable | 1 | food,consumable,improved |
| raw.leatherGoods | Lederwaren (verbessert) | raw | basic | rawBasicConsumable | 1 | consumable,military,improved |
| raw.bronze | Bronze (verhüttet; verbessert) | raw | basic | rawBasicConsumable | 1 | metal,building,improved |
| raw.iron | Eisen (verhüttet; verbessert) | raw | basic | rawBasicConsumable | 1 | metal,building,military,improved |
| raw.meatPreserved | Fleisch/Pökelfleisch (verbessert) | raw | basic | rawBasicFood | 2 | food,military,improved |
| raw.steel | Stahl (verbessert) | raw | basic | rawBasicConsumable | 2 | metal,building,military,improved |
| raw.oliveOil | Olivenöl (verbessert) | raw | basic | rawBasicConsumable | 2 | consumable,military,improved |
| raw.wine | Wein (verbessert) | raw | basic | rawBasicConsumable | 3 | luxury,consumable,improved |
| raw.marbleGranite | Granit/Marmor | raw | expensive | rawExpensiveBuilding | 0 | building |
| raw.hardwood | Edelhölzer | raw | expensive | rawExpensiveBuilding | 0 | building |
| raw.wildGame | Wildbret | raw | expensive | rawExpensiveOther | 1 | food,luxury |
| raw.unpolishedGems | Ungeschliffene Kristalle/Edelsteine | raw | expensive | rawExpensiveOther | 2 | luxury,magic |
| raw.optrolith | Optrolith | raw | expensive | rawExpensiveBuilding | 2 | building,magic |
| raw.packAnimals | Lasttiere | raw | expensive | rawExpensiveOther | 4 | animal,building,military |
| raw.furs | Pelze | raw | expensive | rawExpensiveOther | 4 | luxury,consumable |
| raw.magicPlants | Magische Pflanzen/Gewächse | raw | expensive | rawExpensiveOther | 4 | luxury,magic |
| raw.lesserMagicOres | Mindere magische Erze | raw | expensive | rawExpensiveOther | 6 | luxury,magic |
| raw.cattle | Rinder | raw | expensive | rawExpensiveOther | 6 | animal,food,military |
| raw.exoticBeasts | Exotische Biester | raw | expensive | rawExpensiveOther | 8 | animal,luxury |
| raw.preciousMetals | Edelmetalle | raw | expensive | rawExpensiveOther | 8 | metal,luxury |
| special.pulpellen | Pulpellen | special | cheap | specialCheapFood | -1 | food,consumable,military |
| special.soap | Seife | special | cheap | specialCheapConsumable | -1 | consumable |
| special.simpleTools | Einfache Werkzeuge | special | cheap | specialCheapCraft | 0 | craft,building,military |
| special.brandy | Brandt | special | cheap | specialCheapFood | 0 | consumable,food |
| special.honeyMead | Honigmet | special | cheap | specialCheapFood | 0 | consumable,food |
| special.candles | Kerzen | special | cheap | specialCheapConsumable | 0 | consumable |
| special.paper | Papier | special | cheap | specialCheapOther | 0 | consumable |
| special.bronzeGoods | Bronzeware | special | basic | specialBasicCraft | 0 | craft,metal,consumable |
| special.furniture | Möbel | special | basic | specialBasicCraft | 0 | consumable,building |
| special.cloth | Tuche | special | basic | specialBasicCraft | 1 | consumable |
| special.dyes | Farbstoffe/Tinkturen/Lacke | special | basic | specialBasicOther | 1 | consumable,alchemy,medicine |
| special.weaponsShields | Waffen & Schilde | special | basic | specialBasicCraft | 1 | military,weapon |
| special.fineWine | Edler Wein | special | basic | specialBasicOther | 1 | luxury,consumable |
| special.glassware | Glaswaren | special | basic | specialBasicCraft | 2 | luxury,building |
| special.optrolithCut | Geschliffener Optrolith | special | basic | specialBasicBuilding | 2 | luxury,building,magic |
| special.armor | Rüstungen | special | basic | specialBasicCraft | 2 | military,armor |
| special.statuesMosaics | Statuen/Kunstmosaike | special | basic | specialBasicBuilding | 2 | luxury,building |
| special.booksMaps | Bücher/Kartenmaterial | special | expensive | specialExpensiveLuxury | 1 | luxury |
| special.spices | Gewürze | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.expensiveFurniture | Teure Möbel | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.specialTools | Spezialwerkzeuge (Sonderwerkzeug) | special | expensive | specialExpensiveCraft | 1 | craft,military |
| special.sacredOils | Heilige Öle/Weihrauch | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.fineCloth | Teure Tuche | special | expensive | specialExpensiveCraft | 1 | luxury,consumable |
| special.magicParaphernalia | Magische Paraphernalia | special | expensive | specialExpensiveOther | 2 | magic,craft,luxury |
| special.horses | Pferde/Monokeroi | special | expensive | specialExpensiveOther | 2 | animal,military,luxury |
| special.cutGems | Geschliffene Edelsteine/Kristall | special | expensive | specialExpensiveLuxury | 2 | luxury,magic,refined2 |
| special.mechanicalParts | Mechanische Teile | special | expensive | specialExpensiveCraft | 2 | craft,luxury,refined2 |
| special.undeadLabor | Untote Arbeitskräfte | special | expensive | specialExpensiveOther | 2 | magic,undead,refined2 |
| special.magomechanicalParts | Magomechanische Teile | special | expensive | specialExpensiveCraft | 3 | craft,magic,luxury,refined2 |
| special.potions | Alchemische Tränke/Elixiere | special | expensive | specialExpensiveOther | 3 | alchemy,medicine,luxury,refined2 |
| special.perfume | Parfüms | special | expensive | specialExpensiveLuxury | 3 | luxury,consumable,refined2 |
| special.warhorses | Schlachtrösser | special | expensive | specialExpensiveOther | 3 | animal,military,refined2 |
| special.smallChimeras | Kleinchimären | special | expensive | specialExpensiveOther | 3 | magic,animal,luxury,refined2 |
| special.undeadCombat | Untote Kämpfer | special | expensive | specialExpensiveOther | 3 | magic,undead,military,refined2 |
| special.minorMagicMetals | Mindere magische Metalle/Legierungen | special | expensive | specialExpensiveOther | 3 | magic,metal,luxury,refined2 |
| special.jewelry | Schmuck/Schmuckwerk | special | expensive | specialExpensiveLuxury | 4 | luxury,refined2 |
| special.highMagicOres | Hochmagische Erze/Metalle | special | expensive | specialExpensiveOther | 4 | luxury,magic,refined2 |
| special.workChimeras | Arbeits‑Chimären/Golems | special | expensive | specialExpensiveOther | 4 | magic,luxury,refined2 |
| special.warChimeras | Kampfchimären/Konstrukte/Golems | special | expensive | specialExpensiveOther | 4 | magic,military,luxury,refined2 |
| special.minorMagicArtifacts | Mindere magische Artefakte | special | expensive | specialExpensiveOther | 5 | magic,luxury,refined2 |
