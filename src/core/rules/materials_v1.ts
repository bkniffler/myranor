import type {
  MaterialKind,
  MaterialTier,
  RawMarketGroup,
  SpecialMarketGroup,
} from '../domain/types';

export type MaterialTag =
  | 'food'
  | 'building'
  | 'consumable'
  | 'craft'
  | 'luxury'
  | 'weapon'
  | 'armor'
  | 'metal'
  | 'animal'
  | 'magic'
  | 'medicine'
  | 'alchemy';

export type MaterialDefinition = {
  id: string;
  label: string;
  kind: MaterialKind;
  tier: MaterialTier;
  marketGroup: RawMarketGroup | SpecialMarketGroup;
  saleBonusGold: number;
  tags: MaterialTag[];
};

function m(def: MaterialDefinition): MaterialDefinition {
  return def;
}

// Material catalog extracted from the "Marktsystem" section in Aufbausystem.md.
// IDs are stable internal keys; labels are German for UI/logging.
export const MATERIALS_V1: Readonly<Record<string, MaterialDefinition>> = {
  // Rohmaterial (billig)
  'raw.wood': m({
    id: 'raw.wood',
    label: 'Holz/Bauholz',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapBuilding',
    saleBonusGold: 1,
    tags: ['building'],
  }),
  'raw.bricks': m({
    id: 'raw.bricks',
    label: 'Tonware/Ziegel',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapBuilding',
    saleBonusGold: 1,
    tags: ['building'],
  }),
  'raw.wool': m({
    id: 'raw.wool',
    label: 'Wolle',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapConsumable',
    saleBonusGold: 0,
    tags: ['consumable'],
  }),
  'raw.fruit': m({
    id: 'raw.fruit',
    label: 'Obst',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapFood',
    saleBonusGold: 0,
    tags: ['food'],
  }),
  'raw.grainVeg': m({
    id: 'raw.grainVeg',
    label: 'Getreide & Gemüse',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapFood',
    saleBonusGold: 0,
    tags: ['food'],
  }),
  'raw.dairy': m({
    id: 'raw.dairy',
    label: 'Milch/Käse',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapFood',
    saleBonusGold: 1,
    tags: ['food'],
  }),
  'raw.fish': m({
    id: 'raw.fish',
    label: 'Fisch/Pökelfisch',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapFood',
    saleBonusGold: 1,
    tags: ['food'],
  }),
  'raw.olives': m({
    id: 'raw.olives',
    label: 'Oliven',
    kind: 'raw',
    tier: 'cheap',
    marketGroup: 'rawCheapFood',
    saleBonusGold: 0,
    tags: ['food'],
  }),

  // Rohmaterial (einfach)
  'raw.stone': m({
    id: 'raw.stone',
    label: 'Baugestein',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicBuilding',
    saleBonusGold: 0,
    tags: ['building'],
  }),
  'raw.honey': m({
    id: 'raw.honey',
    label: 'Honig',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicFood',
    saleBonusGold: 0,
    tags: ['food'],
  }),
  'raw.ironSteel': m({
    id: 'raw.ironSteel',
    label: 'Eisen/Stahl',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicConsumable',
    saleBonusGold: 1,
    tags: ['metal', 'consumable'],
  }),
  'raw.leadTin': m({
    id: 'raw.leadTin',
    label: 'Blei/Zinn (verhüttet)',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicConsumable',
    saleBonusGold: 1,
    tags: ['metal', 'consumable'],
  }),
  'raw.pigsSheep': m({
    id: 'raw.pigsSheep',
    label: 'Schweine/Schafe',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicFood',
    saleBonusGold: 1,
    tags: ['food', 'animal'],
  }),
  'raw.meat': m({
    id: 'raw.meat',
    label: 'Fleisch/Pökelfleisch',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicFood',
    saleBonusGold: 1,
    tags: ['food'],
  }),
  'raw.salt': m({
    id: 'raw.salt',
    label: 'Salz',
    kind: 'raw',
    tier: 'basic',
    marketGroup: 'rawBasicConsumable',
    saleBonusGold: 1,
    tags: ['consumable'],
  }),

  // Rohmaterial (teuer)
  'raw.marbleGranite': m({
    id: 'raw.marbleGranite',
    label: 'Granit/Marmor',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveBuilding',
    saleBonusGold: 0,
    tags: ['building'],
  }),
  'raw.optrolith': m({
    id: 'raw.optrolith',
    label: 'Optrolith',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveBuilding',
    saleBonusGold: 2,
    tags: ['building', 'magic'],
  }),
  'raw.packAnimals': m({
    id: 'raw.packAnimals',
    label: 'Lasttiere',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 2,
    tags: ['animal'],
  }),
  'raw.cattle': m({
    id: 'raw.cattle',
    label: 'Rinder',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 2,
    tags: ['animal', 'food'],
  }),
  'raw.furs': m({
    id: 'raw.furs',
    label: 'Pelze',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 2,
    tags: ['luxury', 'consumable'],
  }),
  'raw.lesserMagicOres': m({
    id: 'raw.lesserMagicOres',
    label: 'Mindere magische Erze',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 2,
    tags: ['magic'],
  }),
  'raw.unpolishedGems': m({
    id: 'raw.unpolishedGems',
    label: 'Ungeschliffene Kristalle/Edelsteine',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 2,
    tags: ['magic', 'luxury'],
  }),
  'raw.horses': m({
    id: 'raw.horses',
    label: 'Pferde/Monokeroi',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 3,
    tags: ['animal', 'luxury'],
  }),
  'raw.exoticBeasts': m({
    id: 'raw.exoticBeasts',
    label: 'Exotische Biester',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 3,
    tags: ['animal', 'luxury'],
  }),
  'raw.preciousMetals': m({
    id: 'raw.preciousMetals',
    label: 'Edelmetalle',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 3,
    tags: ['metal', 'luxury'],
  }),
  'raw.herbsFlowers': m({
    id: 'raw.herbsFlowers',
    label: 'Kräuter/Blumen',
    kind: 'raw',
    tier: 'expensive',
    marketGroup: 'rawExpensiveOther',
    saleBonusGold: 0,
    tags: ['medicine'],
  }),

  // Sondermaterial (billig)
  'special.tools': m({
    id: 'special.tools',
    label: 'Werkzeug',
    kind: 'special',
    tier: 'cheap',
    marketGroup: 'specialCheapCraft',
    saleBonusGold: 0,
    tags: ['craft'],
  }),
  'special.pulpellen': m({
    id: 'special.pulpellen',
    label: 'Pulpellen',
    kind: 'special',
    tier: 'cheap',
    marketGroup: 'specialCheapFood',
    saleBonusGold: 0,
    tags: ['food'],
  }),
  'special.soap': m({
    id: 'special.soap',
    label: 'Seife',
    kind: 'special',
    tier: 'cheap',
    marketGroup: 'specialCheapConsumable',
    saleBonusGold: 0,
    tags: ['consumable'],
  }),
  'special.cloth': m({
    id: 'special.cloth',
    label: 'Tuche',
    kind: 'special',
    tier: 'cheap',
    marketGroup: 'specialCheapCraft',
    saleBonusGold: 1,
    tags: ['craft', 'consumable'],
  }),

  // Sondermaterial (einfach)
  'special.furniture': m({
    id: 'special.furniture',
    label: 'Möbel',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 0,
    tags: ['craft', 'luxury'],
  }),
  'special.oil': m({
    id: 'special.oil',
    label: 'Öl',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialCheapFood',
    saleBonusGold: 0,
    tags: ['food', 'consumable'],
  }),
  'special.specialTools': m({
    id: 'special.specialTools',
    label: 'Sonderwerkzeug',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 0,
    tags: ['craft'],
  }),
  'special.weapons': m({
    id: 'special.weapons',
    label: 'Waffen',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 0,
    tags: ['weapon'],
  }),
  'special.paper': m({
    id: 'special.paper',
    label: 'Papier',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 0,
    tags: ['craft'],
  }),
  'special.brandy': m({
    id: 'special.brandy',
    label: 'Brandt',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialCheapFood',
    saleBonusGold: 1,
    tags: ['food'],
  }),
  'special.optrolithCut': m({
    id: 'special.optrolithCut',
    label: 'Geschliffener Optrolith',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicBuilding',
    saleBonusGold: 1,
    tags: ['building', 'magic', 'luxury'],
  }),
  'special.wine': m({
    id: 'special.wine',
    label: 'Wein',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialCheapFood',
    saleBonusGold: 1,
    tags: ['food'],
  }),
  'special.glassware': m({
    id: 'special.glassware',
    label: 'Glaswaren',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 2,
    tags: ['craft', 'luxury'],
  }),
  'special.armor': m({
    id: 'special.armor',
    label: 'Rüstungen',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicCraft',
    saleBonusGold: 2,
    tags: ['armor'],
  }),
  'special.statues': m({
    id: 'special.statues',
    label: 'Statuen',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialExpensiveLuxury',
    saleBonusGold: 3,
    tags: ['luxury'],
  }),
  'special.medicine': m({
    id: 'special.medicine',
    label: 'Medizinische Güter',
    kind: 'special',
    tier: 'basic',
    marketGroup: 'specialBasicOther',
    saleBonusGold: 0,
    tags: ['medicine'],
  }),

  // Sondermaterial (teuer)
  'special.books': m({
    id: 'special.books',
    label: 'Bücher',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveLuxury',
    saleBonusGold: 0,
    tags: ['luxury'],
  }),
  'special.perfume': m({
    id: 'special.perfume',
    label: 'Parfüms',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveLuxury',
    saleBonusGold: 1,
    tags: ['luxury'],
  }),
  'special.fineCloth': m({
    id: 'special.fineCloth',
    label: 'Teure Tuche',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveCraft',
    saleBonusGold: 1,
    tags: ['craft', 'luxury'],
  }),
  'special.cutGems': m({
    id: 'special.cutGems',
    label: 'Geschliffene Edelsteine/Kristall',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveLuxury',
    saleBonusGold: 1,
    tags: ['luxury', 'magic'],
  }),
  'special.mechanicalParts': m({
    id: 'special.mechanicalParts',
    label: 'Mechanische Teile',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveCraft',
    saleBonusGold: 1,
    tags: ['craft'],
  }),
  'special.magomechanicalParts': m({
    id: 'special.magomechanicalParts',
    label: 'Magomechanische Teile',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveCraft',
    saleBonusGold: 2,
    tags: ['craft', 'magic'],
  }),
  'special.smallChimeras': m({
    id: 'special.smallChimeras',
    label: 'Kleinchimären',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveOther',
    saleBonusGold: 3,
    tags: ['magic', 'animal'],
  }),
  'special.magicMetals': m({
    id: 'special.magicMetals',
    label: 'Magische Metalle/Legierungen',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveOther',
    saleBonusGold: 3,
    tags: ['magic', 'metal'],
  }),
  'special.highMagicOres': m({
    id: 'special.highMagicOres',
    label: 'Hochmagische Erze',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveOther',
    saleBonusGold: 4,
    tags: ['magic'],
  }),
  'special.warChimeras': m({
    id: 'special.warChimeras',
    label: 'Kampfchimären/Konstrukte/Golems',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveOther',
    saleBonusGold: 4,
    tags: ['magic'],
  }),
  'special.potions': m({
    id: 'special.potions',
    label: 'Tränke (alchemisch)',
    kind: 'special',
    tier: 'expensive',
    marketGroup: 'specialExpensiveOther',
    saleBonusGold: 0,
    tags: ['alchemy', 'medicine'],
  }),
} as const;

export function getMaterialOrThrow(materialId: string): MaterialDefinition {
  const m = MATERIALS_V1[materialId];
  if (!m) throw new Error(`Unknown materialId: ${materialId}`);
  return m;
}

export function materialHasTag(materialId: string, tag: MaterialTag): boolean {
  return getMaterialOrThrow(materialId).tags.includes(tag);
}
