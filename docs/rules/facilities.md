# Facilities Catalog (Draft, Phase 1 = Economy/Rules)

Status: draft derived from `Aufbausystem.md`. This document is the source of truth for *facility effects* we plan to model in the engine. It intentionally focuses on **economic + action mechanics** (income, upkeep, DCs, caps, storage, conversion, bonus actions). Narrative/RPG-only effects are listed as Phase 3.

## Scope
- **Phase 1 (implement first):** economic effects, action DC/caps, bonus actions, market modifiers, storage, workshop conversion/refinement, facility slots, recruiting discounts.
- **Phase 2:** facility damage/repair + event interactions ("damage a facility" etc.).
- **Phase 3:** narrative bonuses (skill advantage, spellcasting, rest bonuses, story perks).

## Conventions
- All numbers are **per round** unless stated.
- "Stacks" means multiple copies can be built and their effects add up (within caps).
- Proposed facility keys: `facility.<location>.<group>.<name>[.<tier>]`.
- Effects use the following fields:
  - `incomeDelta` (gold/influence/labor/raw/special/magicPower)
  - `upkeepDelta` (gold/influence/labor/raw/special/magicPower)
  - `actionDcModifier` (actionKey + delta + size?)
  - `actionCapModifier` (actionKey + delta)
  - `marketModifier` (buy/sell + marketGroup + delta)
  - `storageCapacityDelta` (raw/special)
  - `workshopRefineStepsDelta` (upgrade category +1 per step)
  - `workshopOversightYieldOverride` (change SM per investment)
  - `bonusActions` (money/materials/influence/facility)
  - `costModifier` (percent or flat deltas on specific build actions)

## Global facility caps
- Domain general facility slots: small=2, medium=4, large=6.
- City property facility slots: small=2, medium=3, large=4.
- Workshops/Lagers count as facilities (per domain/city production caps).
- See `docs/rules/rules-implemented.md` for domain/city production caps.

---

## Core production facilities (already in engine)
### Workshop
- Key: `facility.workshop.<tier>` (implemented via BuildWorkshop)
- Location: domain or city (production mode)
- Effect: converts 8 RM -> 2 SM per round (small), 12->3 (medium), 16->4 (large)
- Upkeep: 1/2/4 labor per tier
- Notes: outputMaterialId fixed at build

### Storage
- Key: `facility.storage.<tier>` (implemented via BuildStorage)
- Effect: adds storage capacity for RM/SM
- Upkeep: 1/2/4 labor per tier

### Refinement
- Key: `facility.special.<tier>.refine` (implemented)
- Effect: +1 category upgrade step for workshop output at same location

---

## Domain facilities (general, all domains)
### facility.domain.general.defense
- Effect: defenseBonus +1 (medium upgrade doubles effect)
- Phase 2: used vs raids/attack events

### facility.domain.general.land-reclaim
- Effect: +6 RM (main domain pick) per round
- Stack cap: small=1, medium=2, large=3

### facility.domain.general.granary
- Effect: storageCapacityDelta raw +10 (food-tagged RM)
- Medium+ upgrade doubles capacity

### facility.domain.general.worker-housing
- Effect: +1 permanent labor
- Stack cap: small=2, medium=3, large=5

### facility.domain.general.tenants
- Effect: +1 tenant level (250 tenants)
- Stack cap: small=2, medium=4, large=6

### facility.domain.general.oktral-shrine (medium+)
- Effect: +4 influence/round; +1 tenant cap

### facility.domain.general.market-post
- Effect: +2 gold/round; +1 expensive SM/round
- Upkeep: 1 labor

### facility.domain.general.sales-contracts
- Effect: auto-convert +3 RM -> +1 gold per round

### facility.domain.general.experimental-cammers
- Effect: choose one:
  - +4 magicPower/round, or
  - +1 expensive SM/round
- Optional: double for 5 rounds by sacrificing 1 permanent labor (needs explicit rule)

### facility.domain.general.luxury-villa
- Effect: permanent influence gain (medium: +1 every 2 rounds; large: +1/round)
- Notes: also impacts loyalty (Phase 3)

### facility.domain.general.kastron (large only)
- Effect: +1 permanent influence/round; defenseBonus +4
- Phase 2: grants extra defense reaction; +5 mercenary cap

---

## Domain specialization (base effect + optional facilities)
### Agriculture (specialization)
- Base effect: +8 RM (cheap food) +4 RM (simple food) per round
- Upkeep: 2 labor
- Facilities:
  - `facility.domain.agri.mills`: +2 cheap SM (pulpellen/oil) for 2 RM upkeep
  - `facility.domain.agri.terraces`: +2 RM main crop
  - `facility.domain.agri.herb-garden`: +1 expensive RM (herbs/flowers)
  - `facility.domain.agri.magic-greenhouse`: +1 expensive RM or +1 expensive SM (every 2 rounds)

### Animal husbandry (specialization)
- Base effect: chosen animal package (see Aufbausystem.md)
- Upkeep: 1 labor
- Facilities:
  - `facility.domain.husbandry.slaughterhouse`: +4 RM meat for 1 simple RM upkeep
  - `facility.domain.husbandry.dairy-tannery`: +4 cheap SM (cheese) or +2 cheap SM (leather)
  - `facility.domain.husbandry.elite-breeding`: +1 expensive RM or +1 permanent labor
  - `facility.domain.husbandry.war-mounts`: upgrade horses -> expensive SM

### Forestry (specialization)
- Base effect: +8 RM wood +2 SM (game)
- Facilities:
  - `facility.domain.forestry.sawmill`: +4 RM lumber for 4 RM wood upkeep
  - `facility.domain.forestry.hunting`: +2 SM game or +1 expensive RM (pelts)
  - `facility.domain.forestry.apiary`: +1 cheap SM honey
  - `facility.domain.forestry.ranger-huts`: +1 expensive RM herbs +1 simple SM game
  - `facility.domain.forestry.hardwood`: upgrade wood -> expensive RM or simple SM furniture

### Mining/Quarry (specialization)
- Base effect: choose quarry/ore/gems (see Aufbausystem.md)
- Upkeep: quarry=3 labor, ore/gem=6 labor
- Facilities:
  - `facility.domain.mining.smelter`: +2 RM refined metal for 2 RM ore upkeep
  - `facility.domain.mining.gravel-pit`: +2 RM stone/round
  - `facility.domain.mining.deep-shaft`: +4 RM main ore or +1 expensive RM (metals/crystals)
  - `facility.domain.mining.supports`: reduce labor upkeep by 2

---

## City property facilities (general)
### facility.city.general.guards
- Effect: defenseBonus +2 (city)
- Upkeep: 1 labor, 1 gold

### facility.city.general.soup-kitchens
- Effect: +1 influence/round per city tier
- Upkeep: 1 RM food

### facility.city.general.gang-alliance
- Effect: defenseBonus +1
- Upkeep: 1 gold; if underworld or cult tier>=2 then +1 gold instead of upkeep

### facility.city.general.workers-circle
- Effect: +1 labor/round per city tier
- Upkeep: 1 influence

### facility.city.general.market-stalls
- Effect: actionDcModifier money.sell small -1; counts as medium storage

### facility.city.general.oktral-shrine (medium+)
- Effect: +4 influence/round

### facility.city.general.insulae (medium+)
- Effect: +1 tenant level (250 tenants), stack caps per city tier

### facility.city.general.manufactory (medium+)
- Prereq: medium workshop + craft specialist
- Effect: workshop upkeep -1 labor per tier; actionCapModifier materials.workshop +1

### facility.city.general.luxury-atrium (medium+)
- Effect: permanent influence gain (medium: +1 every 2 rounds; large: +1/round)
- Notes: loyalty/host perks (Phase 3)

### facility.city.general.magomanufactory (large)
- Prereq: large workshop + manufactory + mage specialist
- Upkeep: +2 magicPower
- Effect: +2 special (magomechanic) per round; workshopOversightYieldOverride for large workshop (4:1)
- Bonus: bonusActions materials.workshop +1 when large workshop + manufactory

---

## City specializations (base effect + sample facilities)
### Food production (city specialization)
- Base effect: choose focus (bakery / brewery / butcher)
- Facilities:
  - `facility.city.food.inn`: +1 gold/round

### Craft goods (city specialization)
- Base effect: +2 cheap/simple SM per round (choose type)

### Luxury production (city specialization)
- Base effect: +1 expensive/luxury SM per round (requires specialist)

### Metal processing (city specialization)
- Base effect: +1 simple/expensive SM per round; extra upkeep +4 wood

---

## Office facilities (general)
### facility.office.general.favors
- Effect: costModifier influence/money for political steps and influence gain (-1 each)
- Upkeep: 1 influence

### facility.office.general.clerks
- Effect: costModifier for other facilities (-2 gold, -2 influence)
- Upkeep: 1 gold, 1 influence

### facility.office.general.couriers
- Effect: actionDcModifier political +1; defense bonus vs attacks on office
- Upkeep: 1 labor, 1 gold

### facility.office.general.subalterns
- Effect: +1 permanent labor; specialist recruitment +1
- Upkeep: 2 gold, 2 influence

### facility.office.general.representation (medium+)
- Effect: +1 influence/round; actionDcModifier influence -1
- Upkeep: 2 gold

### facility.office.general.special-archive (medium+)
- Effect: actionDcModifier political info steps -1
- Upkeep: 1 gold

### facility.office.general.cash-grab (medium+)
- Effect: bonusActions money +1 (max 2 investments)
- Drawback: +4 DC to political + influence gain next round

### facility.office.general.legal-advisor (medium+)
- Effect: bonus reaction on legal political steps (Phase 2)
- Upkeep: 4 gold

### facility.office.general.admin-reform (medium+)
- Effect: allow 50/50 gold+influence yield for offices
- Upkeep: 2 gold

### facility.office.general.office-sale (medium+)
- Effect: +3 influence or gold/round
- Drawback: facility build costs +5 gold or +5 influence

---

## Office specialization (base effects + sample facilities)
### Kirchenaufsicht
- Base: +1 influence/round; influence DC small/medium -1
- Focus examples:
  - `church.guard-courts`: +2 influence/round; +1 influence per underworld/craft/collegium tier
  - `church.wealth`: +1 gold/round per 250 tenants
  - `church.charity`: +1 influence/round; +1 permanent labor per 500 tenants
- Facilities examples:
  - `church.cult-watch`: +2 influence/round; political damage DC -1; +1 influence per cult tier
  - `church.credits`: money.lend DC -1 (medium); temp influence DC -1 (small)
  - `church.monastery`: +1 permanent labor (cap per office tier)

### Staedtische Verwaltung
- Base: +1 influence or gold/round per 500 tenants; political DC small -1
- Focus examples:
  - `city.build`: +2 RM (wood/brick); costModifier city build -10%
  - `city.magnate`: +1 influence/round; influence DC medium -1; +1 influence per underworld tier
  - `city.trade`: +1 gold/round per trade tier; money DC medium -1
  - `city.craft`: +1 cheap/simple SM/round; workshop upkeep -1 gold (city)
  - `city.taxes`: +2 gold/round
- Facilities examples:
  - `city.labor-service`: +1 permanent labor (cap per office tier); +1 influence per craft circle tier
  - `city.permits`: +2 gold/round; temp influence DC small -1
  - `city.toll`: marketModifier +1/-1 (local); +1 gold or +1 influence/round (opposite of upkeep)
  - `city.cadaster`: costModifier city build -2 gold

### Hof- und Ehraemter
- Base: influence/post gain DC medium+large -1
- Focus examples:
  - `court.household`: +2 influence or gold/round; political DC medium/large -1
  - `court.ceremony`: +2 influence/round per bastion tier (Phase 3)
  - `court.magic`: +1 magicPower/round; ritual DC -1
- Facilities examples:
  - `court.privileges`: +2 gold or +2 influence/round (opposite of upkeep)
  - `court.titles`: reduce office acquisition costs
  - `court.renovation`: +2 influence/round; influence DC large -1
  - `court.exclusive-circle`: +1 magicPower or +2 influence/round; bonusActions political every 2 rounds

### Provinzverwaltung
- Base: +1 labor/round; domain admin DC -1
- Focus examples:
  - `province.domain-admin`: +4 RM (cheap/simple)
  - `province.taxes`: +1 gold/round per 500 tenants
  - `province.logistics`: +1 gold/round; unlock toll+warehouse facility
- Facilities examples:
  - `province.defer-taxes`: +2 influence/round
  - `province.prospector`: +1 RM (simple/expensive) on mining domains
  - `province.relocation`: +1 tenant level per office tier
  - `province.work-services`: +2 RM (cheap/simple); domain admin DC -1
  - `province.surveys`: -10 gold on small domain acquisition
  - `province.tax-privileges`: reduce domain upkeep by 1 gold
  - `province.state-warehouses`: medium storage (per office tier)
  - `province.state-workshops`: small workshop (per office tier)

### Offiziersposten
- Base: +1 combat power/round; DC for military actions -2
- Focus examples:
  - `officer.guards`: +1 gold +1 combat power per 500 tenants; domain security bonus
  - `officer.admin`: +1 gold/round
  - `officer.horas`: +1 influence +1 combat power

---

## Trade enterprise facilities (from Aufbausystem.md)
- General cap: 2 general facilities per trade tier
- Only 1 trade enterprise per market instance

### facility.trade.general.bulk-contracts
- Cost: 8 gold, 2 influence
- Upkeep: 1 labor
- Effect: actionDcModifier money.sell (small) -1; better market access (note)

### facility.trade.general.storage-rent
- Cost: 10 gold, 1 labor (once)
- Upkeep: 1 labor
- Effect: storageCapacityDelta raw +10 or special +5 per trade tier

### facility.trade.general.scribery
- Cost: 12 gold, 1 labor
- Upkeep: 1 gold
- Effect: actionDcModifier money.sell -1; costModifier trade upgrades -2 gold

### facility.trade.general.missions-power
- Cost: 15 gold, 4 influence
- Upkeep: 2 gold
- Effect: +2 influence per trade tier per round

### facility.trade.general.honoratic-agents (medium+)
- Cost: 15 gold, 4 influence
- Upkeep: 2 gold
- Effect: +2 influence per trade tier; +1 on political steps (Phase 3)

### facility.trade.general.constant-missions (medium+)
- Cost: 16 gold, 4 influence
- Upkeep: 2 gold, 1 RM
- Effect: +2 gold +2 influence per round

### facility.trade.general.investment-pool (medium+)
- Cost: 20 gold, 10 influence
- Upkeep: +2 gold, +2 influence
- Effect: actionCapModifier money.lend +1 per trade tier

### facility.trade.general.regional-hub (medium+)
- Cost: 20 gold, 12 influence
- Upkeep: 3 gold, 1 special (expensive)
- Effect: +2 influence per round; +1 market instance (extra market access)

### facility.trade.general.local-monopoly (large)
- Cost: 40 gold, 30 influence
- Upkeep: 4 gold, 4 influence
- Effect: +1d8 gold per round (market system); bonusActions money.sell +1 every 2 rounds

### facility.trade.special.ship
- Cost: 20 gold, 20 RM wood, 6 SM (tools/cloth), specialist (captain)
- Upkeep: 3 labor, 2 gold
- Effect: +5 combat power at sea; either +4 SM every 2 rounds OR for each 4 invested SM -> 16 gold every 2 rounds
- Global: upkeep +1 per 2 ships

---

## Circel / Collegium facilities (from Aufbausystem.md)
Applies to: underworld, spy, cult, collegiumTrade, collegiumCraft

### Base circel effects (context, not facilities)
- Underworld: upkeep 1 labor + 1 gold per tier; yields scale by tier and city tier; actionDcModifier political -1 per tier; follower cap 2/4/6 per tier (cost 12 gold + 10 influence per follower level).
- Spy: upkeep 2 gold per tier; income +6 influence per tier; tier2 +1 permanent influence; tier3 +2 permanent influence + bonus political action every 2 rounds; actionDcModifier political -1 per tier.
- Cult: upkeep 1 gold per tier; income +5 influence +1 labor per tier; tier2 +2 permanent influence; tier3 +4 permanent influence + bonus influence action; actionDcModifier influence gain -1 per tier; follower cap 2/4/8 per tier (cost 8 gold + 8 influence per follower level).
- Collegium (craft/trade): upkeep 2 gold; income +3 labor per tier; tier3 bonus action money/material gain; actionDcModifier money gain (trade) or materials gain (craft) -2 per tier.
- HQ rule: each circel tier needs matching city property tier; adds +1 general city facility slot per circel tier.

### General circel facilities (all types)
#### facility.circel.general.hq
- Cost: 4 gold, 2 influence
- Upkeep: 1 gold
- Effect: +1 on reactions vs attacks

#### facility.circel.general.messenger
- Cost: 8 gold
- Upkeep: 1 labor, 1 gold
- Effect: +1 on political steps

#### facility.circel.general.veteran-protectors
- Cost: 8 gold, 2 influence
- Upkeep: 1 gold
- Effect: +2 covert combat power

#### facility.circel.general.shared-storage
- Cost: 8 gold, 4 influence
- Upkeep: 1 influence
- Effect: storageCapacityDelta raw +5 or special +3 per circel tier

#### facility.circel.general.apprenticeship
- Cost: 8 gold, 4 influence
- Upkeep: 1 gold
- Effect: +1 labor per circel tier

#### facility.circel.general.special-contributions
- Cost: 15 influence (one-time)
- Effect: bonusActions money +1 (max 2 investments)
- Drawback: +4 DC to political + influence gain next round

### Underworld circel facilities
#### facility.circel.underworld.enforcers
- Cost: 8 influence
- Upkeep: 2 influence
- Effect: +2 gold per city tier and 500 tenants per circel tier; actionDcModifier money.sell small -1; bypass tolls

#### facility.circel.underworld.warchest
- Cost: 10 gold, 4 influence
- Upkeep: 2 gold
- Effect: actionDcModifier political.manipulate -1; defense reaction +2 vs hostile influence

#### facility.circel.underworld.smuggling
- Cost: 12 gold, 6 influence
- Upkeep: 2 gold
- Effect: +1 expensive RM per round OR +1 expensive SM every 2 rounds

#### facility.circel.underworld.illegal-arsenal (tier2+)
- Cost: 16 gold, 5 influence
- Upkeep: 2 gold, 1 labor
- Effect: +2 combat power; +1 gold per round on relevant market rolls

#### facility.circel.underworld.enforcement-hire
- Cost: 16 gold, 8 influence
- Effect: unused combat power converts to gold at 1:2

#### facility.circel.underworld.secret-tunnels
- Cost: 15 gold, 1 labor
- Effect: bypass tolls; +2 gold per round

#### facility.circel.underworld.fence-ring
- Cost: 12 gold, 1 labor
- Effect: +1 small storage slot

#### facility.circel.underworld.gambling
- Cost: 18 gold, 2 labor
- Effect: +2 gold/round, +1 influence/round

#### facility.circel.underworld.bathhouse
- Cost: TODO (not specified in Aufbausystem.md)
- Effect: TODO (not specified)

#### facility.circel.underworld.shabby-workshops
- Cost: TODO (not specified)
- Effect: +1 small workshop slot

### Cult circel facilities
#### facility.circel.cult.fanatics
- Cost: 4 gold, 4 influence
- Upkeep: 1 influence
- Effect: +2 covert combat power

#### facility.circel.cult.initiation
- Cost: 6 gold, 6 influence
- Upkeep: 2 influence
- Effect: specialists start with +1 loyalty (stackable for +2)

#### facility.circel.cult.secret-shrine
- Cost: 8 gold, 4 influence
- Upkeep: 2 gold
- Effect: +2 influence per round; +2 defense vs city attacks

#### facility.circel.cult.relics
- Cost: 12 gold, 6 influence
- Effect: +1 permanent ship (schip?) +4 influence per round; +1 on religious checks

#### facility.circel.cult.mystics
- Cost: 12 gold, 12 influence
- Upkeep: 6 influence
- Effect: +2 on hiring clerics/mages; +1 loyalty for new specialists

#### facility.circel.cult.community-feasts (tier2+)
- Cost: 16 gold, 8 influence
- Upkeep: 4 RM food, 1 RM animals, 2 gold
- Effect: +3 influence per round; +1 permanent influence every 2 rounds

#### facility.circel.cult.primary-liturgy (large)
- Cost: 40 gold, 40 influence (requires divine quest)
- Upkeep: 2 gold, 4 influence
- Effect: auto-recruit 1 basic cleric specialist every 6 rounds; +3 loyalty

### Collegium facilities (craft/trade)
#### facility.circel.collegium.quality-standards
- Cost: 8 gold, 2 influence
- Upkeep: 1 gold
- Effect: +1 special material per round (better production efficiency)

#### facility.circel.collegium.internal-market
- Cost: 8 gold, 3 influence
- Upkeep: 1 gold
- Effect: +/-1 on market rolls (choose direction)

#### facility.circel.collegium.representation
- Cost: 12 gold, 2 RM (expensive)
- Upkeep: 2 gold
- Effect: +1 influence per round; influence gain DC small -1

#### facility.circel.collegium.processions (tier2+)
- Cost: 12 gold, 5 influence
- Upkeep: 2 gold, 1 labor
- Effect: +2 influence per round per collegium tier

#### facility.circel.collegium.recruitment
- Cost: 18 gold, 5 influence
- Upkeep: 3 gold
- Effect: -2 on specialist hiring roll; +1 basic specialist every 4 rounds; upgrade produced goods to simple/expensive

### Spy ring facilities
- No explicit facility list in Aufbausystem.md yet (TODO)

---

## Out of scope for Phase 1 (kept as notes)
- Private bastion facilities (rest bonuses, spellcasting, RPG perks)
- Skill advantage, spells, narrative perks, story-only effects
- Complex multi-step crafting systems not used by the economy engine
