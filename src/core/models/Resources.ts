// Raw materials model based on SOURCE.md
export interface RawMaterials {
  // Basic materials (poor quality / billiges)
  wood: number; // Holz
  bricks: number; // Ziegel
  wool: number; // Wolle
  fruit: number; // Obst
  grain: number; // Getreide
  vegetables: number; // Gemüse
  milk: number; // Milch
  fish: number; // Fisch
  olives: number; // Oliven

  // Medium materials (simple / einfaches)
  stone: number; // Baugestein
  honey: number; // Honig
  iron: number; // Eisen
  tin: number; // Zinn
  pigs: number; // Schweine
  sheep: number; // Schafe
  meat: number; // Fleisch
  salt: number; // Salz

  // Expensive materials (teures)
  granite: number; // Granit
  marble: number; // Marmor
  optrolith: number; // Optrolith
  beasts: number; // Lasttiere
  cattle: number; // Rinder
  fur: number; // Pelze
  magicOre: number; // Magische Erze
  gems: number; // Edelsteine
  horses: number; // Pferde
  exoticBeasts: number; // Exotische Biester
  preciousMetals: number; // Edelmetalle
}

// Special materials model based on SOURCE.md
export interface SpecialMaterials {
  // Basic special materials (billige)
  tools: number; // Werkzeug
  pulps: number; // Pulpellen
  soap: number; // Seife
  cloth: number; // Tuche

  // Medium special materials (einfaches)
  furniture: number; // Möbel
  oil: number; // Öl
  specialTools: number; // Sonderwerkzeug
  weapons: number; // Waffen
  paper: number; // Papier
  brandy: number; // Brandt
  polishedOptrolith: number; // Optrolith
  wine: number; // Wein
  glass: number; // Glaswaren
  armor: number; // Rüstungen
  statues: number; // Statuen

  // Expensive special materials (teures)
  books: number; // Bücher
  perfume: number; // Parfüms
  luxuryCloth: number; // Teure Tuche
  cutGems: number; // Geschliffene Edelsteine
  mechanicalParts: number; // Mechanische Teile
  magicParts: number; // Magomechanische Teile
  miniChimeras: number; // Kleinchimären
  magicMetals: number; // Magische Metalle
  highMagicOre: number; // Hochmagische Erze
  battleChimeras: number; // Kampfchimären
}

// Initialize all raw materials with zero values
export function createEmptyRawMaterials(): RawMaterials {
  return {
    // Basic materials
    wood: 0,
    bricks: 0,
    wool: 0,
    fruit: 0,
    grain: 0,
    vegetables: 0,
    milk: 0,
    fish: 0,
    olives: 0,

    // Medium materials
    stone: 0,
    honey: 0,
    iron: 0,
    tin: 0,
    pigs: 0,
    sheep: 0,
    meat: 0,
    salt: 0,

    // Expensive materials
    granite: 0,
    marble: 0,
    optrolith: 0,
    beasts: 0,
    cattle: 0,
    fur: 0,
    magicOre: 0,
    gems: 0,
    horses: 0,
    exoticBeasts: 0,
    preciousMetals: 0,
  };
}

// Initialize all special materials with zero values
export function createEmptySpecialMaterials(): SpecialMaterials {
  return {
    // Basic special materials
    tools: 0,
    pulps: 0,
    soap: 0,
    cloth: 0,

    // Medium special materials
    furniture: 0,
    oil: 0,
    specialTools: 0,
    weapons: 0,
    paper: 0,
    brandy: 0,
    polishedOptrolith: 0,
    wine: 0,
    glass: 0,
    armor: 0,
    statues: 0,

    // Expensive special materials
    books: 0,
    perfume: 0,
    luxuryCloth: 0,
    cutGems: 0,
    mechanicalParts: 0,
    magicParts: 0,
    miniChimeras: 0,
    magicMetals: 0,
    highMagicOre: 0,
    battleChimeras: 0,
  };
}

// Player resources model
export interface PlayerResources {
  gold: number;
  laborPower: number;
  baseLaborPower: number;
  temporaryInfluence: number;
  permanentInfluence: number;
  combatPower: number;
  rawMaterials: Partial<RawMaterials>;
  specialMaterials: Partial<SpecialMaterials>;
}

// Initialize player resources with starting values
export function createInitialPlayerResources(): PlayerResources {
  return {
    gold: 4, // Start with 4 gold
    laborPower: 4, // Start with 4 (2 from domain + 2 from subjects)
    baseLaborPower: 4,
    temporaryInfluence: 0,
    permanentInfluence: 0,
    combatPower: 0,
    rawMaterials: {
      grain: 4, // Start with some basic food
    },
    specialMaterials: {
      tools: 1, // Start with basic tools
    },
  };
}

// Market price category
export enum MarketPriceCategory {
  NOT_IN_DEMAND = 'notInDemand',
  IN_DEMAND = 'inDemand',
  HIGH_DEMAND = 'highDemand',
  COVETED = 'coveted',
}

// Material category for market fluctuations
export enum MaterialCategory {
  CHEAP_RAW = 'cheapRaw',
  SIMPLE_RAW = 'simpleRaw',
  EXPENSIVE_RAW = 'expensiveRaw',
  CHEAP_SPECIAL = 'cheapSpecial',
  SIMPLE_SPECIAL = 'simpleSpecial',
  EXPENSIVE_SPECIAL = 'expensiveSpecial',
}

// Market prices interface
export interface MarketPrices {
  rawMaterials: Record<
    keyof RawMaterials,
    {
      basePrice: number;
      category: MaterialCategory;
      currentDemand: MarketPriceCategory;
      priceModifier: number;
    }
  >;

  specialMaterials: Record<
    keyof SpecialMaterials,
    {
      basePrice: number;
      category: MaterialCategory;
      currentDemand: MarketPriceCategory;
      priceModifier: number;
    }
  >;
}
