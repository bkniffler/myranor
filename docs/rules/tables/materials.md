# Materialkatalog (Engine v1)

Status: canonical (v1 implemented)

Quelle: `src/core/rules/materials_v1.ts`

Konventionen:
- `id` ist stabil und wird im Code als Schlüssel verwendet.
- `kind`: `raw` (= Rohmaterial/RM) oder `special` (= Sondermaterial/SM).
- `tier`: `cheap` / `basic` / `expensive`.
- `marketGroup` muss zu `docs/rules/tables/market.md` passen.
- `saleBonusGold`: zusätzlicher Goldbonus **pro 4 Einheiten**, wenn verkauft/auto‑umgewandelt.
- Verbessertes Rohmaterial ist `kind=raw` und trägt das Tag `improved`.
- „Doppelt veredeltes“ Sondermaterial ist `kind=special` und trägt das Tag `refined2`.

| id | label | kind | tier | marketGroup | saleBonusGold | tags |
| --- | --- | --- | --- | --- | --- | --- |
| raw.aquavit | Aquavit (verbessert) | raw | basic | rawBasicConsumable | 1 | food,consumable,improved |
| raw.bread | Brot (verbessert) | raw | cheap | rawCheapFood | 1 | food,military,improved |
| raw.bricks | Ziegel (verbessert) | raw | cheap | rawCheapBuilding | 1 | building,improved |
| raw.bronze | Bronze (verhüttet; verbessert) | raw | basic | rawBasicConsumable | 1 | metal,building,improved |
| raw.buildStone | Baugestein | raw | basic | rawBasicBuilding | 0 | building |
| raw.cattle | Rinder | raw | expensive | rawExpensiveOther | 6 | animal,food,military |
| raw.charcoal | Holzkohle (verbessert) | raw | cheap | rawCheapConsumable | 1 | consumable,improved |
| raw.clay | Ton | raw | cheap | rawCheapBuilding | 0 | building |
| raw.copperOre | Kupfererz | raw | basic | rawBasicConsumable | 0 | metal,building |
| raw.dairy | Milch/Käse (verbessert) | raw | cheap | rawCheapFood | 1 | food,improved |
| raw.exoticBeasts | Exotische Biester | raw | expensive | rawExpensiveOther | 8 | animal,luxury |
| raw.fishPreserved | Fisch/Pökelfisch (verbessert) | raw | cheap | rawCheapFood | 1 | food,military,improved |
| raw.fruit | Obst | raw | cheap | rawCheapFood | 0 | food,consumable |
| raw.furs | Pelze | raw | expensive | rawExpensiveOther | 4 | luxury,consumable |
| raw.grain | Getreide | raw | cheap | rawCheapFood | 0 | food,military |
| raw.grapes | Weinreben/Trauben | raw | cheap | rawCheapFood | 0 | food,consumable |
| raw.hardwood | Edelhölzer | raw | expensive | rawExpensiveBuilding | 0 | building |
| raw.herbsFlowers | Kräuter/Blumen | raw | cheap | rawCheapConsumable | 0 | consumable,medicine |
| raw.honey | Honig | raw | basic | rawBasicConsumable | 0 | consumable,food |
| raw.iron | Eisen (verhüttet; verbessert) | raw | basic | rawBasicConsumable | 1 | metal,building,military,improved |
| raw.ironOre | Eisenerz | raw | basic | rawBasicConsumable | 0 | metal,building,military |
| raw.leadBrassTin | Blei/Messing/Zinn | raw | basic | rawBasicConsumable | 1 | metal,building |
| raw.leather | Leder | raw | basic | rawBasicConsumable | 0 | consumable,military |
| raw.leatherGoods | Lederwaren (verbessert) | raw | basic | rawBasicConsumable | 1 | consumable,military,improved |
| raw.lesserMagicOres | Mindere magische Erze | raw | expensive | rawExpensiveOther | 6 | luxury,magic |
| raw.lumber | Bauholz (verbessert) | raw | cheap | rawCheapBuilding | 1 | building,military,improved |
| raw.magicPlants | Magische Pflanzen/Gewächse | raw | expensive | rawExpensiveOther | 4 | luxury,magic |
| raw.marbleGranite | Granit/Marmor | raw | expensive | rawExpensiveBuilding | 0 | building |
| raw.meatPreserved | Fleisch/Pökelfleisch (verbessert) | raw | basic | rawBasicFood | 2 | food,military,improved |
| raw.oliveOil | Olivenöl (verbessert) | raw | basic | rawBasicConsumable | 2 | consumable,military,improved |
| raw.olives | Oliven | raw | cheap | rawCheapFood | 0 | food |
| raw.optrolith | Optrolith | raw | expensive | rawExpensiveBuilding | 2 | building,magic |
| raw.packAnimals | Lasttiere | raw | expensive | rawExpensiveOther | 4 | animal,building,military |
| raw.pigsSheepVarken | Schweine/Schafe/Varken | raw | basic | rawBasicFood | 2 | animal,food,military |
| raw.pottery | Tonware (verbessert) | raw | cheap | rawCheapConsumable | 1 | consumable,improved |
| raw.preciousMetals | Edelmetalle | raw | expensive | rawExpensiveOther | 8 | metal,luxury |
| raw.quartzSand | Quarzsand | raw | cheap | rawCheapBuilding | 0 | building |
| raw.salt | Salz | raw | basic | rawBasicConsumable | 1 | food,military,consumable |
| raw.steel | Stahl (verbessert) | raw | basic | rawBasicConsumable | 2 | metal,building,military,improved |
| raw.stone | Stein | raw | cheap | rawCheapBuilding | 0 | building |
| raw.tar | Teer | raw | cheap | rawCheapBuilding | 0 | building,military |
| raw.unpolishedGems | Ungeschliffene Kristalle/Edelsteine | raw | expensive | rawExpensiveOther | 2 | luxury,magic |
| raw.vegetables | Gemüse | raw | cheap | rawCheapFood | 0 | food |
| raw.wildGame | Wildbret | raw | expensive | rawExpensiveOther | 1 | food,luxury |
| raw.wine | Wein (verbessert) | raw | basic | rawBasicConsumable | 3 | luxury,consumable,improved |
| raw.wood | Holz | raw | cheap | rawCheapBuilding | 0 | building,military |
| raw.wool | Wolle | raw | cheap | rawCheapConsumable | 0 | consumable |
| special.armor | Rüstungen | special | basic | specialBasicCraft | 2 | military,armor |
| special.booksMaps | Bücher/Kartenmaterial | special | expensive | specialExpensiveLuxury | 1 | luxury |
| special.brandy | Brandt | special | cheap | specialCheapFood | 0 | consumable,food |
| special.bronzeGoods | Bronzeware | special | basic | specialBasicCraft | 0 | craft,metal,consumable |
| special.candles | Kerzen | special | cheap | specialCheapConsumable | 0 | consumable |
| special.cloth | Tuche | special | basic | specialBasicCraft | 1 | consumable |
| special.cutGems | Geschliffene Edelsteine/Kristall | special | expensive | specialExpensiveLuxury | 2 | luxury,magic,refined2 |
| special.dyes | Farbstoffe/Tinkturen/Lacke | special | basic | specialBasicOther | 1 | consumable,alchemy,medicine |
| special.expensiveFurniture | Teure Möbel | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.fineCloth | Teure Tuche | special | expensive | specialExpensiveCraft | 1 | luxury,consumable |
| special.fineWine | Edler Wein | special | basic | specialBasicOther | 1 | luxury,consumable |
| special.furniture | Möbel | special | basic | specialBasicCraft | 0 | consumable,building |
| special.glassware | Glaswaren | special | basic | specialBasicCraft | 2 | luxury,building |
| special.highMagicOres | Hochmagische Erze/Metalle | special | expensive | specialExpensiveOther | 4 | luxury,magic,refined2 |
| special.honeyMead | Honigmet | special | cheap | specialCheapFood | 0 | consumable,food |
| special.horses | Pferde/Monokeroi | special | expensive | specialExpensiveOther | 2 | animal,military,luxury |
| special.jewelry | Schmuck/Schmuckwerk | special | expensive | specialExpensiveLuxury | 4 | luxury,refined2 |
| special.magicParaphernalia | Magische Paraphernalia | special | expensive | specialExpensiveOther | 2 | magic,craft,luxury |
| special.magomechanicalParts | Magomechanische Teile | special | expensive | specialExpensiveCraft | 3 | craft,magic,luxury,refined2 |
| special.mechanicalParts | Mechanische Teile | special | expensive | specialExpensiveCraft | 2 | craft,luxury,refined2 |
| special.minorMagicArtifacts | Mindere magische Artefakte | special | expensive | specialExpensiveOther | 5 | magic,luxury,refined2 |
| special.minorMagicMetals | Mindere magische Metalle/Legierungen | special | expensive | specialExpensiveOther | 3 | magic,metal,luxury,refined2 |
| special.optrolithCut | Geschliffener Optrolith | special | basic | specialBasicBuilding | 2 | luxury,building,magic |
| special.paper | Papier | special | cheap | specialCheapOther | 0 | consumable |
| special.perfume | Parfüms | special | expensive | specialExpensiveLuxury | 3 | luxury,consumable,refined2 |
| special.potions | Alchemische Tränke/Elixiere | special | expensive | specialExpensiveOther | 3 | alchemy,medicine,luxury,refined2 |
| special.pulpellen | Pulpellen | special | cheap | specialCheapFood | -1 | food,consumable,military |
| special.sacredOils | Heilige Öle/Weihrauch | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.simpleTools | Einfache Werkzeuge | special | cheap | specialCheapCraft | 0 | craft,building,military |
| special.smallChimeras | Kleinchimären | special | expensive | specialExpensiveOther | 3 | magic,animal,luxury,refined2 |
| special.soap | Seife | special | cheap | specialCheapConsumable | -1 | consumable |
| special.specialTools | Spezialwerkzeuge (Sonderwerkzeug) | special | expensive | specialExpensiveCraft | 1 | craft,military |
| special.spices | Gewürze | special | expensive | specialExpensiveLuxury | 1 | luxury,consumable |
| special.statuesMosaics | Statuen/Kunstmosaike | special | basic | specialBasicBuilding | 2 | luxury,building |
| special.undeadCombat | Untote Kämpfer | special | expensive | specialExpensiveOther | 3 | magic,undead,military,refined2 |
| special.undeadLabor | Untote Arbeitskräfte | special | expensive | specialExpensiveOther | 2 | magic,undead,refined2 |
| special.warChimeras | Kampfchimären/Konstrukte/Golems | special | expensive | specialExpensiveOther | 4 | magic,military,luxury,refined2 |
| special.warhorses | Schlachtrösser | special | expensive | specialExpensiveOther | 3 | animal,military,refined2 |
| special.weaponsShields | Waffen & Schilde | special | basic | specialBasicCraft | 1 | military,weapon |
| special.workChimeras | Arbeits‑Chimären/Golems | special | expensive | specialExpensiveOther | 4 | magic,luxury,refined2 |

