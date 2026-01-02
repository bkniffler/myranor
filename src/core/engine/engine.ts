import type { GameCommand } from '../commands/types';
import {
  type PlayerId,
  asCampaignId,
  asPlayerId,
  asUserId,
} from '../domain/ids';
import type { Phase } from '../domain/phase';
import { resolveSuccessTier } from '../domain/success';
import type {
  CampaignRules,
  CampaignState,
  CityPropertyTier,
  DomainTier,
  FacilityInstance,
  MaterialKind,
  MaterialStock,
  PlayerChecks,
  PlayerHoldings,
  PlayerState,
  PostTier,
  SpecialistKind,
  SpecialistTier,
  SpecialistTrait,
  StorageTier,
  WorkshopTier,
} from '../domain/types';
import type { GameEvent } from '../events/types';
import {
  officeIncomeMods as computeOfficeIncomeMods,
  workshopUpkeepMods as computeWorkshopUpkeepMods,
  marketDeltaPerInvestment,
  moneyActionMods,
  rawAutoConvertDivisor,
  saleBonusGoldForAction,
  taxGoldPerRound,
} from '../rules/eventModifiers_v1';
import { isSectionStartRound, rollSectionEvents } from '../rules/events_v1';
import {
  facilityBuildCostV1,
  facilityBuildTimeV1,
  parseFacilityKey,
} from '../rules/facilities_v1';
import {
  isMarketSectionStartRound,
  rollMarketInstances,
} from '../rules/market_v1';
import { MATERIALS_V1, getMaterialOrThrow } from '../rules/materials_v1';
import { specialistTraitByRoll } from '../rules/specialists_v1';
import {
  DEFAULT_CAMPAIGN_RULES,
  DEFAULT_DOMAIN_RAW_PICKS_BY_TIER,
  DEFAULT_STARTER_DOMAIN_RAW_PICKS,
  RULES_VERSION,
  baseInfluencePerRound,
  baseLaborTotal,
  domainRawPerRound,
  officesIncomePerRound,
  startingMarketState,
  startingPlayerChecks,
  startingPlayerEconomy,
  startingPlayerHoldings,
  startingPlayerTurn,
  storageCapacity,
  storageUpkeep,
  workshopCapacity,
  workshopFacilitySlotsMax,
  workshopUpkeep,
} from '../rules/v1';
import { type DiceRoll, rollD20, rollDice } from '../util/dice';
import type { Rng } from '../util/rng';
import { GameRuleError } from './errors';

export type ActorContext =
  | { role: 'gm'; userId: string }
  | { role: 'player'; userId: string };

export type EngineContext = {
  actor: ActorContext;
  rng: Rng;
  // Optional: allow simulations to suppress noisy PublicLogEntry events.
  emitPublicLogs?: boolean;
};

function assertPhase(state: CampaignState, phase: Phase): void {
  if (state.phase !== phase) {
    throw new GameRuleError(
      'PHASE',
      `Aktion nur in Phase "${phase}" möglich (aktuell: "${state.phase}").`
    );
  }
}

function assertGm(state: CampaignState, actor: ActorContext): void {
  if (actor.role !== 'gm') throw new GameRuleError('AUTH', 'GM erforderlich.');
  if (asUserId(actor.userId) !== state.gmUserId) {
    throw new GameRuleError('AUTH', 'Nur der GM darf diese Aktion ausführen.');
  }
}

function getActingPlayerIdOrThrow(
  state: CampaignState,
  actor: ActorContext
): PlayerId {
  const userId = asUserId(actor.userId);
  const playerId = state.playerIdByUserId[userId];
  if (!playerId) {
    throw new GameRuleError('AUTH', 'Spieler ist nicht Teil dieser Kampagne.');
  }
  return playerId;
}

function nextPhase(phase: Phase): Phase {
  switch (phase) {
    case 'maintenance':
      return 'actions';
    case 'actions':
      return 'conversion';
    case 'conversion':
      return 'reset';
    case 'reset':
      return 'maintenance';
  }
}

function roundAfterPhaseAdvance(round: number, from: Phase, to: Phase): number {
  if (from === 'reset' && to === 'maintenance') return round + 1;
  return round;
}

function normalizeChecks(input: PlayerChecks): PlayerChecks {
  const checks: PlayerChecks = {
    influence: Math.trunc(input.influence),
    money: Math.trunc(input.money),
    materials: Math.trunc(input.materials),
  };
  for (const [key, value] of Object.entries(checks)) {
    if (!Number.isFinite(value) || value < -5 || value > 15) {
      throw new GameRuleError('INPUT', `Ungültiger Check-Bonus für ${key}.`);
    }
  }
  return checks;
}

function investmentDcModifier(investments: number): number {
  if (investments >= 8) return 8;
  if (investments >= 4) return 4;
  return 0;
}

function roundCheckBonus(round: number): number {
  // Soll: Attributsmodifikator steigt voraussichtlich alle 6 Runden um 1 (R1–6:+0, R7–12:+1, ...).
  return Math.floor((Math.max(1, round) - 1) / 6);
}

function effectiveCheck(base: number, round: number): number {
  return base + roundCheckBonus(round);
}

function kwDcModifier(kw: number): number {
  const v = Math.max(0, Math.trunc(kw));
  if (v >= 16) return 4;
  if (v >= 12) return 3;
  if (v >= 8) return 2;
  if (v >= 4) return 1;
  return 0;
}

function asDcModifier(as: number): number {
  const v = Math.max(-6, Math.min(6, Math.trunc(as)));
  if (v <= -4) return 2;
  if (v <= -2) return 1;
  if (v >= 4) return -2;
  if (v >= 2) return -1;
  return 0;
}

type DcModAcc = { pos: number; neg: number };

function dcModsInit(): DcModAcc {
  return { pos: 0, neg: 0 };
}

function dcModsAdd(acc: DcModAcc, delta: number): void {
  if (!delta) return;
  if (delta > 0) acc.pos += delta;
  else acc.neg += delta;
}

function dcFinalize(baseDc: number, acc: DcModAcc): number {
  // Soll: DC-Senkungen sind insgesamt auf -4 gedeckelt.
  const cappedNeg = Math.max(-4, acc.neg);
  return baseDc + acc.pos + cappedNeg;
}

function isReligiousHoldings(holdings: PlayerHoldings): boolean {
  return (
    holdings.organizations.some((o) => o.kind === 'cult') ||
    holdings.offices.some((o) => o.specialization?.kind === 'churchOversight')
  );
}

function isSpecialistActive(s: PlayerHoldings['specialists'][number]): boolean {
  return Math.trunc(s.loyalty) > 0;
}

function traitPosMult(t: SpecialistTrait): number {
  const v = t.positiveMultiplier ?? 1;
  return Math.max(1, Math.trunc(v));
}

function traitNegMult(t: SpecialistTrait): number {
  const v = t.negativeMultiplier ?? 1;
  return Math.max(1, Math.trunc(v));
}

function applySpecialistTraitDcMods(
  acc: DcModAcc,
  trait: SpecialistTrait,
  opts: { influenceGain?: boolean }
): void {
  const posMult = traitPosMult(trait);
  const negMult = traitNegMult(trait);

  const addPos = (delta: number) => dcModsAdd(acc, delta * posMult);
  const addNeg = (delta: number) => {
    if (trait.positiveOnly) return;
    dcModsAdd(acc, delta * negMult);
  };

  switch (trait.id) {
    case 1: // Ambitioniert
      addPos(-2);
      break;
    case 2: // Akribisch
      addPos(-1);
      break;
    case 5: // Kreativ
      addPos(-1);
      break;
    case 8: // Gelehrt (negativ: +1 DC)
      addNeg(1);
      break;
    case 9: // Energisch (negativ: +1 DC)
      addNeg(1);
      break;
    case 11: // Traditionell
      addPos(-1);
      break;
    default:
      break;
  }

  if (opts.influenceGain) {
    if (trait.id === 4) {
      // Charmant: Einflussgewinn -1 DC
      addPos(-1);
    }
  }
}

function applySpecialistDcMods(
  player: PlayerState,
  acc: DcModAcc,
  opts: { influenceGain?: boolean } = {}
): void {
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const t of s.traits) applySpecialistTraitDcMods(acc, t, opts);
  }
}

function specialistUpkeepAdjustments(
  _player: PlayerState,
  specialist: PlayerHoldings['specialists'][number]
): { goldDelta: number; influenceDelta: number } {
  if (!isSpecialistActive(specialist))
    return { goldDelta: 0, influenceDelta: 0 };
  let goldDelta = 0;
  let influenceDelta = 0;

  for (const trait of specialist.traits) {
    const posMult = traitPosMult(trait);
    const negMult = traitNegMult(trait);
    const addPosGold = (delta: number) => {
      goldDelta += delta * posMult;
    };
    const addNegGold = (delta: number) => {
      if (trait.positiveOnly) return;
      goldDelta += delta * negMult;
    };
    const addNegInfluence = (delta: number) => {
      if (trait.positiveOnly) return;
      influenceDelta += delta * negMult;
    };

    switch (trait.id) {
      case 2: // Akribisch: +1 Gold Unterhalt
        addNegGold(1);
        break;
      case 5: // Kreativ: +2 Unterhalt
        addNegGold(2);
        break;
      case 7: // Analytisch: -4 Unterhalt
        addPosGold(-4);
        break;
      case 11: // Traditionell: +2 Gold Unterhalt
        addNegGold(2);
        break;
      case 14: // Perfektionist: +4 Gold Unterhalt
        addNegGold(4);
        break;
      case 17: // Stoisch: +1 Gold Unterhalt
        addNegGold(1);
        break;
      case 18: // Ehrlich: +2 Einfluss Unterhalt
        addNegInfluence(2);
        break;
      case 19: // Emotional: -1 Gold Unterhalt; -1 LO
        addNegGold(-1);
        break;
      default:
        break;
    }
  }

  return { goldDelta, influenceDelta };
}

function specialistGoldIncomeBonusPerRound(player: PlayerState): number {
  let gold = 0;
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const trait of s.traits) {
      const posMult = traitPosMult(trait);
      const addPos = (delta: number) => {
        gold += delta * posMult;
      };
      switch (trait.id) {
        case 12: // Ehrgeizig: +2 Ertrag
        case 13: // Intuitiv: +2 Ertrag
          addPos(2);
          break;
        case 15: // Autoritär: +2 Ertrag
          addPos(2);
          break;
        case 16: // Pragmatisch: +2 Ertrag; +1 Gold
          addPos(3);
          break;
        default:
          break;
      }
    }
  }
  return gold;
}

function specialistMaterialsActionBonus(
  player: PlayerState,
  mode: 'domainAdministration' | 'workshopOversight'
): { rawBonus: number; specialBonus: number } {
  let rawBonus = 0;
  let specialBonus = 0;
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const trait of s.traits) {
      if (trait.id !== 9) continue; // Energisch
      const posMult = traitPosMult(trait);
      if (mode === 'domainAdministration') rawBonus += 2 * posMult;
      else specialBonus += 1 * posMult;
    }
  }
  return { rawBonus, specialBonus };
}

function specialistRefinementStepBonus(player: PlayerState): number {
  let steps = 0;
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const trait of s.traits) {
      if (trait.id !== 14) continue; // Perfektionist
      steps += traitPosMult(trait);
    }
  }
  return steps;
}

function specialistCombatPowerBonus(player: PlayerState): number {
  let bonus = 0;
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const trait of s.traits) {
      if (trait.id !== 6) continue; // Mutig
      bonus += 2 * traitPosMult(trait);
    }
  }
  return bonus;
}

function specialistDefenseModifierDelta(player: PlayerState): number {
  let delta = 0;
  for (const s of player.holdings.specialists) {
    if (!isSpecialistActive(s)) continue;
    for (const trait of s.traits) {
      if (trait.id !== 6) continue; // Mutig
      if (trait.positiveOnly) continue;
      delta += -2 * traitNegMult(trait);
    }
  }
  return delta;
}

function specialistSelfLoyaltyAdjusted(
  base: number,
  traits: SpecialistTrait[],
  opts: { religious: boolean }
): number {
  let loyalty = Math.max(0, Math.min(6, Math.trunc(base)));
  for (const trait of traits) {
    const posMult = traitPosMult(trait);
    const negMult = traitNegMult(trait);
    const addPos = (delta: number) => {
      loyalty += delta * posMult;
    };
    const addNeg = (delta: number) => {
      if (trait.positiveOnly) return;
      loyalty += delta * negMult;
    };

    switch (trait.id) {
      case 1: // Ambitioniert: -2 LO
        addNeg(-2);
        break;
      case 3: // Diszipliniert: +1 LO
        addPos(1);
        break;
      case 4: // Charmant: -2 LO
        addNeg(-2);
        break;
      case 10: // Diplomat: -1 LO
        addNeg(-1);
        break;
      case 11: // Traditionell: +1 LO
        addPos(1);
        break;
      case 13: // Intuitiv: -1 LO
        addNeg(-1);
        break;
      case 16: // Pragmatisch: -2 LO
        addNeg(-2);
        break;
      case 17: // Stoisch: +1 LO
        addPos(1);
        break;
      case 18: // Ehrlich: +2 LO
        addPos(2);
        break;
      case 19: // Emotional: -1 LO
        addNeg(-1);
        break;
      case 20: // Religiös: +3 LO wenn religiös, sonst -3 LO
        if (opts.religious) addPos(3);
        else addNeg(-3);
        break;
      default:
        break;
    }
  }
  return Math.max(0, Math.min(6, Math.trunc(loyalty)));
}

function addStock(target: MaterialStock, add: MaterialStock): MaterialStock {
  const next: MaterialStock = { ...target };
  for (const [k, v] of Object.entries(add)) {
    if (!v) continue;
    next[k] = (next[k] ?? 0) + v;
    if (next[k] <= 0) delete next[k];
  }
  return next;
}

function subtractStock(
  target: MaterialStock,
  sub: MaterialStock
): MaterialStock {
  const next: MaterialStock = { ...target };
  for (const [k, v] of Object.entries(sub)) {
    if (!v) continue;
    next[k] = (next[k] ?? 0) - v;
    if (next[k] <= 0) delete next[k];
  }
  return next;
}

function sumStock(stock: MaterialStock): number {
  let sum = 0;
  for (const value of Object.values(stock)) sum += value;
  return sum;
}

function materialTierRank(tier: string): number {
  switch (tier) {
    case 'cheap':
      return 1;
    case 'basic':
      return 2;
    case 'expensive':
      return 3;
    default:
      return 2;
  }
}

function normalizeDomainRawPicks(
  picks: string[] | undefined,
  tier: DomainTier
): string[] {
  const fallback = (DEFAULT_DOMAIN_RAW_PICKS_BY_TIER as any)[tier] as
    | readonly string[]
    | undefined;
  const list = (
    picks?.length ? picks : (fallback ?? DEFAULT_DOMAIN_RAW_PICKS_BY_TIER.small)
  ).map((id) => id.trim());

  const unique = Array.from(new Set(list));
  if (unique.length !== list.length) {
    throw new GameRuleError('INPUT', 'Material-Picks enthalten Duplikate.');
  }

  const expected = (() => {
    switch (tier) {
      case 'starter':
        return {
          total: 1,
          cheap: 1,
          basic: 0,
          expensiveMin: 0,
          expensiveMax: 0,
          maxBonusGold: 0,
        };
      case 'small':
        return {
          total: 3,
          cheap: 2,
          basic: 1,
          expensiveMin: 0,
          expensiveMax: 0,
          maxBonusGold: 0,
        };
      case 'medium':
        return {
          total: 5,
          cheap: 3,
          basic: 2,
          expensiveMin: 0,
          expensiveMax: 0,
          maxBonusGold: 1,
        };
      case 'large':
        // 4× billig + (3× einfach) oder (2× einfach + 1× teuer)
        return {
          total: 7,
          cheap: 4,
          basicMin: 2,
          basicMax: 3,
          expensiveMin: 0,
          expensiveMax: 1,
          maxBonusGold: 1,
        };
    }
  })();

  if (unique.length !== expected.total) {
    throw new GameRuleError(
      'INPUT',
      `Material-Picks müssen genau ${expected.total} Rohmaterialien enthalten (Tier: ${tier}).`
    );
  }

  let cheap = 0;
  let basic = 0;
  let expensive = 0;
  let bonusGoldPicks = 0;

  for (const materialId of unique) {
    const mat = getMaterialOrThrow(materialId);
    if (mat.kind !== 'raw') {
      throw new GameRuleError(
        'INPUT',
        `Material-Pick ist kein Rohmaterial: ${materialId}.`
      );
    }
    if (mat.tier === 'cheap') cheap += 1;
    if (mat.tier === 'basic') basic += 1;
    if (mat.tier === 'expensive') expensive += 1;
    if (mat.saleBonusGold !== 0) bonusGoldPicks += 1;
  }

  if (cheap !== expected.cheap) {
    throw new GameRuleError(
      'INPUT',
      `Ungültige Anzahl billiger RM-Picks (erwartet ${expected.cheap}).`
    );
  }

  if ('basic' in expected && basic !== (expected as any).basic) {
    throw new GameRuleError(
      'INPUT',
      `Ungültige Anzahl einfacher RM-Picks (erwartet ${(expected as any).basic}).`
    );
  }
  if (
    'basicMin' in expected &&
    (basic < (expected as any).basicMin || basic > (expected as any).basicMax)
  ) {
    throw new GameRuleError(
      'INPUT',
      `Ungültige Anzahl einfacher RM-Picks (erwartet ${(expected as any).basicMin}–${(expected as any).basicMax}).`
    );
  }

  if (expensive < expected.expensiveMin || expensive > expected.expensiveMax) {
    throw new GameRuleError(
      'INPUT',
      `Ungültige Anzahl teurer RM-Picks (erwartet ${expected.expensiveMin}–${expected.expensiveMax}).`
    );
  }

  if (bonusGoldPicks > expected.maxBonusGold) {
    throw new GameRuleError(
      'INPUT',
      `Zu viele RM-Picks mit Bonus-Gold (max. ${expected.maxBonusGold}).`
    );
  }

  return unique;
}

function normalizeAgricultureRawPicks(picks: string[] | undefined): string[] {
  const fallback = [
    'raw.grain',
    'raw.vegetables',
    'raw.buildStone',
    'raw.honey',
  ];
  const list = (picks?.length ? picks : fallback).map((id) => id.trim());
  const unique = Array.from(new Set(list));
  if (unique.length !== list.length)
    throw new GameRuleError('INPUT', 'Material-Picks enthalten Duplikate.');
  if (unique.length !== 4)
    throw new GameRuleError(
      'INPUT',
      'Landwirtschaft erfordert genau 4 Rohmaterial-Picks.'
    );
  let cheap = 0;
  let basic = 0;
  for (const materialId of unique) {
    const mat = getMaterialOrThrow(materialId);
    if (mat.kind !== 'raw')
      throw new GameRuleError(
        'INPUT',
        `Material-Pick ist kein Rohmaterial: ${materialId}.`
      );
    if (mat.tier === 'cheap') cheap += 1;
    if (mat.tier === 'basic') basic += 1;
  }
  if (cheap !== 2 || basic !== 2) {
    throw new GameRuleError(
      'INPUT',
      'Landwirtschaft erfordert genau 2 billige + 2 einfache Rohmaterialien.'
    );
  }
  return unique;
}

function safeDomainRawPicks(domain: {
  rawPicks?: string[];
  tier?: DomainTier;
  specialization?: { kind?: string } | null;
}): string[] {
  const tier: DomainTier = domain.tier ?? 'small';

  // Spezialisierungen können die Produktionsauswahl erweitern (v1: Landwirtschaft = 2 billig + 2 einfach).
  if (domain.specialization?.kind === 'agriculture') {
    try {
      return normalizeAgricultureRawPicks(domain.rawPicks);
    } catch {
      return normalizeAgricultureRawPicks(undefined);
    }
  }

  const fallback = (DEFAULT_DOMAIN_RAW_PICKS_BY_TIER as any)[tier] as
    | string[]
    | undefined;
  try {
    return normalizeDomainRawPicks(domain.rawPicks ?? fallback, tier);
  } catch {
    return fallback ? [...fallback] : [...DEFAULT_STARTER_DOMAIN_RAW_PICKS];
  }
}

function distributeRawAcrossPicks(
  total: number,
  picks: string[]
): MaterialStock {
  const normalized = Array.from(new Set(picks.map((p) => p.trim()))).filter(
    Boolean
  );
  if (!normalized.length) return {};
  const per = Math.floor(total / normalized.length);
  let remainder = total - per * normalized.length;
  const stock: MaterialStock = {};
  for (const materialId of normalized) {
    let amount = per;
    if (remainder > 0) {
      amount += 1;
      remainder -= 1;
    }
    if (amount > 0) stock[materialId] = (stock[materialId] ?? 0) + amount;
  }
  return stock;
}

function domainPrimaryRawPick(domain: { rawPicks?: string[] }): string | null {
  const picks = safeDomainRawPicks(domain);
  return picks.length ? picks[0] : null;
}

function pickBestSpecialMaterial(
  targetTier: 'cheap' | 'basic' | 'expensive',
  sourceTags: string[],
  opts?: { requireLuxury?: boolean }
): string | null {
  const candidates = Object.values(MATERIALS_V1).filter((m) => {
    if (m.kind !== 'special') return false;
    if (m.tier !== targetTier) return false;
    if (opts?.requireLuxury && !m.tags.includes('luxury')) return false;
    return true;
  });
  if (!candidates.length) return null;
  const scored = candidates.map((m) => {
    const shared = m.tags.filter((t) => sourceTags.includes(t)).length;
    return { material: m, score: shared };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const bonus =
      (b.material.saleBonusGold ?? 0) - (a.material.saleBonusGold ?? 0);
    if (bonus !== 0) return bonus;
    return a.material.id.localeCompare(b.material.id);
  });
  return scored[0].material.id;
}

function defaultWorkshopOutputForInput(inputMaterialId: string): string {
  const input = getMaterialOrThrow(inputMaterialId);
  if (input.kind !== 'raw') return 'special.simpleTools';
  const targetTier = input.tier === 'basic' ? 'basic' : 'cheap';
  const picked = pickBestSpecialMaterial(targetTier, input.tags);
  if (picked) return picked;
  return targetTier === 'basic' ? 'special.bronzeGoods' : 'special.simpleTools';
}

function refinementStepsForLocation(
  player: PlayerState,
  location: { kind: 'domain' | 'cityProperty'; id: string }
): number {
  const isRefineKey = (key: string) =>
    key.startsWith('special.small.refine') ||
    key.startsWith('special.medium.refine') ||
    key.startsWith('special.large.refine');

  if (location.kind === 'domain') {
    const domain = player.holdings.domains.find((d) => d.id === location.id);
    if (!domain) return 0;
    const base = domain.facilities.filter((f) => isRefineKey(f.key)).length;
    const spec =
      domain.specialization?.facilities?.filter((f) => isRefineKey(f.key))
        .length ?? 0;
    return base + spec + specialistRefinementStepBonus(player);
  }
  const city = player.holdings.cityProperties.find((c) => c.id === location.id);
  if (!city) return 0;
  const base = city.facilities.filter((f) => isRefineKey(f.key)).length;
  const spec =
    city.specialization?.facilities?.filter((f) => isRefineKey(f.key)).length ??
    0;
  return base + spec + specialistRefinementStepBonus(player);
}

function refineSpecialMaterialId(materialId: string, steps: number): string {
  let current = materialId;
  let remaining = Math.max(0, Math.trunc(steps));
  while (remaining > 0) {
    const mat = getMaterialOrThrow(current);
    if (mat.kind !== 'special') break;
    if (mat.tier === 'cheap') {
      const next = pickBestSpecialMaterial('basic', mat.tags);
      if (!next) break;
      current = next;
    } else if (mat.tier === 'basic') {
      const next = pickBestSpecialMaterial('expensive', mat.tags);
      if (!next) break;
      current = next;
    } else if (mat.tier === 'expensive') {
      if (mat.tags.includes('luxury')) break;
      const next = pickBestSpecialMaterial('expensive', mat.tags, {
        requireLuxury: true,
      });
      if (!next) break;
      current = next;
    }
    remaining -= 1;
  }
  return current;
}

function takeFromStock(
  stock: MaterialStock,
  amount: number,
  materialIdOrder: (ids: string[]) => string[]
): { taken: MaterialStock; remaining: MaterialStock } {
  let remainingToTake = Math.max(0, Math.trunc(amount));
  if (remainingToTake <= 0) return { taken: {}, remaining: stock };

  const remaining: MaterialStock = { ...stock };
  const taken: MaterialStock = {};
  const ids = materialIdOrder(Object.keys(stock));

  for (const materialId of ids) {
    if (remainingToTake <= 0) break;
    const available = remaining[materialId] ?? 0;
    if (available <= 0) continue;
    const take = Math.min(available, remainingToTake);
    remainingToTake -= take;
    taken[materialId] = (taken[materialId] ?? 0) + take;
    remaining[materialId] = available - take;
    if (remaining[materialId] <= 0) delete remaining[materialId];
  }

  return { taken, remaining };
}

export function applyEvent(
  state: CampaignState | null,
  event: GameEvent
): CampaignState {
  switch (event.type) {
    case 'CampaignCreated': {
      return {
        id: event.campaignId,
        name: event.name,
        rulesVersion: event.rulesVersion,
        rules: event.rules,
        round: event.round,
        phase: event.phase,
        gmUserId: event.gmUserId,
        market: startingMarketState(event.round),
        globalEvents: [],
        players: {},
        playerIdByUserId: {},
      };
    }
    default: {
      if (!state) throw new Error(`Cannot apply ${event.type} without state`);
    }
  }

  switch (event.type) {
    case 'PlayerJoined': {
      const existing = state.playerIdByUserId[event.userId];
      if (existing) return state;
      const player: PlayerState = {
        id: event.playerId,
        userId: event.userId,
        displayName: event.displayName,
        checks: startingPlayerChecks(),
        holdings: startingPlayerHoldings(),
        politics: { kw: 0, as: 0, n: 0 },
        economy: startingPlayerEconomy(),
        turn: startingPlayerTurn(startingPlayerHoldings(), state.rules),
        privateNotes: [],
      };
      return {
        ...state,
        players: { ...state.players, [event.playerId]: player },
        playerIdByUserId: {
          ...state.playerIdByUserId,
          [event.userId]: event.playerId,
        },
      };
    }
    case 'PlayerInitialized': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            checks: event.checks,
            holdings: event.holdings,
            economy: event.economy,
            turn: event.turn,
          },
        },
      };
    }
    case 'PhaseAdvanced': {
      return { ...state, phase: event.to, round: event.round };
    }
    case 'MarketRolled': {
      return {
        ...state,
        market: {
          round: event.round,
          instances: event.instances.map((i) => ({
            id: i.id,
            label: i.label,
            ownerPlayerId: i.ownerPlayerId,
            raw: {
              tableRollTotal: i.raw.tableRoll.total,
              categoryLabel: i.raw.categoryLabel,
              demandLabel: i.raw.demandLabel,
              modifiersByGroup: i.raw.modifiersByGroup,
            },
            special: {
              tableRollTotal: i.special.tableRoll.total,
              categoryLabel: i.special.categoryLabel,
              demandLabel: i.special.demandLabel,
              modifiersByGroup: i.special.modifiersByGroup,
            },
          })),
        },
      };
    }
    case 'SectionEventsRolled': {
      return {
        ...state,
        globalEvents: event.events.map((e) => ({
          startsAtRound: event.startsAtRound,
          endsAtRound: event.endsAtRound,
          tableRollTotal: e.tableRoll.total,
          name: e.name,
          effectsText: e.effectsText,
          meta: e.meta,
        })),
      };
    }
    case 'PlayerPendingApplied': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.goldApplied,
              pending: {
                gold: Math.max(
                  0,
                  player.economy.pending.gold - event.goldApplied
                ),
                labor: Math.max(
                  0,
                  player.economy.pending.labor - event.laborApplied
                ),
                raw: subtractStock(
                  player.economy.pending.raw,
                  event.rawApplied
                ),
                special: subtractStock(
                  player.economy.pending.special,
                  event.specialApplied
                ),
                magicPower: Math.max(
                  0,
                  player.economy.pending.magicPower - event.magicPowerApplied
                ),
              },
              inventory: {
                raw: addStock(player.economy.inventory.raw, event.rawApplied),
                special: addStock(
                  player.economy.inventory.special,
                  event.specialApplied
                ),
                magicPower:
                  player.economy.inventory.magicPower + event.magicPowerApplied,
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: player.turn.laborAvailable + event.laborApplied,
            },
          },
        },
      };
    }
    case 'PlayerIncomeApplied': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const goldDelta =
        event.produced.gold -
        event.upkeepPaid.gold -
        event.eventTaxesPaid.gold -
        event.eventTaxesPaid.oneTimeOfficeTaxGold;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + goldDelta,
              inventory: {
                raw: subtractStock(
                  addStock(player.economy.inventory.raw, event.produced.raw),
                  event.upkeepPaid.raw
                ),
                special: subtractStock(
                  addStock(
                    player.economy.inventory.special,
                    event.produced.special
                  ),
                  event.upkeepPaid.special
                ),
                magicPower:
                  player.economy.inventory.magicPower +
                  event.produced.magicPower -
                  event.upkeepPaid.magicPower,
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable +
                  event.produced.labor -
                  event.upkeepPaid.labor
              ),
              influenceAvailable: Math.max(
                0,
                player.turn.influenceAvailable +
                  event.produced.influence -
                  event.upkeepPaid.influence
              ),
              upkeep: event.upkeep,
            },
          },
        },
      };
    }
    case 'PlayerMaterialsConverted': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.convertedToGold.goldGained,
              inventory: {
                raw: subtractStock(
                  subtractStock(
                    addStock(
                      addStock(
                        player.economy.inventory.raw,
                        event.workshop.rawProduced
                      ),
                      event.facilities.rawProduced
                    ),
                    addStock(
                      event.workshop.rawConsumed,
                      event.facilities.rawConsumed
                    )
                  ),
                  addStock(event.convertedToGold.rawByType, event.lost.rawLost)
                ),
                special: subtractStock(
                  subtractStock(
                    subtractStock(
                      addStock(
                        addStock(
                          player.economy.inventory.special,
                          event.workshop.specialProduced
                        ),
                        event.facilities.specialProduced
                      ),
                      event.facilities.specialConsumed
                    ),
                    event.convertedToGold.specialByType
                  ),
                  event.lost.specialLost
                ),
                magicPower: player.economy.inventory.magicPower,
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable -
                  event.convertedToGold.laborConverted
              ),
              influenceAvailable: Math.max(
                0,
                player.turn.influenceAvailable -
                  event.convertedToGold.influenceConverted
              ),
            },
          },
        },
      };
    }
    case 'PlayerTurnReset': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const toggleFollowers = (current: {
        levels: number;
        loyalty: number;
        inUnrest: boolean;
      }) => {
        const levels = Math.max(0, Math.trunc(current.levels));
        const loyalty = Math.max(0, Math.min(6, Math.trunc(current.loyalty)));
        if (levels <= 0)
          return { ...current, levels, loyalty, inUnrest: false };
        if (loyalty <= 0)
          return { ...current, levels, loyalty, inUnrest: true };
        if (loyalty >= 3)
          return { ...current, levels, loyalty, inUnrest: false };
        // LO 1–2: alternierend (jede zweite Runde verfügbar)
        return { ...current, levels, loyalty, inUnrest: !current.inUnrest };
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              domains: player.holdings.domains.map((d) => ({
                ...d,
                tenants: toggleFollowers(d.tenants),
              })),
              cityProperties: player.holdings.cityProperties.map((c) => ({
                ...c,
                tenants: toggleFollowers(c.tenants),
              })),
              organizations: player.holdings.organizations.map((o) => ({
                ...o,
                followers: toggleFollowers(o.followers),
              })),
            },
            turn: {
              laborAvailable: event.laborAvailable,
              influenceAvailable: event.influenceAvailable,
              actionsUsed: event.actionsUsed,
              actionKeysUsed: event.actionKeysUsed,
              facilityActionUsed: event.facilityActionUsed,
              usedPoliticalSteps: event.usedPoliticalSteps,
              upkeep: event.upkeep,
            },
          },
        },
      };
    }
    case 'PlayerInfluenceGained': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              permanentInfluence:
                player.holdings.permanentInfluence +
                event.permanentInfluenceIncreasedBy,
            },
            turn: {
              ...player.turn,
              influenceAvailable:
                player.turn.influenceAvailable + event.influenceGained,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneyLent': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              pending: {
                ...player.economy.pending,
                gold: player.economy.pending.gold + event.goldScheduled,
              },
            },
            turn: {
              ...player.turn,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneySold': {
      const player = state.players[event.playerId];
      if (!player) return state;
      let invRaw = player.economy.inventory.raw;
      let invSpecial = player.economy.inventory.special;
      let laborAvailable = player.turn.laborAvailable;
      for (const item of event.sold) {
        if (item.kind === 'raw') {
          invRaw = subtractStock(invRaw, { [item.materialId]: item.count });
        } else if (item.kind === 'special') {
          invSpecial = subtractStock(invSpecial, {
            [item.materialId]: item.count,
          });
        } else if (item.kind === 'labor') {
          laborAvailable = Math.max(0, laborAvailable - item.count);
        }
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold + event.goldGained,
              inventory: {
                ...player.economy.inventory,
                raw: invRaw,
                special: invSpecial,
              },
            },
            turn: {
              ...player.turn,
              laborAvailable,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMoneyBought': {
      const player = state.players[event.playerId];
      if (!player) return state;
      let pendingRaw = player.economy.pending.raw;
      let pendingSpecial = player.economy.pending.special;
      let pendingLabor = player.economy.pending.labor;
      for (const item of event.bought) {
        if (item.kind === 'raw') {
          pendingRaw = addStock(pendingRaw, { [item.materialId]: item.count });
        } else if (item.kind === 'special') {
          pendingSpecial = addStock(pendingSpecial, {
            [item.materialId]: item.count,
          });
        } else if (item.kind === 'labor') {
          pendingLabor += item.count;
        }
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              pending: {
                ...player.economy.pending,
                labor: pendingLabor,
                raw: pendingRaw,
                special: pendingSpecial,
              },
            },
            turn: {
              ...player.turn,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerMaterialsGained': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              inventory: {
                ...player.economy.inventory,
                raw: addStock(player.economy.inventory.raw, event.rawGained),
                special: addStock(
                  player.economy.inventory.special,
                  event.specialGained
                ),
              },
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable - event.laborSpent
              ),
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
            },
          },
        },
      };
    }
    case 'PlayerDomainAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              domains: [
                ...player.holdings.domains,
                {
                  id: event.domainId,
                  tier: event.tier,
                  facilities: [],
                  rawPicks: normalizeDomainRawPicks(event.rawPicks, event.tier),
                  tenants: { levels: 0, loyalty: 3, inUnrest: false },
                },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerCityPropertyAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              cityProperties: [
                ...player.holdings.cityProperties,
                {
                  id: event.cityPropertyId,
                  tier: event.tier,
                  tenure: event.tenure,
                  mode: 'leased',
                  facilities: [],
                  tenants: { levels: 0, loyalty: 3, inUnrest: false },
                },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerCityPropertyModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              cityProperties: player.holdings.cityProperties.map((c) =>
                c.id === event.cityPropertyId ? { ...c, mode: event.mode } : c
              ),
            },
          },
        },
      };
    }
    case 'PlayerOfficeAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(
          0,
          player.turn.influenceAvailable - event.influenceSpent
        ),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
              },
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              offices: [
                ...player.holdings.offices,
                {
                  id: event.officeId,
                  tier: event.tier,
                  yieldMode: 'influence',
                  facilities: [],
                },
              ],
            },
          },
        },
      };
    }
    case 'PlayerOfficeYieldModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              offices: player.holdings.offices.map((o) =>
                o.id === event.officeId ? { ...o, yieldMode: event.mode } : o
              ),
            },
          },
        },
      };
    }
    case 'PlayerOfficeLost': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              offices: player.holdings.offices.filter((o) => o.id !== event.officeId),
            },
          },
        },
      };
    }
    case 'PlayerOrganizationAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(
          0,
          player.turn.influenceAvailable - event.influenceSpent
        ),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
              },
              turn: nextTurn,
            },
          },
        };
      }
      const permInfFor = (kind: string, tier: PostTier) => {
        if (kind === 'spy')
          return tier === 'medium' ? 1 : tier === 'large' ? 2 : 0;
        if (kind === 'cult')
          return tier === 'medium' ? 2 : tier === 'large' ? 4 : 0;
        return 0;
      };
      const permanentInfluenceDelta =
        permInfFor(event.kind, event.toTier) -
        permInfFor(event.kind, event.fromTier);
      const existing = player.holdings.organizations.find(
        (o) => o.id === event.organizationId
      );
      const nextOrgs = existing
        ? player.holdings.organizations.map((o) =>
            o.id === event.organizationId ? { ...o, tier: event.toTier } : o
          )
        : [
            ...player.holdings.organizations,
            {
              id: event.organizationId,
              kind: event.kind,
              tier: event.toTier,
              facilities: [],
              followers: { levels: 0, loyalty: 3, inUnrest: false },
            },
          ];
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              permanentInfluence:
                player.holdings.permanentInfluence + permanentInfluenceDelta,
              organizations: nextOrgs,
            },
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              turn: nextTurn,
            },
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              tradeEnterprises: [
                ...player.holdings.tradeEnterprises,
                {
                  id: event.tradeEnterpriseId,
                  tier: event.tier,
                  mode: 'produce',
                  facilities: [],
                  damage: undefined,
                },
              ],
            },
            turn: nextTurn,
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseModeSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              tradeEnterprises: player.holdings.tradeEnterprises.map((t) =>
                t.id === event.tradeEnterpriseId
                  ? { ...t, mode: event.mode }
                  : t
              ),
            },
          },
        },
      };
    }
    case 'PlayerTenantsAcquired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(
          0,
          player.turn.influenceAvailable - event.influenceSpent
        ),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
              },
              turn: nextTurn,
            },
          },
        };
      }
      const withAddedLevels = (
        current: { levels: number; loyalty: number; inUnrest: boolean },
        add: number
      ) => {
        const added = Math.max(0, Math.trunc(add));
        const levels = Math.max(0, current.levels + added);
        const loyalty = Math.max(0, Math.min(6, current.loyalty));

        // Soll: Neuanwerbung startet aktiv (inUnrest=false).
        let inUnrest = current.inUnrest;
        if (levels <= 0) inUnrest = false;
        else if (loyalty <= 0) inUnrest = true;
        else if (loyalty >= 3) inUnrest = false;
        else if (current.levels <= 0 && levels > 0) {
          // Wenn LO=1–2 gilt: Start "aktiv" soll in der nächsten Runde gelten → wir setzen hier inUnrest=true,
          // damit das Round-End-Toggle (PlayerTurnReset) zu inUnrest=false führt.
          inUnrest = true;
        }

        return { ...current, levels, loyalty, inUnrest };
      };
      const updateDomains =
        event.location.kind === 'domain'
          ? player.holdings.domains.map((d) =>
              d.id === event.location.id
                ? { ...d, tenants: withAddedLevels(d.tenants, event.levels) }
                : d
            )
          : player.holdings.domains;
      const updateCities =
        event.location.kind === 'cityProperty'
          ? player.holdings.cityProperties.map((c) =>
              c.id === event.location.id
                ? { ...c, tenants: withAddedLevels(c.tenants, event.levels) }
                : c
            )
          : player.holdings.cityProperties;
      const updateOrgs =
        event.location.kind === 'organization'
          ? player.holdings.organizations.map((o) =>
              o.id === event.location.id
                ? {
                    ...o,
                    followers: withAddedLevels(o.followers, event.levels),
                  }
                : o
            )
          : player.holdings.organizations;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            turn: nextTurn,
            holdings: {
              ...player.holdings,
              domains: updateDomains,
              cityProperties: updateCities,
              organizations: updateOrgs,
            },
          },
        },
      };
    }
    case 'PlayerTroopsRecruited': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const nextTurn = {
        ...player.turn,
        influenceAvailable: Math.max(
          0,
          player.turn.influenceAvailable - event.influenceSpent
        ),
        actionsUsed: player.turn.actionsUsed + event.actionCost,
        actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
      };
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
                inventory: {
                  ...player.economy.inventory,
                  raw: subtractStock(
                    player.economy.inventory.raw,
                    event.rawSpent
                  ),
                  special: subtractStock(
                    player.economy.inventory.special,
                    event.specialSpent
                  ),
                },
              },
              turn: nextTurn,
            },
          },
        };
      }
      const troops = { ...player.holdings.troops };
      switch (event.troopKind) {
        case 'bodyguard':
          troops.bodyguardLevels += event.levels;
          break;
        case 'militia':
          troops.militiaLevels += event.levels;
          break;
        case 'mercenary':
          troops.mercenaryLevels += event.levels;
          break;
        case 'thug':
          troops.thugLevels += event.levels;
          break;
      }
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(
                  player.economy.inventory.raw,
                  event.rawSpent
                ),
                special: subtractStock(
                  player.economy.inventory.special,
                  event.specialSpent
                ),
              },
            },
            turn: nextTurn,
            holdings: { ...player.holdings, troops },
          },
        },
      };
    }
    case 'PlayerWorkshopBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              workshops: [
                ...player.holdings.workshops,
                {
                  id: event.workshopId,
                  tier: event.tier,
                  location: { ...event.location },
                  inputMaterialId: event.inputMaterialId,
                  outputMaterialId: event.outputMaterialId,
                  facilities: [],
                },
              ],
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerWorkshopUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              workshops: player.holdings.workshops.map((w) =>
                w.id === event.workshopId ? { ...w, tier: event.toTier } : w
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStorageBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              storages: [
                ...player.holdings.storages,
                {
                  id: event.storageId,
                  tier: event.tier,
                  location: { ...event.location },
                  facilities: [],
                },
              ],
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStorageUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              storages: player.holdings.storages.map((s) =>
                s.id === event.storageId ? { ...s, tier: event.toTier } : s
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerFacilityBuilt': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const spend = {
        gold: event.goldSpent,
        influence: event.influenceSpent,
        labor: event.laborSpent,
      };
      let domains = player.holdings.domains;
      let cityProperties = player.holdings.cityProperties;
      let organizations = player.holdings.organizations;
      let offices = player.holdings.offices;
      let tradeEnterprises = player.holdings.tradeEnterprises;
      let workshops = player.holdings.workshops;
      let troops = player.holdings.troops;
      let personalFacilities = player.holdings.personalFacilities;
      const facility = {
        id: event.facilityInstanceId,
        key: event.facilityKey,
        builtAtRound: state.round,
      };

      if (event.location.kind === 'domain') {
        const id = event.location.id;
        domains = domains.map((d) =>
          d.id === id ? { ...d, facilities: [...d.facilities, facility] } : d
        );
      } else if (event.location.kind === 'cityProperty') {
        const id = event.location.id;
        cityProperties = cityProperties.map((c) =>
          c.id === id ? { ...c, facilities: [...c.facilities, facility] } : c
        );
      } else if (event.location.kind === 'organization') {
        const id = event.location.id;
        organizations = organizations.map((o) =>
          o.id === id ? { ...o, facilities: [...o.facilities, facility] } : o
        );
      } else if (event.location.kind === 'office') {
        const id = event.location.id;
        offices = offices.map((o) =>
          o.id === id ? { ...o, facilities: [...o.facilities, facility] } : o
        );
      } else if (event.location.kind === 'tradeEnterprise') {
        const id = event.location.id;
        tradeEnterprises = tradeEnterprises.map((t) =>
          t.id === id ? { ...t, facilities: [...t.facilities, facility] } : t
        );
      } else if (event.location.kind === 'workshop') {
        const id = event.location.id;
        workshops = workshops.map((w) =>
          w.id === id ? { ...w, facilities: [...w.facilities, facility] } : w
        );
      } else if (event.location.kind === 'troops') {
        troops = {
          ...troops,
          facilities: [...troops.facilities, facility],
        };
      } else if (event.location.kind === 'personal') {
        personalFacilities = [...personalFacilities, facility];
      }

      const nextHoldings: PlayerHoldings = {
        ...player.holdings,
        domains,
        cityProperties,
        organizations,
        offices,
        tradeEnterprises,
        workshops,
        troops,
        personalFacilities,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - spend.gold,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(
                  player.economy.inventory.raw,
                  event.rawSpent
                ),
                special: subtractStock(
                  player.economy.inventory.special,
                  event.specialSpent
                ),
                magicPower:
                  player.economy.inventory.magicPower - event.magicPowerSpent,
              },
            },
            holdings: nextHoldings,
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable - spend.labor
              ),
              influenceAvailable: Math.max(
                0,
                player.turn.influenceAvailable - spend.influence
              ),
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerLongTermProjectStarted': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const spend = event.upfrontCosts;
      const project = {
        id: event.projectId,
        kind: event.kind,
        location: event.location as any,
        facilityKey: event.facilityKey,
        startedAtRound: Math.trunc(event.startedAtRound),
        totalRounds: Math.max(1, Math.trunc(event.totalRounds)),
        remainingRounds: Math.max(0, Math.trunc(event.remainingRounds)),
        laborPerRound: Math.max(0, Math.trunc(event.laborPerRound)),
        magicPowerPerRound: Math.max(0, Math.trunc(event.magicPowerPerRound)),
      } satisfies PlayerHoldings['longTermProjects'][number];

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - spend.goldSpent,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(player.economy.inventory.raw, spend.rawSpent),
                special: subtractStock(
                  player.economy.inventory.special,
                  spend.specialSpent
                ),
                magicPower:
                  player.economy.inventory.magicPower - spend.magicPowerSpent,
              },
            },
            holdings: {
              ...player.holdings,
              longTermProjects: [...player.holdings.longTermProjects, project],
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable - spend.laborSpent
              ),
              influenceAvailable: Math.max(
                0,
                player.turn.influenceAvailable - spend.influenceSpent
              ),
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerLongTermProjectProgressed': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const remaining = Math.max(0, Math.trunc(event.remainingRoundsAfter));
      const projects = player.holdings.longTermProjects.map((p) =>
        p.id === event.projectId ? { ...p, remainingRounds: remaining } : p
      );

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: { ...player.holdings, longTermProjects: projects },
          },
        },
      };
    }
    case 'PlayerLongTermProjectCompleted': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const facility = {
        id: event.facilityInstanceId,
        key: event.facilityKey,
        builtAtRound: Math.trunc(event.completedAtRound),
      };

      let domains = player.holdings.domains;
      let cityProperties = player.holdings.cityProperties;
      let organizations = player.holdings.organizations;
      let offices = player.holdings.offices;
      let tradeEnterprises = player.holdings.tradeEnterprises;
      let workshops = player.holdings.workshops;
      let troops = player.holdings.troops;
      let personalFacilities = player.holdings.personalFacilities;

      if (event.location.kind === 'domain') {
        const id = event.location.id;
        domains = domains.map((d) =>
          d.id === id ? { ...d, facilities: [...d.facilities, facility] } : d
        );
      } else if (event.location.kind === 'cityProperty') {
        const id = event.location.id;
        cityProperties = cityProperties.map((c) =>
          c.id === id ? { ...c, facilities: [...c.facilities, facility] } : c
        );
      } else if (event.location.kind === 'organization') {
        const id = event.location.id;
        organizations = organizations.map((o) =>
          o.id === id ? { ...o, facilities: [...o.facilities, facility] } : o
        );
      } else if (event.location.kind === 'office') {
        const id = event.location.id;
        offices = offices.map((o) =>
          o.id === id ? { ...o, facilities: [...o.facilities, facility] } : o
        );
      } else if (event.location.kind === 'tradeEnterprise') {
        const id = event.location.id;
        tradeEnterprises = tradeEnterprises.map((t) =>
          t.id === id ? { ...t, facilities: [...t.facilities, facility] } : t
        );
      } else if (event.location.kind === 'workshop') {
        const id = event.location.id;
        workshops = workshops.map((w) =>
          w.id === id ? { ...w, facilities: [...w.facilities, facility] } : w
        );
      } else if (event.location.kind === 'troops') {
        troops = { ...troops, facilities: [...troops.facilities, facility] };
      } else if (event.location.kind === 'personal') {
        personalFacilities = [...personalFacilities, facility];
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              domains,
              cityProperties,
              organizations,
              offices,
              tradeEnterprises,
              workshops,
              troops,
              personalFacilities,
              longTermProjects: player.holdings.longTermProjects.filter(
                (p) => p.id !== event.projectId
              ),
            },
          },
        },
      };
    }
    case 'PlayerFacilityDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };

      const patchFacilities = (facilities: FacilityInstance[]) =>
        facilities.map((f) =>
          f.id === event.facilityInstanceId ? { ...f, damage } : f
        );

      if (event.location.kind === 'domain') {
        const domainId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                domains: player.holdings.domains.map((d) =>
                  d.id === domainId
                    ? { ...d, facilities: patchFacilities(d.facilities) }
                    : d
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'cityProperty') {
        const cityPropertyId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                cityProperties: player.holdings.cityProperties.map((c) =>
                  c.id === cityPropertyId
                    ? { ...c, facilities: patchFacilities(c.facilities) }
                    : c
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'organization') {
        const organizationId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                organizations: player.holdings.organizations.map((o) =>
                  o.id === organizationId
                    ? { ...o, facilities: patchFacilities(o.facilities) }
                    : o
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'office') {
        const officeId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                offices: player.holdings.offices.map((o) =>
                  o.id === officeId
                    ? { ...o, facilities: patchFacilities(o.facilities) }
                    : o
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'tradeEnterprise') {
        const tradeEnterpriseId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                tradeEnterprises: player.holdings.tradeEnterprises.map((t) =>
                  t.id === tradeEnterpriseId
                    ? { ...t, facilities: patchFacilities(t.facilities) }
                    : t
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'workshop') {
        const workshopId = event.location.id;
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                workshops: player.holdings.workshops.map((w) =>
                  w.id === workshopId
                    ? { ...w, facilities: patchFacilities(w.facilities) }
                    : w
                ),
              },
            },
          },
        };
      }
      if (event.location.kind === 'troops') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                troops: {
                  ...player.holdings.troops,
                  facilities: patchFacilities(
                    player.holdings.troops.facilities
                  ),
                },
              },
            },
          },
        };
      }
      if (event.location.kind === 'personal') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              holdings: {
                ...player.holdings,
                personalFacilities: patchFacilities(
                  player.holdings.personalFacilities
                ),
              },
            },
          },
        };
      }

      return state;
    }
    case 'PlayerWorkshopDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              workshops: player.holdings.workshops.map((w) =>
                w.id === event.workshopId ? { ...w, damage } : w
              ),
            },
          },
        },
      };
    }
    case 'PlayerStorageDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              storages: player.holdings.storages.map((s) =>
                s.id === event.storageId ? { ...s, damage } : s
              ),
            },
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseDamaged': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const damage = {
        damagedAtRound: state.round,
        repairCostGold: Math.max(0, Math.trunc(event.repairCostGold)),
        reason: event.reason,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              tradeEnterprises: player.holdings.tradeEnterprises.map((t) =>
                t.id === event.tradeEnterpriseId ? { ...t, damage } : t
              ),
            },
          },
        },
      };
    }
    case 'PlayerTradeEnterpriseLost': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              tradeEnterprises: player.holdings.tradeEnterprises.filter(
                (t) => t.id !== event.tradeEnterpriseId
              ),
            },
          },
        },
      };
    }
    case 'PlayerFollowersAdjusted': {
      const player = state.players[event.playerId];
      if (!player) return state;

      const applyDelta = (
        current: { levels: number; loyalty: number; inUnrest: boolean },
        delta: { levelsDelta?: number; loyaltyDelta?: number }
      ) => {
        const levels = Math.max(0, current.levels + (delta.levelsDelta ?? 0));
        const loyalty = Math.max(
          0,
          Math.min(6, current.loyalty + (delta.loyaltyDelta ?? 0))
        );

        // Soll (v1): LO 0–6. LO=1–2 => Effekte nur jede 2. Runde (alternierend via inUnrest toggle beim Rundenende).
        // Hier: inUnrest nicht mehr direkt aus LO ableiten (sonst verlieren wir das Alternieren),
        // sondern nur harte Fälle normalisieren.
        let inUnrest = current.inUnrest;
        if (levels <= 0) inUnrest = false;
        else if (loyalty <= 0) inUnrest = true;
        else if (loyalty >= 3) inUnrest = false;
        else if (
          (current.levels <= 0 && levels > 0) ||
          (current.loyalty <= 0 && loyalty > 0)
        ) {
          // Start "aktiv" soll in der nächsten Runde gelten → siehe Kommentar bei PlayerTenantsAcquired.
          inUnrest = true;
        }

        return { ...current, levels, loyalty, inUnrest };
      };

      let domains = player.holdings.domains;
      let cityProperties = player.holdings.cityProperties;
      let organizations = player.holdings.organizations;

      for (const change of event.changes) {
        if (change.location.kind === 'domain') {
          domains = domains.map((d) =>
            d.id === change.location.id
              ? { ...d, tenants: applyDelta(d.tenants, change) }
              : d
          );
        } else if (change.location.kind === 'cityProperty') {
          cityProperties = cityProperties.map((c) =>
            c.id === change.location.id
              ? { ...c, tenants: applyDelta(c.tenants, change) }
              : c
          );
        } else if (change.location.kind === 'organization') {
          organizations = organizations.map((o) =>
            o.id === change.location.id
              ? { ...o, followers: applyDelta(o.followers, change) }
              : o
          );
        }
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              domains,
              cityProperties,
              organizations,
            },
          },
        },
      };
    }
    case 'PlayerPoliticsAdjusted': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const clampKw = (kw: number) => Math.max(0, Math.trunc(kw));
      const clampAs = (as: number) => Math.max(-6, Math.min(6, Math.trunc(as)));
      const clampN = (n: number) => Math.max(0, Math.trunc(n));
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            politics: {
              kw: clampKw(player.politics.kw + (event.kwDelta ?? 0)),
              as: clampAs(player.politics.as + (event.asDelta ?? 0)),
              n: clampN(player.politics.n + (event.nDelta ?? 0)),
            },
          },
        },
      };
    }
    case 'PlayerEventIncidentRecorded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const current = player.eventIncidents;
      const nextSectionStartsAtRound = Math.trunc(event.sectionStartsAtRound);
      const nextCounts: Record<string, number> =
        current && current.sectionStartsAtRound === nextSectionStartsAtRound
          ? { ...current.countsByKey }
          : {};

      const kind = String(event.incidentKind ?? 'unknown').trim() || 'unknown';
      const key = `${event.tableRollTotal}:${kind}`;
      const delta = Math.max(0, Math.trunc(event.countDelta));
      nextCounts[key] = Math.max(0, (nextCounts[key] ?? 0) + delta);

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            eventIncidents: {
              sectionStartsAtRound: nextSectionStartsAtRound,
              countsByKey: nextCounts,
            },
          },
        },
      };
    }
    case 'PlayerCounterReactionLossChoiceSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            turn: { ...player.turn, counterReactionLossChoice: event.choice },
          },
        },
      };
    }
    case 'PlayerCounterReactionResolved': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const clampKw = (kw: number) => Math.max(0, Math.trunc(kw));
      const clampAs = (as: number) => Math.max(-6, Math.min(6, Math.trunc(as)));
      const clampN = (n: number) => Math.max(0, Math.trunc(n));

      const nextGold =
        event.loss.kind === 'gold'
          ? player.economy.gold - event.loss.amount
          : player.economy.gold;
      const nextInfluence =
        event.loss.kind === 'influence'
          ? Math.max(0, player.turn.influenceAvailable - event.loss.amount)
          : player.turn.influenceAvailable;

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: { ...player.economy, gold: nextGold },
            politics: {
              kw: clampKw(player.politics.kw + event.politicsDelta.kwDelta),
              as: clampAs(player.politics.as + event.politicsDelta.asDelta),
              n: clampN(player.politics.n + event.politicsDelta.nDelta),
            },
            turn: { ...player.turn, influenceAvailable: nextInfluence },
          },
        },
      };
    }
    case 'PlayerPoliticalStepsResolved': {
      const player = state.players[event.playerId];
      if (!player) return state;
      const clampKw = (kw: number) => Math.max(0, Math.trunc(kw));
      const clampAs = (as: number) => Math.max(-6, Math.min(6, Math.trunc(as)));
      const clampN = (n: number) => Math.max(0, Math.trunc(n));

      if (event.kind === 'convertInformation') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold + event.goldGained,
                information: player.economy.information - event.infoSpent,
              },
              turn: {
                ...player.turn,
                influenceAvailable:
                  player.turn.influenceAvailable + event.influenceGained,
                actionsUsed: player.turn.actionsUsed + event.actionCost,
                actionKeysUsed: [
                  ...player.turn.actionKeysUsed,
                  event.actionKey,
                ],
                usedPoliticalSteps: true,
              },
            },
          },
        };
      }

      const goldSpent = Math.max(
        0,
        event.baseCosts.gold + event.investmentCosts.gold
      );
      const influenceSpent = Math.max(
        0,
        event.baseCosts.influence +
          event.investmentCosts.influence +
          event.influencePenalty
      );

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - goldSpent,
              information:
                player.economy.information - event.infoSpent + event.infoGained,
            },
            politics: {
              kw: clampKw(player.politics.kw + event.politicsDelta.kwDelta),
              as: clampAs(player.politics.as + event.politicsDelta.asDelta),
              n: clampN(player.politics.n + event.politicsDelta.nDelta),
            },
            turn: {
              ...player.turn,
              influenceAvailable: Math.max(
                0,
                player.turn.influenceAvailable - influenceSpent
              ),
              actionsUsed: player.turn.actionsUsed + event.actionCost,
              actionKeysUsed: [...player.turn.actionKeysUsed, event.actionKey],
              usedPoliticalSteps: true,
            },
          },
        },
      };
    }
    case 'PlayerDomainSpecializationSet': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
              inventory: {
                ...player.economy.inventory,
                raw: subtractStock(
                  player.economy.inventory.raw,
                  event.rawSpent
                ),
              },
            },
            holdings: {
              ...player.holdings,
              domains: player.holdings.domains.map((d) =>
                d.id === event.domainId
                  ? {
                      ...d,
                      rawPicks: event.picks?.rawPicks ?? d.rawPicks,
                      specialization: {
                        kind: event.kind,
                        picks: event.picks,
                        facilities: [],
                      },
                    }
                  : d
              ),
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
            },
          },
        },
      };
    }
    case 'PlayerStarterDomainUpgraded': {
      const player = state.players[event.playerId];
      if (!player) return state;

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              domains: player.holdings.domains.map((d) =>
                d.id === event.domainId ? { ...d, tier: 'small' } : d
              ),
            },
            turn: {
              ...player.turn,
              laborAvailable: Math.max(
                0,
                player.turn.laborAvailable - event.laborSpent
              ),
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed:
                player.turn.actionsUsed + (event.usedFreeFacilityBuild ? 0 : 1),
              actionKeysUsed: [
                ...player.turn.actionKeysUsed,
                `facility.upgradeStarterDomain.${event.domainId}`,
              ],
            },
          },
        },
      };
    }
    case 'PlayerSpecialistHired': {
      const player = state.players[event.playerId];
      if (!player) return state;
      if (event.tierResult === 'fail') {
        return {
          ...state,
          players: {
            ...state.players,
            [event.playerId]: {
              ...player,
              economy: {
                ...player.economy,
                gold: player.economy.gold - event.goldSpent,
              },
              turn: {
                ...player.turn,
                facilityActionUsed:
                  player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
                actionsUsed: player.turn.actionsUsed + event.actionCost,
              },
            },
          },
        };
      }
      const religious = isReligiousHoldings(player.holdings);

      const computeExternalLoyaltyDeltas = (traits: SpecialistTrait[]) => {
        let tenantsDelta = 0;
        let followersDelta = 0;
        let troopsDelta = 0;
        let colleaguesDelta = 0;

        for (const trait of traits) {
          const negMult = traitNegMult(trait);
          const addNeg = (delta: number) => {
            if (trait.positiveOnly) return 0;
            return delta * negMult;
          };

          switch (trait.id) {
            case 3: // Diszipliniert (negativ): -1 LO (Posten/Pächter)
              tenantsDelta += addNeg(-1);
              break;
            case 12: // Ehrgeizig (negativ): -1 LO (Kollegen)
              colleaguesDelta += addNeg(-1);
              break;
            case 15: // Autoritär (negativ): -1 LO (Anhänger/Pächter/Truppen)
              tenantsDelta += addNeg(-1);
              followersDelta += addNeg(-1);
              troopsDelta += addNeg(-1);
              break;
            default:
              break;
          }
        }

        return { tenantsDelta, followersDelta, troopsDelta, colleaguesDelta };
      };

      const mainTraits = event.traits as SpecialistTrait[];
      const apprenticeTraits = (event.apprentice?.traits ??
        []) as SpecialistTrait[];
      const deltas = computeExternalLoyaltyDeltas(mainTraits);
      const deltasApprentice = computeExternalLoyaltyDeltas(apprenticeTraits);
      const tenantsDelta = deltas.tenantsDelta + deltasApprentice.tenantsDelta;
      const followersDelta =
        deltas.followersDelta + deltasApprentice.followersDelta;
      const troopsDelta = deltas.troopsDelta + deltasApprentice.troopsDelta;
      const colleaguesDelta =
        deltas.colleaguesDelta + deltasApprentice.colleaguesDelta;

      const adjustFollowers = (
        f: { levels: number; loyalty: number; inUnrest: boolean },
        delta: number
      ) => ({
        ...f,
        loyalty: Math.max(0, Math.min(6, Math.trunc(f.loyalty + delta))),
      });

      const existingSpecialistsAdjusted =
        colleaguesDelta !== 0
          ? player.holdings.specialists.map((s) => ({
              ...s,
              loyalty: Math.max(
                0,
                Math.min(6, Math.trunc(s.loyalty + colleaguesDelta))
              ),
            }))
          : player.holdings.specialists;

      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            economy: {
              ...player.economy,
              gold: player.economy.gold - event.goldSpent,
            },
            holdings: {
              ...player.holdings,
              specialists: [
                ...existingSpecialistsAdjusted,
                {
                  id: event.specialistId,
                  kind: event.kind,
                  secondaryKind: event.secondaryKind,
                  tier: event.tier,
                  loyalty: specialistSelfLoyaltyAdjusted(
                    event.loyaltyFinal ?? 3,
                    mainTraits,
                    {
                      religious,
                    }
                  ),
                  influencePerRoundBonus:
                    event.influencePerRoundBonus || undefined,
                  baseEffectBonus: event.baseEffectBonus || undefined,
                  autoPromoteAtRound: event.autoPromoteAtRound,
                  traits: event.traits.map((t) => ({ ...t })),
                },
                ...(event.apprentice
                  ? [
                      {
                        id: event.apprentice.specialistId,
                        kind: event.apprentice.kind,
                        secondaryKind: event.apprentice.secondaryKind,
                        tier: event.apprentice.tier,
                        loyalty: specialistSelfLoyaltyAdjusted(
                          event.apprentice.loyalty,
                          apprenticeTraits,
                          {
                            religious,
                          }
                        ),
                        traits: event.apprentice.traits.map((t) => ({ ...t })),
                      },
                    ]
                  : []),
              ],
              domains:
                tenantsDelta !== 0
                  ? player.holdings.domains.map((d) => ({
                      ...d,
                      tenants: adjustFollowers(d.tenants, tenantsDelta),
                    }))
                  : player.holdings.domains,
              cityProperties:
                tenantsDelta !== 0
                  ? player.holdings.cityProperties.map((c) => ({
                      ...c,
                      tenants: adjustFollowers(c.tenants, tenantsDelta),
                    }))
                  : player.holdings.cityProperties,
              organizations:
                followersDelta !== 0
                  ? player.holdings.organizations.map((o) => ({
                      ...o,
                      followers: adjustFollowers(o.followers, followersDelta),
                    }))
                  : player.holdings.organizations,
              troops:
                troopsDelta !== 0
                  ? {
                      ...player.holdings.troops,
                      loyalty: Math.max(
                        0,
                        Math.min(
                          6,
                          Math.trunc(
                            player.holdings.troops.loyalty + troopsDelta
                          )
                        )
                      ),
                    }
                  : player.holdings.troops,
            },
            turn: {
              ...player.turn,
              facilityActionUsed:
                player.turn.facilityActionUsed || event.usedFreeFacilityBuild,
              actionsUsed: player.turn.actionsUsed + event.actionCost,
            },
          },
        },
      };
    }
    case 'PlayerSpecialistPromoted': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            holdings: {
              ...player.holdings,
              specialists: player.holdings.specialists.map((s) =>
                s.id === event.specialistId
                  ? { ...s, tier: event.toTier, autoPromoteAtRound: undefined }
                  : s
              ),
            },
          },
        },
      };
    }
    case 'PlayerPrivateNoteAdded': {
      const player = state.players[event.playerId];
      if (!player) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: {
            ...player,
            privateNotes: [...player.privateNotes, event.note],
          },
        },
      };
    }
    case 'PublicLogEntryAdded': {
      return state;
    }
  }
}

export function reduceEvents(
  initial: CampaignState | null,
  events: GameEvent[]
): CampaignState | null {
  let state = initial;
  for (const event of events) state = applyEvent(state, event);
  return state;
}

function ensureActionAvailable(
  player: PlayerState,
  rules: CampaignRules,
  actionKey: string,
  actionCost: number
) {
  const canonical = canonicalActionKey(actionKey);
  if (
    player.turn.actionKeysUsed.some((k) => canonicalActionKey(k) === canonical)
  ) {
    throw new GameRuleError('ACTION', `Aktion bereits genutzt: ${canonical}`);
  }
  if (actionCost <= 0) return;
  const max = rules.actionsPerRound;
  if (player.turn.actionsUsed + actionCost > max) {
    throw new GameRuleError('ACTION', 'Keine Aktionen mehr verfügbar.');
  }
}

function consumeFacilityOrAction(
  player: PlayerState,
  rules: CampaignRules
): { usedFree: boolean; actionCost: number } {
  if (!player.turn.facilityActionUsed && rules.freeFacilityBuildsPerRound > 0) {
    return { usedFree: true, actionCost: 0 };
  }
  const max = rules.actionsPerRound;
  if (player.turn.actionsUsed + 1 > max) {
    throw new GameRuleError('ACTION', 'Keine Aktionen mehr verfügbar.');
  }
  return { usedFree: false, actionCost: 1 };
}

function canonicalActionKey(actionKey: string): string {
  const idx = actionKey.indexOf('@');
  if (idx === -1) return actionKey;
  return actionKey.slice(0, idx);
}

function actionKeyHasMarker(actionKey: string, marker: string): boolean {
  const idx = actionKey.indexOf('@');
  if (idx === -1) return false;
  const markers = actionKey
    .slice(idx + 1)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return markers.includes(marker);
}

function hasUsedCanonicalAction(
  player: PlayerState,
  canonical: string
): boolean {
  return player.turn.actionKeysUsed.some(
    (k) => canonicalActionKey(k) === canonical
  );
}

function hasUsedBonusMarker(player: PlayerState, marker: string): boolean {
  return player.turn.actionKeysUsed.some((k) => actionKeyHasMarker(k, marker));
}

function bonusInfluenceSlots(player: PlayerState): number {
  const largeOffices = player.holdings.offices.filter(
    (o) => o.tier === 'large'
  ).length;
  const hasLargeCult = player.holdings.organizations.some(
    (o) => o.kind === 'cult' && o.tier === 'large' && !o.followers.inUnrest
  );
  return largeOffices + (hasLargeCult ? 1 : 0);
}

function bonusMoneySlots(player: PlayerState): number {
  const hasLargeTradeCollegium = player.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeTradeCollegium ? 1 : 0;
}

function bonusMaterialsSlots(player: PlayerState): number {
  const hasLargeCraftCollegium = player.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeCraftCollegium ? 1 : 0;
}

function canEmitPublicLogs(ctx: EngineContext): boolean {
  return ctx.emitPublicLogs !== false;
}

function openCombatPower(troops: PlayerHoldings['troops']): number {
  // Ableitung aus Aufbausystem.md (Truppen):
  // - Leibgarde: +2 offene Kampfkraft / Stufe
  // - Miliz: +1 offene Kampfkraft / Stufe
  // - Söldner: +2 offene Kampfkraft / Stufe
  // - Protectoren/Schläger: +1 offene Kampfkraft pro 50 (≈ 2 Stufen)
  const thugOpen = Math.floor(troops.thugLevels / 2);
  return (
    troops.bodyguardLevels * 2 +
    troops.militiaLevels +
    troops.mercenaryLevels * 2 +
    thugOpen
  );
}

function defenseRollModifier(player: PlayerState): number {
  // 🧩 Interpretation: Verteidigungsproben nutzen einen abstrahierten Modifikator aus "offener Kampfkraft".
  // Halbe offene Kampfkraft (abgerundet) erzeugt eine sinnvolle Skalierung ohne sofortige Autowins.
  return (
    Math.floor(
      (openCombatPower(player.holdings.troops) +
        specialistCombatPowerBonus(player)) /
        2
    ) + specialistDefenseModifierDelta(player)
  );
}

function generateId(prefix: string, existing: Array<{ id: string }>): string {
  const n = existing.length + 1;
  return `${prefix}-${n}`;
}

function generateFacilityInstanceId(
  location: { kind: string; id?: string },
  existingFacilities: Array<{ id: string }>
): string {
  const n = existingFacilities.length + 1;
  const loc =
    location.kind === 'troops' || location.kind === 'personal'
      ? location.kind
      : (location.id ?? 'unknown');
  return `${location.kind}-${loc}-facility-${n}`;
}

function domainFacilitySlotsMax(tier: DomainTier): number {
  if (tier === 'starter') return 0;
  return 2 * postTierRank(tier);
}

function cityFacilitySlotsMax(tier: CityPropertyTier): number {
  return tier === 'small' ? 2 : tier === 'medium' ? 3 : 4;
}

type CityProductionCounts = {
  small: number;
  medium: number;
  large: number;
  total: number;
};

function cityProductionCaps(tier: CityPropertyTier): {
  small: number;
  medium: number;
  large: number;
} {
  // Soll (docs/rules/soll/facilities.md):
  // - small: 2× small OR 1× medium
  // - medium: 1× small + 1× medium
  // - large: 1× large + 1× medium
  if (tier === 'small') return { small: 2, medium: 1, large: 0 };
  if (tier === 'medium') return { small: 1, medium: 1, large: 0 };
  return { small: 0, medium: 1, large: 1 };
}

function isCityProductionComboAllowed(
  tier: CityPropertyTier,
  counts: CityProductionCounts
): boolean {
  const caps = cityProductionCaps(tier);
  if (counts.small < 0 || counts.medium < 0 || counts.large < 0) return false;
  if (counts.small > caps.small) return false;
  if (counts.medium > caps.medium) return false;
  if (counts.large > caps.large) return false;

  // Extra Regel (small): "2× small ODER 1× medium" → nicht gemischt.
  if (tier === 'small') {
    if (counts.small > 0 && counts.medium > 0) return false;
  }
  return true;
}

function assertCityProductionCapOrThrow(
  tier: CityPropertyTier,
  counts: CityProductionCounts
): void {
  if (!isCityProductionComboAllowed(tier, counts)) {
    throw new GameRuleError(
      'RULE',
      'Nicht genug Produktionskapazität (Werkstatt/Lager) im Stadtbesitz.'
    );
  }
}

function domainProductionCaps(tier: DomainTier): {
  small: number;
  medium: number;
  total: number;
} {
  if (tier === 'starter') return { small: 0, medium: 0, total: 0 };
  if (tier === 'small') return { small: 1, medium: 0, total: 1 };
  if (tier === 'medium') return { small: 0, medium: 1, total: 1 };
  return { small: 1, medium: 1, total: 2 };
}

function countDomainProductionByTier(
  holdings: PlayerHoldings,
  domainId: string,
  options: { excludeWorkshopId?: string; excludeStorageId?: string } = {}
): { small: number; medium: number; large: number; total: number } {
  let small = 0;
  let medium = 0;
  let large = 0;
  for (const w of holdings.workshops) {
    if (w.location.kind !== 'domain') continue;
    if (w.location.id !== domainId) continue;
    if (w.id === 'workshop-starter') continue;
    if (options.excludeWorkshopId && w.id === options.excludeWorkshopId)
      continue;
    if (w.tier === 'small') small += 1;
    else if (w.tier === 'medium') medium += 1;
    else large += 1;
  }
  for (const s of holdings.storages) {
    if (s.location.kind !== 'domain') continue;
    if (s.location.id !== domainId) continue;
    if (s.id === 'storage-starter') continue;
    if (options.excludeStorageId && s.id === options.excludeStorageId) continue;
    if (s.tier === 'small') small += 1;
    else if (s.tier === 'medium') medium += 1;
    else large += 1;
  }
  return { small, medium, large, total: small + medium + large };
}

function countFacilitySlotsUsedAtDomain(
  holdings: PlayerHoldings,
  domainId: string
): number {
  const domain = holdings.domains.find((d) => d.id === domainId);
  if (!domain) return 0;
  const projectSlots = holdings.longTermProjects.filter(
    (p) =>
      p.kind === 'facility' &&
      p.location.kind === 'domain' &&
      p.location.id === domainId
  ).length;
  const workshopSlots = holdings.workshops.filter(
    (w) =>
      w.location.kind === 'domain' &&
      w.location.id === domainId &&
      w.id !== 'workshop-starter'
  ).length;
  const storageSlots = holdings.storages.filter(
    (s) =>
      s.location.kind === 'domain' &&
      s.location.id === domainId &&
      s.id !== 'storage-starter'
  ).length;
  const specSlots = domain.specialization?.facilities?.length ?? 0;
  return (
    domain.facilities.length +
    specSlots +
    workshopSlots +
    storageSlots +
    projectSlots
  );
}

function countFacilitySlotsUsedAtCity(
  holdings: PlayerHoldings,
  cityPropertyId: string
): number {
  const city = holdings.cityProperties.find((c) => c.id === cityPropertyId);
  if (!city) return 0;
  const projectSlots = holdings.longTermProjects.filter(
    (p) =>
      p.kind === 'facility' &&
      p.location.kind === 'cityProperty' &&
      p.location.id === cityPropertyId
  ).length;
  const specSlots = city.specialization?.facilities?.length ?? 0;
  // Soll: Werkstätten/Lager im Stadtbesitz (Eigenproduktion) belegen keine Einrichtungsplätze des Stadtbesitzes;
  // sie sind separat über Produktionskapazität (Units) gecapped.
  return city.facilities.length + specSlots + projectSlots;
}

function countCityProductionByTier(
  holdings: PlayerHoldings,
  cityPropertyId: string,
  options: { excludeWorkshopId?: string; excludeStorageId?: string } = {}
): CityProductionCounts {
  let small = 0;
  let medium = 0;
  let large = 0;
  for (const w of holdings.workshops) {
    if (w.location.kind !== 'cityProperty') continue;
    if (w.location.id !== cityPropertyId) continue;
    if (options.excludeWorkshopId && w.id === options.excludeWorkshopId)
      continue;
    if (w.tier === 'small') small += 1;
    else if (w.tier === 'medium') medium += 1;
    else large += 1;
  }
  for (const s of holdings.storages) {
    if (s.location.kind !== 'cityProperty') continue;
    if (s.location.id !== cityPropertyId) continue;
    if (options.excludeStorageId && s.id === options.excludeStorageId) continue;
    if (s.tier === 'small') small += 1;
    else if (s.tier === 'medium') medium += 1;
    else large += 1;
  }
  return { small, medium, large, total: small + medium + large };
}

function actionDcForAcquire(baseDc: number, tier: PostTier): number {
  const mod = tier === 'medium' ? 4 : tier === 'large' ? 8 : 0;
  return baseDc + mod;
}

function marketInstanceStateOrThrow(state: CampaignState, instanceId: string) {
  const inst = state.market.instances.find((i) => i.id === instanceId);
  if (!inst)
    throw new GameRuleError('STATE', `Unbekannter Markt: ${instanceId}`);
  return inst;
}

function tradeMarketInstanceId(
  playerId: PlayerId,
  tradeEnterpriseId: string,
  index: number
): string {
  return `trade-${playerId}-${tradeEnterpriseId}-${index}`;
}

function marketUsedForPlayerOrThrow(
  state: CampaignState,
  playerId: PlayerId,
  marketInstanceId?: string
): { instanceId: string; label: string } {
  const preferred = marketInstanceId ?? 'local';
  const inst =
    state.market.instances.find((i) => i.id === preferred) ??
    state.market.instances[0];
  if (!inst) throw new Error('No market instance');
  if (inst.ownerPlayerId && inst.ownerPlayerId !== playerId) {
    throw new GameRuleError(
      'AUTH',
      'Dieser Markt gehört einem anderen Spieler.'
    );
  }
  return { instanceId: inst.id, label: inst.label };
}

function tradeEnterpriseIdFromMarketInstanceId(
  playerId: PlayerId,
  marketInstanceId: string
): string | null {
  const prefix = `trade-${playerId}-`;
  if (!marketInstanceId.startsWith(prefix)) return null;
  const rest = marketInstanceId.slice(prefix.length);
  const idx = rest.lastIndexOf('-');
  if (idx <= 0) return null;
  return rest.slice(0, idx);
}

function cargoIncidentForTradeMarket(options: {
  state: CampaignState;
  playerId: PlayerId;
  player: PlayerState;
  marketInstanceId: string;
  investments: number;
  grossGold: number;
  rng: Rng;
}): NonNullable<
  Extract<GameEvent, { type: 'PlayerMoneySold' }>['cargoIncident']
> | null {
  const tradeEnterpriseId = tradeEnterpriseIdFromMarketInstanceId(
    options.playerId,
    options.marketInstanceId
  );
  if (!tradeEnterpriseId) return null;

  const active = options.state.globalEvents.filter(
    (e) =>
      options.state.round >= e.startsAtRound &&
      options.state.round <= e.endsAtRound
  );

  const stormActive = active.some((e) => e.tableRollTotal === 15);
  const piratesActive = active.some(
    (e) =>
      e.tableRollTotal === 16 && (e.meta as any)?.raidersOrPirates === 'pirates'
  );
  const conflictActive = active.some((e) => e.tableRollTotal === 26);

  let kind: 'storm' | 'pirates' | 'conflict' | null = null;
  let triggerThresholdD20 = 0;
  let lossGoldPerInvestment = 0;
  let defenseDc: number | null = null;

  // Priorität: Piraten > Konflikt > Sturm (kein doppeltes Bestrafen im selben Verkauf).
  if (piratesActive) {
    kind = 'pirates';
    triggerThresholdD20 = 4;
    lossGoldPerInvestment = 3;
  } else if (conflictActive) {
    kind = 'conflict';
    triggerThresholdD20 = 5;
    lossGoldPerInvestment = 2;
    defenseDc = 15 + 2;
  } else if (stormActive) {
    kind = 'storm';
    triggerThresholdD20 = 3;
    lossGoldPerInvestment = 2;
  } else {
    return null;
  }

  const triggerRoll = rollD20(options.rng);
  if (triggerRoll.total > triggerThresholdD20) return null;

  const incident: NonNullable<
    Extract<GameEvent, { type: 'PlayerMoneySold' }>['cargoIncident']
  > = {
    kind,
    tradeEnterpriseId,
    triggerRoll,
    lossGold: 0,
  };

  if (defenseDc != null) {
    const rollModifier = defenseRollModifier(options.player);
    const roll = rollD20(options.rng);
    const rollTotal = roll.total + rollModifier;
    const defended = rollTotal >= defenseDc;
    incident.defense = {
      dc: defenseDc,
      roll,
      rollModifier,
      rollTotal,
      defended,
    };
    if (defended) return incident;
  }

  const wantLoss = options.investments * lossGoldPerInvestment;
  incident.lossGold = Math.max(
    0,
    Math.min(Math.trunc(options.grossGold), wantLoss)
  );
  return incident;
}

function marketModifierPerInvestment(
  state: CampaignState,
  marketInstanceId: string,
  materialId: string
): number {
  const material = getMaterialOrThrow(materialId);
  const inst = marketInstanceStateOrThrow(state, marketInstanceId);
  const mods =
    material.kind === 'raw'
      ? inst.raw.modifiersByGroup
      : inst.special.modifiersByGroup;
  return Math.trunc(mods[material.marketGroup] ?? 0);
}

export function decide(
  state: CampaignState | null,
  command: GameCommand,
  ctx: EngineContext
): GameEvent[] {
  switch (command.type) {
    case 'CreateCampaign': {
      if (state)
        throw new GameRuleError('STATE', 'Kampagne existiert bereits.');
      if (ctx.actor.role !== 'gm')
        throw new GameRuleError('AUTH', 'Nur GM kann Kampagnen erstellen.');
      const campaignId = asCampaignId(command.campaignId);
      return [
        {
          type: 'CampaignCreated',
          visibility: { scope: 'public' },
          campaignId,
          name: command.name,
          gmUserId: asUserId(ctx.actor.userId),
          rulesVersion: RULES_VERSION,
          rules: DEFAULT_CAMPAIGN_RULES,
          round: 1,
          phase: 'maintenance',
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `Kampagne "${command.name}" wurde erstellt.`,
        },
      ];
    }

    case 'JoinCampaign': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'maintenance');

      const userId = asUserId(ctx.actor.userId);
      if (state.playerIdByUserId[userId]) {
        throw new GameRuleError('STATE', 'Du bist bereits beigetreten.');
      }

      const playerId = asPlayerId(command.playerId);
      const checks = normalizeChecks({
        ...startingPlayerChecks(),
        ...command.checks,
      });
      const holdings = startingPlayerHoldings();
      const economy = startingPlayerEconomy();
      const turn = startingPlayerTurn(holdings, state.rules);

      return [
        {
          type: 'PlayerJoined',
          visibility: { scope: 'public' },
          playerId,
          userId,
          displayName: command.displayName,
        },
        {
          type: 'PlayerInitialized',
          visibility: { scope: 'private', playerId },
          playerId,
          checks,
          holdings,
          economy,
          turn,
        },
        {
          type: 'PublicLogEntryAdded',
          visibility: { scope: 'public' },
          message: `${command.displayName} ist der Kampagne beigetreten.`,
          playerId,
        },
      ];
    }

    case 'AdvancePhase': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertGm(state, ctx.actor);

      const from = state.phase;
      const to = nextPhase(from);
      const nextRound = roundAfterPhaseAdvance(state.round, from, to);
      const events: GameEvent[] = [];
      let workingState = state;

      const push = (event: GameEvent) => {
        events.push(event);
        workingState = applyEvent(workingState, event);
      };

      if (from === 'maintenance' && to === 'actions') {
        const eventSectionStart = isSectionStartRound(state.round);
        const marketSectionStart = isMarketSectionStartRound(state.round);

        if (marketSectionStart) {
          // Marktphase (Soll): Marktlage gilt für 4 Runden; Roll nur am Abschnittsstart.
          const marketInstances: Array<{
            id: string;
            label: string;
            ownerPlayerId?: string;
          }> = [{ id: 'local', label: 'Lokaler Markt' }];
          const playersSorted = (
            Object.values(workingState.players) as PlayerState[]
          )
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id));
          for (const p of playersSorted) {
            const enterprises = [...p.holdings.tradeEnterprises]
              .filter((t) => !t.damage)
              .sort((a, b) => a.id.localeCompare(b.id));
            for (const te of enterprises) {
              const markets = postTierRank(te.tier);
              for (let i = 1; i <= markets; i += 1) {
                marketInstances.push({
                  id: tradeMarketInstanceId(p.id, te.id, i),
                  label: `Handelsmarkt (${p.displayName}) ${te.tier} ${i}/${markets}`,
                  ownerPlayerId: p.id,
                });
              }
            }
          }

          const marketRoll = rollMarketInstances(
            state.round,
            marketInstances,
            ctx.rng
          );
          push({
            type: 'MarketRolled',
            visibility: { scope: 'public' },
            round: state.round,
            instances: marketRoll.instances.map((i) => ({
              id: i.id,
              label: i.label,
              ownerPlayerId: i.ownerPlayerId as any,
              raw: i.raw,
              special: i.special,
            })),
          } as any);
        }

        if (eventSectionStart) {
          const rolled = rollSectionEvents(state.round, ctx.rng);
          push({
            type: 'SectionEventsRolled',
            visibility: { scope: 'public' },
            startsAtRound: rolled.startsAtRound,
            endsAtRound: rolled.endsAtRound,
            events: rolled.events,
          } as any);
        }

        const playerIds = Object.keys(workingState.players) as PlayerId[];
        for (const playerId of playerIds) {
          let player = workingState.players[playerId];

          // Neider-Gegenreaktionen (Soll): werden in der Ereignisphase der nächsten Runde abgewickelt.
          {
            const n = Math.max(0, Math.trunc(player.politics.n));
            const threshold =
              n >= 9
                ? (9 as const)
                : n >= 6
                  ? (6 as const)
                  : n >= 3
                    ? (3 as const)
                    : null;
            if (threshold) {
              const dc = threshold === 3 ? 10 : threshold === 6 ? 12 : 14;
              const roll = rollD20(ctx.rng);
              const rollModifier = defenseRollModifier(player);
              const rollTotal = roll.total + rollModifier;
              const defended = rollTotal >= dc;

              const baseLoss = threshold === 3 ? 4 : threshold === 6 ? 8 : 12;
              const lossKind = player.turn.counterReactionLossChoice;
              if (lossKind !== 'gold' && lossKind !== 'influence') {
                throw new GameRuleError(
                  'INPUT',
                  'Neider-Gegenreaktion: Bitte zuerst SetCounterReactionLossChoice (gold|influence) setzen.'
                );
              }
              const lossAmount = defended
                ? 0
                : lossKind === 'influence'
                  ? Math.max(
                      0,
                      Math.min(
                        baseLoss,
                        Math.trunc(player.turn.influenceAvailable)
                      )
                    )
                  : baseLoss;

              const politicsDelta = {
                kwDelta: 0,
                asDelta: 0,
                nDelta: -threshold,
              };

              const loss = { kind: lossKind, amount: lossAmount };
              if (!defended) {
                if (threshold === 3) {
                  politicsDelta.asDelta -= 1;
                } else if (threshold === 6) {
                  politicsDelta.kwDelta += 2;
                  politicsDelta.asDelta -= 1;
                } else {
                  politicsDelta.kwDelta += 4;
                  politicsDelta.asDelta -= 2;
                }
              }

              push({
                type: 'PlayerCounterReactionResolved',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                threshold,
                defense: { dc, roll, rollModifier, rollTotal, defended },
                loss,
                politicsDelta,
                reason: `Neider-Gegenreaktion (N>=${threshold})`,
              });
              player = workingState.players[playerId];
            }
          }

          // Facility-Nachlauf: Insulaebau siedelt in der nächsten Runde automatisch Pächter an.
          // Soll: +500 Pächter (=2 Stufen) pro Insulae-Bau im städtischen Besitz.
          // Umsetzung v1: wenn Facility in Runde (R-1) gebaut wurde → in Runde R +2 Stufen (gecappt).
          if (state.round >= 2) {
            const changes: Array<{
              location: { kind: 'cityProperty'; id: string };
              levelsDelta: number;
            }> = [];
            for (const city of player.holdings.cityProperties) {
              const newlyBuilt = city.facilities.filter(
                (f) =>
                  f.key === 'general.medium.city.insulae' &&
                  Math.trunc(f.builtAtRound) === state.round - 1
              ).length;
              if (!newlyBuilt) continue;

              const baseCap =
                city.tier === 'small' ? 2 : city.tier === 'medium' ? 3 : 4;
              const totalInsulae = city.facilities.filter(
                (f) => f.key === 'general.medium.city.insulae'
              ).length;
              const cap = baseCap + 2 * totalInsulae;
              const add = Math.max(
                0,
                Math.min(2 * newlyBuilt, cap - city.tenants.levels)
              );
              if (!add) continue;
              changes.push({
                location: { kind: 'cityProperty', id: city.id },
                levelsDelta: add,
              });
            }
            if (changes.length) {
              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes,
                reason: 'Insulaebau: Pächter siedeln sich an',
              });
              player = workingState.players[playerId];
            }
          }

          let eventGoldDelta = 0;
          let eventInfluenceDelta = 0;
          let eventLaborDelta = 0;
          let eventMagicPowerDelta = 0;
          const eventSpecialDelta: MaterialStock = {};

          // Einmalige Abschnittseffekte (werden beim Start des Abschnitts angewandt, nicht jede Runde kumulativ).
          if (eventSectionStart) {
            const startEvents = workingState.globalEvents.filter(
              (e) => state.round === e.startsAtRound
            );
            const has11 = startEvents.some((e) => e.tableRollTotal === 11); // Gute Ernte: Pächter-LO +1
            const has24 = startEvents.some((e) => e.tableRollTotal === 24); // Religiöse Feiertage: LO +1
            const has28 = startEvents.some((e) => e.tableRollTotal === 28); // Unheilvolle Konstellationen: Kult +1, sonst -1
            const has40 = startEvents.some((e) => e.tableRollTotal === 40); // Sehr gutes Jahr: Domänen-Pächter +1 Stufe, LO +2
            const has5 = startEvents.some((e) => e.tableRollTotal === 5); // Aufstand: Loyalitätsprobe (Klienten/Anhänger)
            const event34 = startEvents.find((e) => e.tableRollTotal === 34); // Erbe der Achäer (Ruinenfunde)

            if (has11 || has24 || has28 || has40) {
              const changes: Array<{
                location: {
                  kind: 'domain' | 'cityProperty' | 'organization';
                  id: string;
                };
                levelsDelta?: number;
                loyaltyDelta?: number;
              }> = [];

              for (const d of player.holdings.domains) {
                if (d.tier === 'starter' && has40) continue;
                const cap =
                  d.tier === 'small'
                    ? 2
                    : d.tier === 'medium'
                      ? 4
                      : d.tier === 'large'
                        ? 8
                        : 0;
                const addLevel =
                  has40 && cap > 0 && d.tenants.levels < cap ? 1 : 0;

                const hasGroup = d.tenants.levels > 0 || addLevel > 0;
                const loyaltyDelta = hasGroup
                  ? (has11 ? 1 : 0) +
                    (has24 ? 1 : 0) +
                    (has40 ? 2 : 0) +
                    (has28 ? -1 : 0)
                  : 0;

                if (addLevel || loyaltyDelta) {
                  changes.push({
                    location: { kind: 'domain', id: d.id },
                    levelsDelta: addLevel || undefined,
                    loyaltyDelta: loyaltyDelta || undefined,
                  });
                }
              }

              for (const c of player.holdings.cityProperties) {
                if (c.tenants.levels <= 0) continue;
                const loyaltyDelta =
                  (has11 ? 1 : 0) +
                  (has24 ? 1 : 0) +
                  (has40 ? 2 : 0) +
                  (has28 ? -1 : 0);
                if (loyaltyDelta) {
                  changes.push({
                    location: { kind: 'cityProperty', id: c.id },
                    loyaltyDelta,
                  });
                }
              }

              for (const o of player.holdings.organizations) {
                if (o.followers.levels <= 0) continue;
                const loyaltyDelta =
                  (has11 ? 1 : 0) +
                  (has24 ? 1 : 0) +
                  (has40 ? 2 : 0) +
                  (has28 ? (o.kind === 'cult' ? 1 : -1) : 0);
                if (loyaltyDelta) {
                  changes.push({
                    location: { kind: 'organization', id: o.id },
                    loyaltyDelta,
                  });
                }
              }

              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason: `Abschnittseffekte (Ereignisse: ${startEvents.map((e) => e.tableRollTotal).join(', ')})`,
                });
                player = workingState.players[playerId];
              }
            }

            // Event 5: Aufstand in Nachbarprovinz – Loyalitätsprobe für städtische Klienten/Anhänger (einmalig beim Start).
            if (has5) {
              const changes: Array<{
                location: {
                  kind: 'domain' | 'cityProperty' | 'organization';
                  id: string;
                };
                loyaltyDelta?: number;
              }> = [];
              for (const c of player.holdings.cityProperties) {
                if (c.tenants.levels <= 0) continue;
                const roll = rollDice('1d6', ctx.rng);
                const passed =
                  roll.total <= Math.max(0, Math.min(6, c.tenants.loyalty));
                if (!passed)
                  changes.push({
                    location: { kind: 'cityProperty', id: c.id },
                    loyaltyDelta: -1,
                  });
              }
              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason:
                    'Aufstand in Nachbarprovinz: Loyalitätsprobe misslungen',
                });
                player = workingState.players[playerId];
              }
            }

            // Event 34: Erbe der Achäer – Aufruhr auf dem Land (einmalig beim Start): LO-Probe oder Aufruhr der Pächter.
            if (event34) {
              const changes: Array<{
                location: {
                  kind: 'domain' | 'cityProperty' | 'organization';
                  id: string;
                };
                loyaltyDelta?: number;
              }> = [];
              for (const d of player.holdings.domains) {
                if (d.tenants.levels <= 0) continue;
                const roll = rollDice('1d6', ctx.rng);
                const passed =
                  roll.total <= Math.max(0, Math.min(6, d.tenants.loyalty));
                if (!passed)
                  changes.push({
                    location: { kind: 'domain', id: d.id },
                    loyaltyDelta: -2,
                  });
              }
              if (changes.length) {
                push({
                  type: 'PlayerFollowersAdjusted',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  changes,
                  reason:
                    'Erbe der Achäer: Aufruhr auf dem Land (Loyalitätsprobe misslungen)',
                });
                player = workingState.players[playerId];
              }

              // Magische Sondermaterialien (bei 1-10; Abschnitts-Roll ist im Event-Meta gespeichert).
              if ((event34.meta as any)?.achaerMagicSpecialTriggered === true) {
                eventSpecialDelta['special.highMagicOres'] =
                  (eventSpecialDelta['special.highMagicOres'] ?? 0) + 4;
              }
            }

          }

          // Abwanderung (Soll): Nur bei LO = 0 wandert pro Runde 1 Stufe ab.
          {
            const changes: Array<{
              location: {
                kind: 'domain' | 'cityProperty' | 'organization';
                id: string;
              };
              levelsDelta?: number;
            }> = [];

            for (const d of player.holdings.domains) {
              if (d.tenants.levels > 0 && d.tenants.loyalty <= 0) {
                changes.push({
                  location: { kind: 'domain', id: d.id },
                  levelsDelta: -1,
                });
              }
            }
            for (const c of player.holdings.cityProperties) {
              if (c.tenants.levels > 0 && c.tenants.loyalty <= 0) {
                changes.push({
                  location: { kind: 'cityProperty', id: c.id },
                  levelsDelta: -1,
                });
              }
            }
            for (const o of player.holdings.organizations) {
              if (o.followers.levels > 0 && o.followers.loyalty <= 0) {
                changes.push({
                  location: { kind: 'organization', id: o.id },
                  levelsDelta: -1,
                });
              }
            }

            if (changes.length) {
              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes,
                reason: 'Abwanderung wegen niedriger Loyalität',
              });
              player = workingState.players[playerId];
            }
          }

          // Apply pending (gold/materials/magic power)
          const pending = player.economy.pending;
          const pendingGold = pending.gold;
          const pendingLabor = pending.labor;
          const pendingRaw = pending.raw;
          const pendingSpecial = pending.special;
          const pendingMagic = pending.magicPower;
          if (
            pendingGold ||
            pendingLabor ||
            Object.keys(pendingRaw).length ||
            Object.keys(pendingSpecial).length ||
            pendingMagic
          ) {
            push({
              type: 'PlayerPendingApplied',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              goldApplied: pendingGold,
              laborApplied: pendingLabor,
              rawApplied: pendingRaw,
              specialApplied: pendingSpecial,
              magicPowerApplied: pendingMagic,
            });
            player = workingState.players[playerId];
          }

          // Ereignis-Nebeneffekte: Zufalls-Schäden an Einrichtungen (vereinfachte Abbildung).
          const activeEventsNow = workingState.globalEvents.filter(
            (e) =>
              state.round >= e.startsAtRound && state.round <= e.endsAtRound
          );

          const sectionStartsAtRound =
            activeEventsNow[0]?.startsAtRound ?? state.round;

          const incidentCountFor = (
            tableRollTotal: number,
            incidentKind: string
          ): number => {
            const s = player.eventIncidents;
            if (!s) return 0;
            if (s.sectionStartsAtRound !== sectionStartsAtRound) return 0;
            const kind = String(incidentKind).trim() || 'unknown';
            const key = `${tableRollTotal}:${kind}`;
            return Math.max(
              0,
              Math.trunc(s.countsByKey[key] ?? 0)
            );
          };

          const recordIncident = (
            tableRollTotal: number,
            incidentKind: string,
            reason: string
          ) => {
            push({
              type: 'PlayerEventIncidentRecorded',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              sectionStartsAtRound,
              tableRollTotal,
              incidentKind,
              countDelta: 1,
              reason,
            });
            player = workingState.players[playerId];
          };

          // Event 6: Kultüberprüfung (4 Runden) – pro Runde pro Kult: Trigger 1-5 auf w20,
          // dann Verbergen-Check (DC 14) oder Verlust 1d6 Einfluss + 1 Anhängerstufe.
          if (activeEventsNow.some((e) => e.tableRollTotal === 6)) {
            const cults = player.holdings.organizations.filter(
              (o) => o.kind === 'cult'
            );
            for (const cult of cults) {
              if (cult.followers.inUnrest) continue;
              if (cult.followers.levels <= 0) continue;

              const trigger = rollD20(ctx.rng);
              if (trigger.total > 5) continue;

              const hide = rollD20(ctx.rng);
              const total =
                hide.total +
                effectiveCheck(player.checks.influence, state.round);
              if (total >= 14) continue;

              const loss = rollDice('1d6', ctx.rng);
              eventInfluenceDelta -= loss.total;

              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes: [
                  {
                    location: { kind: 'organization', id: cult.id },
                    levelsDelta: -1,
                  },
                ],
                reason:
                  'Kultüberprüfung: Verbergen misslungen (Anhänger verloren)',
              });
              player = workingState.players[playerId];
            }
          }

          // Event 12: Säuberung des Hofes – Chance, Hof-/Ehrenämter zu verlieren (max 2 pro Abschnitt).
          if (
            activeEventsNow.some((e) => e.tableRollTotal === 12) &&
            incidentCountFor(12, 'officeLoss') < 2
          ) {
            const roll = rollD20(ctx.rng);
            if (roll.total <= 4) {
              const courtOffices = player.holdings.offices
                .filter((o) => o.specialization?.kind === 'courtOffice')
                .slice()
                .sort((a, b) => {
                  const tier =
                    postTierRank(a.tier) - postTierRank(b.tier);
                  if (tier) return tier;
                  return a.id.localeCompare(b.id);
                });
              const lost = courtOffices[0];
              if (lost) {
                recordIncident(
                  12,
                  'officeLoss',
                  'Säuberung des Hofes: Amt verloren'
                );
                push({
                  type: 'PlayerOfficeLost',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  officeId: lost.id,
                  reason: 'Säuberung des Hofes: Amt verloren',
                });
                if (canEmitPublicLogs(ctx)) {
                  push({
                    type: 'PublicLogEntryAdded',
                    visibility: { scope: 'public' },
                    message: `${player.displayName}: Säuberung des Hofes – Amt (${lost.id}) verloren (w20=${roll.total}).`,
                  });
                }
                player = workingState.players[playerId];
              }
            }
          }

          // Event 20: Alchemistischer Unfall – Beschädigung im städtischen Besitz (max 1 pro Abschnitt).
          if (
            activeEventsNow.some((e) => e.tableRollTotal === 20) &&
            incidentCountFor(20, 'damage') < 1
          ) {
            const roll = rollD20(ctx.rng);
            if (roll.total <= 5) {
              const targets: Array<
                | { kind: 'workshop'; id: string }
                | { kind: 'storage'; id: string }
                | { kind: 'cityTenants'; id: string }
                | {
                    kind: 'facility';
                    location: { kind: 'cityProperty'; id: string };
                    id: string;
                  }
              > = [];

              for (const c of player.holdings.cityProperties) {
                if (c.tenants.levels > 0)
                  targets.push({ kind: 'cityTenants', id: c.id });
                for (const f of c.facilities)
                  if (!f.damage)
                    targets.push({
                      kind: 'facility',
                      location: { kind: 'cityProperty', id: c.id },
                      id: f.id,
                    });
              }
              for (const w of player.holdings.workshops) {
                if (w.location.kind === 'cityProperty' && !w.damage)
                  targets.push({ kind: 'workshop', id: w.id });
              }
              for (const s of player.holdings.storages) {
                if (s.location.kind === 'cityProperty' && !s.damage)
                  targets.push({ kind: 'storage', id: s.id });
              }

              if (targets.length) {
                recordIncident(20, 'damage', 'Alchemistischer Unfall');
                const pick =
                  targets[ctx.rng.nextIntInclusive(0, targets.length - 1)];
                const repair = rollDice('1d6', ctx.rng);

                if (pick.kind === 'workshop') {
                  push({
                    type: 'PlayerWorkshopDamaged',
                    visibility: { scope: 'private', playerId: player.id },
                    playerId: player.id,
                    workshopId: pick.id,
                    repairCostGold: repair.total,
                    reason: 'Alchemistischer Unfall',
                  });
                  player = workingState.players[playerId];
                } else if (pick.kind === 'storage') {
                  push({
                    type: 'PlayerStorageDamaged',
                    visibility: { scope: 'private', playerId: player.id },
                    playerId: player.id,
                    storageId: pick.id,
                    repairCostGold: repair.total,
                    reason: 'Alchemistischer Unfall',
                  });
                  player = workingState.players[playerId];
                } else if (pick.kind === 'cityTenants') {
                  push({
                    type: 'PlayerFollowersAdjusted',
                    visibility: { scope: 'private', playerId: player.id },
                    playerId: player.id,
                    changes: [
                      {
                        location: { kind: 'cityProperty', id: pick.id },
                        levelsDelta: -1,
                      },
                    ],
                    reason: 'Alchemistischer Unfall: Anhängerstufe beschädigt',
                  });
                  player = workingState.players[playerId];
                } else {
                  push({
                    type: 'PlayerFacilityDamaged',
                    visibility: { scope: 'private', playerId: player.id },
                    playerId: player.id,
                    location: pick.location,
                    facilityInstanceId: pick.id,
                    repairCostGold: repair.total,
                    reason: 'Alchemistischer Unfall',
                  });
                  player = workingState.players[playerId];
                }
              }
            }
          }

          const damageRandomTarget = (
            reason: string,
            repairCostGold: number
          ): boolean => {
            const targets: Array<
              | { kind: 'workshop'; id: string }
              | { kind: 'storage'; id: string }
              | {
                  kind: 'facility';
                  location:
                    | { kind: 'domain'; id: string }
                    | { kind: 'cityProperty'; id: string }
                    | { kind: 'organization'; id: string }
                    | { kind: 'office'; id: string }
                    | { kind: 'tradeEnterprise'; id: string }
                    | { kind: 'workshop'; id: string }
                    | { kind: 'troops' };
                  id: string;
                }
            > = [];

            for (const w of player.holdings.workshops) {
              if (!w.damage) targets.push({ kind: 'workshop', id: w.id });
            }
            for (const s of player.holdings.storages) {
              if (!s.damage) targets.push({ kind: 'storage', id: s.id });
            }
            for (const d of player.holdings.domains) {
              for (const f of d.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'domain', id: d.id },
                    id: f.id,
                  });
            }
            for (const c of player.holdings.cityProperties) {
              for (const f of c.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'cityProperty', id: c.id },
                    id: f.id,
                  });
            }
            for (const o of player.holdings.organizations) {
              for (const f of o.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'organization', id: o.id },
                    id: f.id,
                  });
            }
            for (const o of player.holdings.offices) {
              for (const f of o.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'office', id: o.id },
                    id: f.id,
                  });
            }
            for (const t of player.holdings.tradeEnterprises) {
              for (const f of t.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'tradeEnterprise', id: t.id },
                    id: f.id,
                  });
            }
            for (const w of player.holdings.workshops) {
              for (const f of w.facilities)
                if (!f.damage)
                  targets.push({
                    kind: 'facility',
                    location: { kind: 'workshop', id: w.id },
                    id: f.id,
                  });
            }
            for (const f of player.holdings.troops.facilities)
              if (!f.damage)
                targets.push({
                  kind: 'facility',
                  location: { kind: 'troops' },
                  id: f.id,
                });

            if (!targets.length) return false;
            const pick =
              targets[ctx.rng.nextIntInclusive(0, targets.length - 1)];

            if (pick.kind === 'workshop') {
              push({
                type: 'PlayerWorkshopDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                workshopId: pick.id,
                repairCostGold,
                reason,
              });
            } else if (pick.kind === 'storage') {
              push({
                type: 'PlayerStorageDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                storageId: pick.id,
                repairCostGold,
                reason,
              });
            } else {
              push({
                type: 'PlayerFacilityDamaged',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                location: pick.location,
                facilityInstanceId: pick.id,
                repairCostGold,
                reason,
              });
            }

            player = workingState.players[playerId];
            return true;
          };

          const maybeDamage = (opts: {
            tableRollTotal: number;
            thresholdD20: number;
            costDice: string;
            reason: string;
            onlyStartRound?: boolean;
            maxPerSection?: number;
          }) => {
            const activeEvent = activeEventsNow.find(
              (e) =>
                e.tableRollTotal === opts.tableRollTotal &&
                (!opts.onlyStartRound || state.round === e.startsAtRound)
            );
            if (!activeEvent) return;
            if (
              typeof opts.maxPerSection === 'number' &&
              incidentCountFor(opts.tableRollTotal, 'damage') >=
                opts.maxPerSection
            )
              return;
            const roll = rollDice('1d20', ctx.rng);
            if (roll.total > opts.thresholdD20) return;
            const repair = rollDice(opts.costDice, ctx.rng);
            const did = damageRandomTarget(opts.reason, repair.total);
            if (!did) return;
            if (typeof opts.maxPerSection === 'number') {
              recordIncident(opts.tableRollTotal, 'damage', `${opts.reason}: Schaden`);
            }
          };

          maybeDamage({
            tableRollTotal: 8,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Dürresommer: Brandgefahr',
            onlyStartRound: true,
          });
          maybeDamage({
            tableRollTotal: 14,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Magischer Unfall',
            maxPerSection: 2,
          });
          maybeDamage({
            tableRollTotal: 15,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Starke Unwetter und Stürme',
          });
          maybeDamage({
            tableRollTotal: 27,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Aufruhr in Denera',
            maxPerSection: 3,
          });
          maybeDamage({
            tableRollTotal: 30,
            thresholdD20: 5,
            costDice: '1d6',
            reason: 'Große Feuersbrunst in der Stadt',
            maxPerSection: 3,
          });

          // Income + upkeep
          const officeMods = computeOfficeIncomeMods(
            workingState.globalEvents,
            state.round
          );
          const perRoundTaxGold = taxGoldPerRound(
            workingState.globalEvents,
            state.round
          );

          const cityGold = player.holdings.cityProperties.reduce(
            (sum, c) =>
              c.tenants.inUnrest
                ? sum
                : sum +
                  (c.mode === 'leased'
                    ? c.tier === 'small'
                      ? 2
                      : c.tier === 'medium'
                        ? 5
                        : 12
                    : 0),
            0
          );

          let officeGoldBase = 0;
          let officeTierSumForBonus = 0;
          for (const o of player.holdings.offices) {
            const inc = officesIncomePerRound(
              o.tier,
              o.yieldMode,
              state.rules
            ).gold;
            officeGoldBase += inc;
            if (inc > 0) officeTierSumForBonus += postTierRank(o.tier);
          }
          const officesGold =
            Math.floor(officeGoldBase * officeMods.goldMultiplier) +
            officeMods.goldBonusPerTier * officeTierSumForBonus;

          const tenantsGold =
            player.holdings.domains.reduce(
              (sum, d) => (d.tenants.inUnrest ? sum : sum + d.tenants.levels),
              0
            ) +
            player.holdings.cityProperties.reduce(
              (sum, c) => (c.tenants.inUnrest ? sum : sum + c.tenants.levels),
              0
            ) +
            player.holdings.organizations.reduce(
              (sum, o) =>
                o.followers.inUnrest ? sum : sum + o.followers.levels,
              0
            );

          let producedGold = cityGold + officesGold + tenantsGold;
          producedGold += specialistGoldIncomeBonusPerRound(player);
          const producedSpecial: MaterialStock = {};

          // Unterweltcircel: Gold-Ertrag skaliert mit Circelstufe und Stadtbesitz-Stufe (vereinfachte Wahl: größter Stadtbesitz als HQ).
          const maxCityTier = Math.max(
            0,
            ...player.holdings.cityProperties.map((c) => postTierRank(c.tier))
          );
          for (const org of player.holdings.organizations) {
            if (org.kind !== 'underworld') continue;
            if (org.followers.inUnrest) continue;
            if (maxCityTier <= 0) continue;
            const rank = postTierRank(org.tier);
            const goldPer = rank === 1 ? 4 : rank === 2 ? 5 : 6;
            producedGold += goldPer * rank * maxCityTier;
          }

          const activeEvents = workingState.globalEvents.filter(
            (e) =>
              state.round >= e.startsAtRound && state.round <= e.endsAtRound
          );

          // Ereignis-Nebeneffekte (temporäre Modifikatoren auf Einfluss/AK/Gold/Magie)
          const deneraRiotActive = activeEvents.some(
            (e) => e.tableRollTotal === 27
          );

          // Turn-Pools an geänderte Holdings angleichen (z.B. Abschnitts-Starteffekte, Abwanderung, Ereignisse).
          // v1: wir modellieren Arbeitskraft/Einfluss als pro Runde verfügbare Pools; wenn Holdings vor der Aktionsphase
          // geändert werden, müssen diese Pools für die aktuelle Runde angepasst werden.
          eventLaborDelta +=
            baseLaborTotal(player.holdings) - player.turn.laborAvailable;
          eventInfluenceDelta +=
            baseInfluencePerRound(player.holdings) -
            player.turn.influenceAvailable;

          // Event 18: Korruptionsuntersuchung
          if (activeEvents.some((e) => e.tableRollTotal === 18)) {
            // Alle Ämter: Halbierter Einfluss (4 Runden) → wir reduzieren den bereits (im Reset) gewährten Einfluss um 50%.
            const officesInfluence = player.holdings.offices.reduce(
              (sum, o) =>
                sum +
                officesIncomePerRound(o.tier, o.yieldMode, state.rules)
                  .influence,
              0
            );
            eventInfluenceDelta -= Math.floor(officesInfluence / 2);

            // Unterweltcircel/Spionageringe/Kulte: +2 Einfluss pro Stufe (4 Runden)
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (
                o.kind !== 'underworld' &&
                o.kind !== 'spy' &&
                o.kind !== 'cult'
              )
                continue;
              eventInfluenceDelta += 2 * postTierRank(o.tier);
            }
          }

          // Event 27 / Aufruhr in Denera: Handwerkscollegien verlieren 1 AK pro Stufe (4 Runden).
          if (deneraRiotActive) {
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind !== 'collegiumCraft') continue;
              eventLaborDelta -= postTierRank(o.tier);
            }
          }

          // Event 32: Landflucht – 1 Runde
          const landfluchtThisRound = activeEvents.some(
            (e) => e.tableRollTotal === 32 && state.round === e.startsAtRound
          );
          if (landfluchtThisRound) {
            const tenantLevelsOnDomains = player.holdings.domains.reduce(
              (sum, d) => (d.tenants.inUnrest ? sum : sum + d.tenants.levels),
              0
            );
            eventLaborDelta -= tenantLevelsOnDomains;

            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind === 'underworld' || o.kind === 'collegiumCraft') {
                eventLaborDelta += postTierRank(o.tier);
              }
            }
          }

          // Event 34: Erbe der Achäer – Magischer Einfluss (bei 1-10: -1 AK per 2 Pächtestufen)
          const e34Active = activeEvents.find((e) => e.tableRollTotal === 34);
          if ((e34Active?.meta as any)?.achaerMagicLaborTriggered === true) {
            const followerLevels =
              player.holdings.domains.reduce(
                (sum, d) => sum + d.tenants.levels,
                0
              ) +
              player.holdings.cityProperties.reduce(
                (sum, c) => sum + c.tenants.levels,
                0
              ) +
              player.holdings.organizations.reduce(
                (sum, o) => sum + o.followers.levels,
                0
              );
            eventLaborDelta -= Math.floor(followerLevels / 2);
          }
          if (e34Active) {
            // Cammern oder Kulte: +1 Zauberkraft per Stufe (4 Runden) → v1: nur Kult modelliert.
            for (const o of player.holdings.organizations) {
              if (o.followers.inUnrest) continue;
              if (o.kind !== 'cult') continue;
              eventMagicPowerDelta += postTierRank(o.tier);
            }
          }

          // Event 6: Kultüberprüfung – Kirchenaufsichts-Ämter erhalten +6 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 6)) {
            const hasChurchOversightOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'churchOversight'
            );
            if (hasChurchOversightOffice) eventInfluenceDelta += 6;
          }

          // Event 9: Große Bautätigkeit – Curia-Ämter erhalten +2 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 9)) {
            const hasCityAdminOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'cityAdministration'
            );
            if (hasCityAdminOffice) eventInfluenceDelta += 2;
          }

          // Event 12: Säuberung des Hofes – Hof- und Ehrenämter +6 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 12)) {
            const hasCourtOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'courtOffice'
            );
            if (hasCourtOffice) eventInfluenceDelta += 6;
          }

          // Event 22: Offener Konflikt – Ehren-/Hofämter +4 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 22)) {
            const hasCourtOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'courtOffice'
            );
            if (hasCourtOffice) eventInfluenceDelta += 4;
          }

          // Event 24: Opulente Religiöse Feiertage – Kulte erhalten +6 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 24)) {
            const hasCult = player.holdings.organizations.some(
              (o) => o.kind === 'cult' && !o.followers.inUnrest
            );
            if (hasCult) eventInfluenceDelta += 6;

            const hasChurchOversightOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'churchOversight'
            );
            if (hasChurchOversightOffice) eventInfluenceDelta += 6;
          }

          // Event 26: Konflikt mit Nachbarn – Spionageringe +4 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 26)) {
            const hasSpy = player.holdings.organizations.some(
              (o) => o.kind === 'spy' && !o.followers.inUnrest
            );
            if (hasSpy) eventInfluenceDelta += 4;

            const hasMilitaryOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'militaryOffice'
            );
            if (hasMilitaryOffice) eventInfluenceDelta += 4;
          }

          // Event 35: Hedonistische Hysterie – Kulte +6 Einfluss pro Runde (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 35)) {
            const hasCult = player.holdings.organizations.some(
              (o) => o.kind === 'cult' && !o.followers.inUnrest
            );
            if (hasCult) eventInfluenceDelta += 6;
          }

          // Event 37: Entlassene Söldnertruppe plündert – Söldnertruppen +6 Einfluss (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 37)) {
            if (player.holdings.troops.mercenaryLevels > 0)
              eventInfluenceDelta += 6;

            const hasMilitaryOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'militaryOffice'
            );
            if (hasMilitaryOffice) eventInfluenceDelta += 6;
          }

          // Event 25: Kriegszug und Musterung – Militärämter +4 Einfluss.
          if (activeEvents.some((e) => e.tableRollTotal === 25)) {
            const hasMilitaryOffice = player.holdings.offices.some(
              (o) => o.specialization?.kind === 'militaryOffice'
            );
            if (hasMilitaryOffice) eventInfluenceDelta += 4;
          }

          // Event 38: Großes Wunder in Provinz – Bei Trigger: +6 Einfluss und +6 Gold per Kult-Stufe (4 Runden).
          const e38Active = activeEvents.find((e) => e.tableRollTotal === 38);
          if ((e38Active?.meta as any)?.greatWonderCultTriggered === true) {
            const cult = player.holdings.organizations.find(
              (o) => o.kind === 'cult' && !o.followers.inUnrest
            );
            if (cult) {
              const tierRank = postTierRank(cult.tier);
              eventInfluenceDelta += 6 * tierRank;
              eventGoldDelta += 6 * tierRank;
            }
          }

          // Event 39: Provinzinspektion – Politische Abwehrprobe (DC 15) oder -2d6 Einfluss pro Amts-Stufe pro Runde (4 Runden).
          if (
            activeEvents.some((e) => e.tableRollTotal === 39) &&
            player.holdings.offices.length > 0
          ) {
            const defenseRoll = rollD20(ctx.rng);
            const defenseMod = effectiveCheck(player.checks.influence, state.round);
            const defenseTotal = defenseRoll.total + defenseMod;
            const defended = defenseTotal >= 15;
            if (!defended) {
              const tierSum = player.holdings.offices.reduce(
                (sum, o) => sum + postTierRank(o.tier),
                0
              );
              const loss = rollDice('2d6', ctx.rng);
              const influenceLoss = loss.total * tierSum;
              eventInfluenceDelta -= influenceLoss;
              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Provinzinspektion – Abwehr ${defenseRoll.total}+${defenseMod}=${defenseTotal} < DC 15 → -${influenceLoss} Einfluss (${loss.expression}=${loss.total} × Amtsstufen=${tierSum}).`,
                });
              }
            }
          }

          producedGold += eventGoldDelta;

          const droughtOneRound = activeEvents.some(
            (e) => e.tableRollTotal === 8 && state.round === e.startsAtRound
          );
          const goodHarvestActive = activeEvents.some(
            (e) => e.tableRollTotal === 11
          );
          const veryGoodYearActive = activeEvents.some(
            (e) => e.tableRollTotal === 40
          );
          const veryGoodYearBurst = activeEvents.some(
            (e) => e.tableRollTotal === 40 && state.round === e.startsAtRound
          );
          const magicalBeastsActive = activeEvents.some(
            (e) => e.tableRollTotal === 29
          );
          const defenseDcBonus = activeEvents.some(
            (e) => e.tableRollTotal === 26
          )
            ? 2
            : 0;
          const defenseMod = defenseRollModifier(player);

          const producedRaw: MaterialStock = {};
          for (const domain of player.holdings.domains) {
            if (domain.tenants.inUnrest) continue;
            const baseCount = domainRawPerRound(domain.tier);
            const spec = domain.specialization?.kind;
            let count = baseCount;

            // Event 8: Dürresommer – Landwirtschaft/Tierzucht halbiert (1 Runde)
            if (
              droughtOneRound &&
              (spec === 'agriculture' || spec === 'animalHusbandry')
            ) {
              count = Math.floor(count / 2);
            }

            // Event 40: Sehr gutes Jahr – Landwirtschaft/Tierzucht/Forstwirtschaft +50% (1 Runde)
            if (
              veryGoodYearBurst &&
              (spec === 'agriculture' ||
                spec === 'animalHusbandry' ||
                spec === 'forestry')
            ) {
              count = Math.floor(count + count / 2);
            }

            // Event 29: Ausbruch Magischer Bestien – Verteidigungsprobe oder -4 RM Ertrag (4 Runden).
            if (magicalBeastsActive) {
              const defenseDc = 15 + defenseDcBonus;
              const roll = rollD20(ctx.rng);
              const total = roll.total + defenseMod;
              if (total < defenseDc) {
                count = Math.max(0, count - 4);
                if (canEmitPublicLogs(ctx)) {
                  push({
                    type: 'PublicLogEntryAdded',
                    visibility: { scope: 'public' },
                    message: `${player.displayName}: Magische Bestien beeinträchtigen Domäne (${domain.id}) – Verteidigung ${roll.total}+${defenseMod}=${total} < DC ${defenseDc} → -4 RM Ertrag.`,
                  });
                }
              }
            }

            if (count > 0) {
              const picks = safeDomainRawPicks(domain);
              const distributed = distributeRawAcrossPicks(count, picks);
              for (const [materialId, amount] of Object.entries(distributed)) {
                producedRaw[materialId] =
                  (producedRaw[materialId] ?? 0) + amount;
              }
            }

            // Event 11/40: Zusätzliche Ernte für Landwirtschaft (vereinfachte Abbildung als Getreide/Gemüse)
            if (spec === 'agriculture' && goodHarvestActive) {
              const primary = domainPrimaryRawPick(domain);
              if (primary)
                producedRaw[primary] = (producedRaw[primary] ?? 0) + 8;
            }
            // Event 40: "+8 RM pro Runde ... (4 Runden)" → nicht in der Burst-Runde.
            if (
              spec === 'agriculture' &&
              veryGoodYearActive &&
              !veryGoodYearBurst
            ) {
              const primary = domainPrimaryRawPick(domain);
              if (primary)
                producedRaw[primary] = (producedRaw[primary] ?? 0) + 8;
            }

            // Pächterstufen (Domäne, Soll): +2 billige RM pro Stufe (aus bereits gewählter Produktion).
            const tenantLevels = Math.max(0, Math.trunc(domain.tenants.levels));
            if (tenantLevels > 0) {
              const picks = safeDomainRawPicks(domain);
              const cheapPick =
                picks.find((id) => {
                  const mat = getMaterialOrThrow(id);
                  return mat.kind === 'raw' && mat.tier === 'cheap';
                }) ??
                picks[0] ??
                'raw.grain';
              producedRaw[cheapPick] =
                (producedRaw[cheapPick] ?? 0) + tenantLevels * 2;
            }
          }

          // Event 2: Große Hungersnot – Nahrung bereitstellen oder Loyalität -2
          let upkeepRaw: MaterialStock = {};
          let upkeepSpecial: MaterialStock = {};
          const hungerActive = workingState.globalEvents.some(
            (e) =>
              e.tableRollTotal === 2 &&
              state.round >= e.startsAtRound &&
              state.round <= e.endsAtRound
          );
          if (hungerActive) {
            const isFood = (materialId: string) =>
              getMaterialOrThrow(materialId).tags.includes('food');

            // Nahrung wird aus "food"-Materialien genommen (erst RM, dann SM), dabei zuerst das am wenigsten wertvolle.
            const availableRaw = addStock(
              player.economy.inventory.raw,
              producedRaw
            );
            let foodRaw: MaterialStock = {};
            for (const [materialId, count] of Object.entries(availableRaw)) {
              if (count > 0 && isFood(materialId)) foodRaw[materialId] = count;
            }
            let foodSpecial: MaterialStock = {};
            for (const [materialId, count] of Object.entries(
              player.economy.inventory.special
            )) {
              if (count > 0 && isFood(materialId))
                foodSpecial[materialId] = count;
            }

            const feedOrder = (ids: string[]) =>
              [...ids].sort((a, b) => {
                const ma = getMaterialOrThrow(a);
                const mb = getMaterialOrThrow(b);
                const tier =
                  materialTierRank(ma.tier) - materialTierRank(mb.tier);
                if (tier !== 0) return tier;
                const bonus = (ma.saleBonusGold ?? 0) - (mb.saleBonusGold ?? 0);
                if (bonus !== 0) return bonus;
                return a.localeCompare(b);
              });

            const canFeed = (amount: number) =>
              sumStock(foodRaw) + sumStock(foodSpecial) >= amount;

            const feed = (amount: number): boolean => {
              const need = Math.max(0, Math.trunc(amount));
              if (!need) return true;
              if (!canFeed(need)) return false;

              const { taken: rawTaken, remaining: rawRemaining } =
                takeFromStock(foodRaw, need, feedOrder);
              foodRaw = rawRemaining;
              const rawTakenTotal = sumStock(rawTaken);

              const remainingNeed = need - rawTakenTotal;
              let specialTaken: MaterialStock = {};
              if (remainingNeed > 0) {
                const { taken, remaining } = takeFromStock(
                  foodSpecial,
                  remainingNeed,
                  feedOrder
                );
                foodSpecial = remaining;
                specialTaken = taken;
              }

              const specialTakenTotal = sumStock(specialTaken);
              if (rawTakenTotal + specialTakenTotal !== need) return false;

              upkeepRaw = addStock(upkeepRaw, rawTaken);
              upkeepSpecial = addStock(upkeepSpecial, specialTaken);
              return true;
            };

            const hungerChanges: Array<{
              location: {
                kind: 'domain' | 'cityProperty' | 'organization';
                id: string;
              };
              loyaltyDelta?: number;
            }> = [];

            const requireFeed = (
              location: {
                kind: 'domain' | 'cityProperty' | 'organization';
                id: string;
              },
              required: number
            ) => {
              const need = Math.max(0, Math.trunc(required));
              if (!need) return;
              const ok = feed(need);
              if (!ok) hungerChanges.push({ location, loyaltyDelta: -2 });
            };

            for (const d of player.holdings.domains) {
              requireFeed({ kind: 'domain', id: d.id }, d.tenants.levels);
            }
            for (const c of player.holdings.cityProperties) {
              requireFeed({ kind: 'cityProperty', id: c.id }, c.tenants.levels);
            }
            for (const o of player.holdings.organizations) {
              requireFeed(
                { kind: 'organization', id: o.id },
                o.followers.levels
              );
            }

            if (hungerChanges.length) {
              push({
                type: 'PlayerFollowersAdjusted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                changes: hungerChanges,
                reason: 'Große Hungersnot: Nahrung nicht bereitgestellt',
              });
              player = workingState.players[playerId];
            }
          }

          // Ereignis-Nebeneffekte: Übergriffe/Angriffe (vereinfacht, aber regeltextnah für Rohstoff-/Pächterverluste).
          const incidentTenantLosses: Array<{
            location: {
              kind: 'domain' | 'cityProperty' | 'organization';
              id: string;
            };
            levelsDelta: number;
          }> = [];

          const stealOrder = (ids: string[]) =>
            [...ids].sort((a, b) => {
              const ma = getMaterialOrThrow(a);
              const mb = getMaterialOrThrow(b);
              const tier =
                materialTierRank(mb.tier) - materialTierRank(ma.tier);
              if (tier) return tier;
              const bonus = mb.saleBonusGold - ma.saleBonusGold;
              if (bonus) return bonus;
              return a.localeCompare(b);
            });

          const stealRaw = (
            amount: number
          ): { amountRequested: number; stolen: MaterialStock } => {
            const need = Math.max(0, Math.trunc(amount));
            if (!need) return { amountRequested: 0, stolen: {} };
            const availableRaw = subtractStock(
              addStock(player.economy.inventory.raw, producedRaw),
              upkeepRaw
            );
            const { taken } = takeFromStock(availableRaw, need, stealOrder);
            upkeepRaw = addStock(upkeepRaw, taken);
            return { amountRequested: need, stolen: taken };
          };

          const stealSpecial = (
            amount: number
          ): { amountRequested: number; stolen: MaterialStock } => {
            const need = Math.max(0, Math.trunc(amount));
            if (!need) return { amountRequested: 0, stolen: {} };
            const availableSpecial = subtractStock(
              addStock(player.economy.inventory.special, producedSpecial),
              upkeepSpecial
            );
            const { taken } = takeFromStock(availableSpecial, need, stealOrder);
            upkeepSpecial = addStock(upkeepSpecial, taken);
            return { amountRequested: need, stolen: taken };
          };

          const incidentDefenseMod = defenseRollModifier(player);
          const incidentDefenseDcBonus = activeEvents.some(
            (e) => e.tableRollTotal === 26
          )
            ? 2
            : 0;

          // Event 16: Räuberbanden und Deserteure – Domänen können RM verlieren (4 Runden).
          const e16 = activeEvents.find((e) => e.tableRollTotal === 16);
          const raidersOrPirates = (e16?.meta as any)?.raidersOrPirates as
            | 'raiders'
            | 'pirates'
            | undefined;
          if (raidersOrPirates === 'raiders') {
            for (const domain of player.holdings.domains) {
              const trigger = rollD20(ctx.rng);
              if (trigger.total > 5) continue;

              const defenseDc = 13 + incidentDefenseDcBonus;
              const defenseRoll = rollD20(ctx.rng);
              const defenseTotal = defenseRoll.total + incidentDefenseMod;
              const defended = defenseTotal >= defenseDc;
              if (defended) continue;

              const lossRoll = rollDice('1d6', ctx.rng);
              const stolen = stealRaw(lossRoll.total);

              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Räuberüberfall auf Domäne (${domain.id}) – Verteidigung ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc} → ${sumStock(stolen.stolen)} RM verloren.`,
                });
              }
            }
          }

          // Event 16 (Piraten): Verlust/Beschädigung von Handelsschiffen (v1: Handelsunternehmungen) (4 Runden).
          if (raidersOrPirates === 'pirates') {
            const ships = player.holdings.tradeEnterprises.filter(
              (t) => !t.damage
            );
            // Max. 2 betroffene "Schiffe" pro Abschnitt.
            if (ships.length > 0 && incidentCountFor(16, 'piracy') < 2) {
              const roll = rollD20(ctx.rng);
              if (roll.total <= 10) {
                const pickIndex = ctx.rng.nextIntInclusive(0, ships.length - 1);
                const ship = ships[pickIndex];
                if (ship) {
                  if (roll.total <= 5) {
                    recordIncident(16, 'piracy', 'Piraterie: Schiff verloren');
                    push({
                      type: 'PlayerTradeEnterpriseLost',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      tradeEnterpriseId: ship.id,
                      reason: 'Piraterie: Schiff verloren',
                    });
                    if (canEmitPublicLogs(ctx)) {
                      push({
                        type: 'PublicLogEntryAdded',
                        visibility: { scope: 'public' },
                        message: `${player.displayName}: Piraterie – Handelsunternehmung (${ship.id}) ging verloren (w20=${roll.total}).`,
                      });
                    }
                  } else {
                    recordIncident(
                      16,
                      'piracy',
                      'Piraterie: Schiff beschädigt'
                    );
                    const repair = rollDice('1d6', ctx.rng);
                    push({
                      type: 'PlayerTradeEnterpriseDamaged',
                      visibility: { scope: 'private', playerId: player.id },
                      playerId: player.id,
                      tradeEnterpriseId: ship.id,
                      repairCostGold: repair.total,
                      reason: 'Piraterie: Schiff beschädigt',
                    });
                    if (canEmitPublicLogs(ctx)) {
                      push({
                        type: 'PublicLogEntryAdded',
                        visibility: { scope: 'public' },
                        message: `${player.displayName}: Piraterie – Handelsunternehmung (${ship.id}) beschädigt (w20=${roll.total}), Reparatur≈${repair.total}G.`,
                      });
                    }
                  }
                }
              }
            }
          }

          // Event 26: Konflikt mit Nachbarn – erhöhte Gefahr für Handelsschiffe/Handelsunternehmungen (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 26)) {
            const ships = player.holdings.tradeEnterprises.filter(
              (t) => !t.damage
            );
            for (const ship of ships) {
              const trigger = rollD20(ctx.rng);
              if (trigger.total > 5) continue;

              const defenseDc = 15 + incidentDefenseDcBonus;
              const defenseRoll = rollD20(ctx.rng);
              const defenseTotal = defenseRoll.total + incidentDefenseMod;
              const defended = defenseTotal >= defenseDc;
              if (defended) continue;

              const severity = rollD20(ctx.rng);
              if (severity.total <= 3) {
                push({
                  type: 'PlayerTradeEnterpriseLost',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  tradeEnterpriseId: ship.id,
                  reason: 'Konflikt: Schiff verloren',
                });
                if (canEmitPublicLogs(ctx)) {
                  push({
                    type: 'PublicLogEntryAdded',
                    visibility: { scope: 'public' },
                    message: `${player.displayName}: Konflikt – Handelsunternehmung (${ship.id}) ging verloren (Abwehr ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc}; w20=${severity.total}).`,
                  });
                }
                continue;
              }
              if (severity.total <= 8) {
                const repair = rollDice('1d6', ctx.rng);
                push({
                  type: 'PlayerTradeEnterpriseDamaged',
                  visibility: { scope: 'private', playerId: player.id },
                  playerId: player.id,
                  tradeEnterpriseId: ship.id,
                  repairCostGold: repair.total,
                  reason: 'Konflikt: Schiff beschädigt',
                });
                if (canEmitPublicLogs(ctx)) {
                  push({
                    type: 'PublicLogEntryAdded',
                    visibility: { scope: 'public' },
                    message: `${player.displayName}: Konflikt – Handelsunternehmung (${ship.id}) beschädigt (Abwehr ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc}; Reparatur≈${repair.total}G).`,
                  });
                }
                continue;
              }

              const lossRoll = rollDice('1d4', ctx.rng);
              const stolen = stealSpecial(
                lossRoll.total * postTierRank(ship.tier)
              );
              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Konflikt – Übergriff auf Handelsunternehmung (${ship.id}) (Abwehr ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc}) → ${sumStock(stolen.stolen)} SM verloren.`,
                });
              }
            }
          }

          // Event 37: Entlassene Söldnertruppe plündert – bis zu 2 (unverteidigte) Domänen (4 Runden).
          if (activeEvents.some((e) => e.tableRollTotal === 37)) {
            const candidates = player.holdings.domains.filter(
              (d) => countFacilitySlotsUsedAtDomain(player.holdings, d.id) === 0
            );
            const remaining = Math.max(0, 2 - incidentCountFor(37, 'plunder'));
            const attacks = Math.min(remaining, candidates.length);
            for (let i = 0; i < attacks; i += 1) {
              const pickIndex = ctx.rng.nextIntInclusive(
                0,
                candidates.length - 1
              );
              const domain = candidates.splice(pickIndex, 1)[0];
              if (!domain) continue;

              recordIncident(
                37,
                'plunder',
                'Plünderung: Angriff auf Domäne'
              );
              const defenseDc = 15 + incidentDefenseDcBonus;
              const defenseRoll = rollD20(ctx.rng);
              const defenseTotal = defenseRoll.total + incidentDefenseMod;
              const defended = defenseTotal >= defenseDc;
              if (defended) continue;

              const lossRoll = rollDice('2d6', ctx.rng);
              const stolen = stealRaw(lossRoll.total);

              const tenantsLossRoll = rollDice('1d3', ctx.rng);
              const tenantLoss = Math.min(
                domain.tenants.levels,
                tenantsLossRoll.total
              );
              if (tenantLoss > 0) {
                incidentTenantLosses.push({
                  location: { kind: 'domain', id: domain.id },
                  levelsDelta: -tenantLoss,
                });
              }

              if (canEmitPublicLogs(ctx)) {
                push({
                  type: 'PublicLogEntryAdded',
                  visibility: { scope: 'public' },
                  message: `${player.displayName}: Plünderung auf Domäne (${domain.id}) – Verteidigung ${defenseRoll.total}+${incidentDefenseMod}=${defenseTotal} < DC ${defenseDc} → ${sumStock(stolen.stolen)} RM verloren, ${tenantLoss} Pächterstufe(n) verloren.`,
                });
              }
            }
          }

          const effectiveLaborAvailable = Math.max(
            0,
            player.turn.laborAvailable + eventLaborDelta
          );

          const upkeepActive = state.round >= 2;

          // Upkeep totals (werden ab Runde 2 gezahlt)
          let upkeepGold = 0;
          let upkeepLabor = 0;
          let upkeepInfluence = 0;
          let upkeepMagicPower = 0;

          if (upkeepActive) {
            // Domänen-Unterhalt (Gold)
            for (const d of player.holdings.domains) {
              upkeepGold +=
                d.tier === 'small'
                  ? 2
                  : d.tier === 'medium'
                    ? 4
                    : d.tier === 'large'
                      ? 8
                      : 0;
            }

            // Stadtbesitz-Eigenproduktion-Unterhalt (Gold)
            for (const c of player.holdings.cityProperties) {
              upkeepGold +=
                c.mode === 'production'
                  ? c.tier === 'small'
                    ? 2
                    : c.tier === 'medium'
                      ? 4
                      : 8
                  : 0;
              if (c.tenure === 'pacht') upkeepGold += 1;
            }

            // Circel/Collegien-Unterhalt
            for (const o of player.holdings.organizations) {
              const rank = postTierRank(o.tier);
              if (o.kind === 'underworld') {
                upkeepGold += 1 * rank;
                upkeepLabor += 1 * rank;
              } else if (o.kind === 'spy') {
                upkeepGold += 2 * rank;
              } else if (o.kind === 'cult') {
                upkeepGold += 1 * rank;
              } else {
                // Handwerks-/Handelscollegium: Unterhalt "2 Gold" (ohne "pro Stufe" im Text) → v1: pauschal 2 Gold pro Collegium.
                upkeepGold += 2;
              }
            }

            // Event 24: Kirchenaufsichts-Ämter – +3 Gold Unterhalt pro Stufe (4 Runden).
            if (activeEvents.some((e) => e.tableRollTotal === 24)) {
              for (const office of player.holdings.offices) {
                if (office.specialization?.kind !== 'churchOversight') continue;
                upkeepGold += 3 * postTierRank(office.tier);
              }
            }

            // Amtseinrichtung (Soll/v1 subset): Administrative Reformen – 2 Gold Unterhalt/Runde.
            {
              let counted = false;
              for (const office of player.holdings.offices) {
                const has = [...office.facilities, ...(office.specialization?.facilities ?? [])].some(
                  (f) => f.key === 'general.medium.office.administrativeReforms'
                );
                if (!has) continue;
                if (!counted) upkeepGold += 2;
                counted = true;
              }
            }

            // Handelsunternehmungen-Unterhalt
            const tradeUpkeepExtraPerTier =
              (activeEvents.some((e) => e.tableRollTotal === 13) ? 4 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 15) ? 3 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 16) ? 3 : 0) +
              (activeEvents.some((e) => e.tableRollTotal === 22) ? 3 : 0);
            for (const te of player.holdings.tradeEnterprises) {
              if (te.damage) continue;
              if (te.tier === 'small') {
                upkeepGold += 2;
                upkeepLabor += 1;
              } else if (te.tier === 'medium') {
                upkeepGold += 5;
                upkeepLabor += 2;
              } else {
                upkeepGold += 6;
                upkeepLabor += 4;
              }
              upkeepGold += tradeUpkeepExtraPerTier * postTierRank(te.tier);
            }

            // Truppen-Unterhalt
            const troops = player.holdings.troops;
            upkeepGold += troops.bodyguardLevels * 4;
            upkeepInfluence += troops.bodyguardLevels * 2;

            upkeepGold += troops.mercenaryLevels * 3;

            // Miliz: 1 Gold + 1 Einfluss pro 50er Einheit (=2 Stufen)
            const militiaGroups = Math.ceil(troops.militiaLevels / 2);
            upkeepGold += militiaGroups;
            upkeepInfluence += militiaGroups;

            upkeepGold += troops.thugLevels * 1;
            upkeepInfluence += troops.thugLevels * 1;

            for (const s of player.holdings.specialists) {
              const base =
                s.tier === 'simple' ? 1 : s.tier === 'experienced' ? 3 : 5;
              const adj = specialistUpkeepAdjustments(player, s);
              upkeepGold += Math.max(0, base + adj.goldDelta);
              upkeepInfluence += Math.max(0, adj.influenceDelta);
            }

            // Allgemeiner Unterhalt (Soll): 1 RM (Nahrung) oder 1 Gold pro
            // - 4 AK
            // - 2 KK
            // - 1 Stufe Pächter/Anhänger/Klienten
            const laborFood = Math.ceil(effectiveLaborAvailable / 4);
            const combatFood = Math.ceil(
              openCombatPower(player.holdings.troops) / 2
            );
            const followerFood =
              player.holdings.domains.reduce(
                (sum, d) => sum + d.tenants.levels,
                0
              ) +
              player.holdings.cityProperties.reduce(
                (sum, c) => sum + c.tenants.levels,
                0
              ) +
              player.holdings.organizations.reduce(
                (sum, o) => sum + o.followers.levels,
                0
              );
            const foodRequired = laborFood + combatFood + followerFood;
            if (foodRequired > 0) {
              const isFood = (materialId: string) =>
                getMaterialOrThrow(materialId).tags.includes('food');

              const availableRaw = subtractStock(
                addStock(player.economy.inventory.raw, producedRaw),
                upkeepRaw
              );
              const availableSpecial = subtractStock(
                addStock(player.economy.inventory.special, producedSpecial),
                upkeepSpecial
              );

              const rawFood: MaterialStock = {};
              for (const [materialId, count] of Object.entries(availableRaw)) {
                if (count > 0 && isFood(materialId))
                  rawFood[materialId] = count;
              }
              const specialFood: MaterialStock = {};
              for (const [materialId, count] of Object.entries(
                availableSpecial
              )) {
                if (count > 0 && isFood(materialId))
                  specialFood[materialId] = count;
              }
              const order = (ids: string[]) =>
                [...ids].sort((a, b) => {
                  const ma = getMaterialOrThrow(a);
                  const mb = getMaterialOrThrow(b);
                  const tier =
                    materialTierRank(ma.tier) - materialTierRank(mb.tier);
                  if (tier) return tier;
                  const bonus = ma.saleBonusGold - mb.saleBonusGold;
                  if (bonus) return bonus;
                  return a.localeCompare(b);
                });

              let remainingNeed = foodRequired;
              const rawTaken = takeFromStock(
                rawFood,
                remainingNeed,
                order
              ).taken;
              upkeepRaw = addStock(upkeepRaw, rawTaken);
              remainingNeed -= sumStock(rawTaken);

              if (remainingNeed > 0) {
                const specialTaken = takeFromStock(
                  specialFood,
                  remainingNeed,
                  order
                ).taken;
                upkeepSpecial = addStock(upkeepSpecial, specialTaken);
                remainingNeed -= sumStock(specialTaken);
              }

              if (remainingNeed > 0) upkeepGold += remainingNeed;
            }
          }

          // Handelsunternehmungen-Ertrag (kommt "in der nächsten Runde" → wir verbuchen ihn im Runden-Start / Maintenance).
          const tradeYieldHalved = activeEvents.some(
            (e) =>
              e.tableRollTotal === 10 ||
              e.tableRollTotal === 15 ||
              e.tableRollTotal === 17 ||
              e.tableRollTotal === 26
          );
          const tradeYieldBonusActive = activeEvents.some(
            (e) => e.tableRollTotal === 33
          );
          for (const te of player.holdings.tradeEnterprises) {
            if (te.damage) continue;
            const produceCount =
              te.tier === 'small' ? 2 : te.tier === 'medium' ? 3 : 6;
            const tradeInput =
              te.tier === 'small' ? 1 : te.tier === 'medium' ? 2 : 4;
            const tradeGold =
              te.tier === 'small' ? 4 : te.tier === 'medium' ? 10 : 24;
            const tierRank = postTierRank(te.tier);

            if (te.mode === 'produce') {
              let out = produceCount;
              if (tradeYieldBonusActive) out += 1 * tierRank;
              if (tradeYieldHalved) out = Math.floor(out / 2);
              if (out > 0) {
                producedSpecial['special.simpleTools'] =
                  (producedSpecial['special.simpleTools'] ?? 0) + out;
              }
              continue;
            }

            // "Trade": investiere Sondermaterial → Gold (vereinfachte Abbildung: günstigstes SM investieren)
            const availableSpecial = subtractStock(
              player.economy.inventory.special,
              upkeepSpecial
            );
            const order = (ids: string[]) =>
              [...ids].sort((a, b) => {
                const ma = getMaterialOrThrow(a);
                const mb = getMaterialOrThrow(b);
                const tier =
                  materialTierRank(ma.tier) - materialTierRank(mb.tier);
                if (tier) return tier;
                const bonus = ma.saleBonusGold - mb.saleBonusGold;
                if (bonus) return bonus;
                return a.localeCompare(b);
              });
            const { taken } = takeFromStock(
              availableSpecial,
              tradeInput,
              order
            );
            if (sumStock(taken) === tradeInput) {
              upkeepSpecial = addStock(upkeepSpecial, taken);
              // +/- Marktsystem: Wähle den besten verfügbaren Handelsmarkt der Unternehmung für diese Waren.
              const marketCandidates = Array.from(
                { length: tierRank },
                (_, i) => tradeMarketInstanceId(player.id, te.id, i + 1)
              );
              let bestMarketDelta: number | null = null;
              for (const marketId of marketCandidates) {
                let delta = 0;
                for (const [materialId, count] of Object.entries(taken)) {
                  if (count <= 0) continue;
                  delta +=
                    count *
                    marketModifierPerInvestment(
                      workingState,
                      marketId,
                      materialId
                    );
                }
                if (bestMarketDelta == null || delta > bestMarketDelta)
                  bestMarketDelta = delta;
              }
              bestMarketDelta ??= 0;

              let globalEventDelta = 0;
              for (const [materialId, count] of Object.entries(taken)) {
                if (count <= 0) continue;
                globalEventDelta +=
                  count *
                  marketDeltaPerInvestment(
                    materialId,
                    workingState.globalEvents,
                    state.round
                  );
              }

              let out = tradeGold + bestMarketDelta + globalEventDelta;
              // Event 33: "Warenüberschuss" — +2 Gold (trade) oder +1 SM (produce) pro Stufe.
              if (tradeYieldBonusActive) out += 2 * tierRank;
              if (tradeYieldHalved) out = Math.floor(out / 2);
              producedGold += out;
            }
          }

          const goldAvailableForUpkeep = player.economy.gold + producedGold;
          const magicPowerAvailableForUpkeep =
            player.economy.inventory.magicPower + eventMagicPowerDelta;

          const progressedProjects: Array<{
            projectId: string;
            remainingRoundsAfter: number;
            upkeepPaid: { labor: number; magicPower: number };
          }> = [];

          // Langzeitvorhaben: zahlen je Runde AK/ZK, wenn verfügbar (sonst pausiert das Vorhaben).
          // Priorität: vor Werkstatt/Lager-Unterhalt, damit Bauvorhaben AK "reservieren".
          if (upkeepActive && player.holdings.longTermProjects.length) {
            const buildLaborMultiplier = activeEvents.some(
              (e) => e.tableRollTotal === 36
            )
              ? 2
              : 1;

            const projects = player.holdings.longTermProjects
              .filter((p) => p.remainingRounds > 0)
              .slice()
              .sort((a, b) => {
                const started =
                  Math.trunc(a.startedAtRound) - Math.trunc(b.startedAtRound);
                if (started) return started;
                return a.id.localeCompare(b.id);
              });

            for (const p of projects) {
              const laborCost =
                Math.max(0, Math.trunc(p.laborPerRound)) * buildLaborMultiplier;
              const magicCost = Math.max(0, Math.trunc(p.magicPowerPerRound));
              if (
                effectiveLaborAvailable - upkeepLabor < laborCost ||
                magicPowerAvailableForUpkeep - upkeepMagicPower < magicCost
              ) {
                continue;
              }
              upkeepLabor += laborCost;
              upkeepMagicPower += magicCost;
              progressedProjects.push({
                projectId: p.id,
                remainingRoundsAfter: Math.max(0, p.remainingRounds - 1),
                upkeepPaid: { labor: laborCost, magicPower: magicCost },
              });
            }
          }

          const maintainedWorkshopIds: string[] = [];
          if (!upkeepActive) {
            for (const w of player.holdings.workshops)
              if (!w.damage) maintainedWorkshopIds.push(w.id);
          } else {
            const workshopMods = computeWorkshopUpkeepMods(
              workingState.globalEvents,
              state.round
            );
            for (const w of player.holdings.workshops) {
              if (w.damage) continue;
              const base = workshopUpkeep(w.tier);
              const u = {
                labor: base.labor + workshopMods.laborFlat,
                gold:
                  base.gold +
                  workshopMods.goldFlat +
                  workshopMods.goldPerTier * postTierRank(w.tier),
              };
              if (
                effectiveLaborAvailable - upkeepLabor >= u.labor &&
                goldAvailableForUpkeep - upkeepGold >= u.gold
              ) {
                upkeepLabor += u.labor;
                upkeepGold += u.gold;
                maintainedWorkshopIds.push(w.id);
              }
            }
          }

          const maintainedStorageIds: string[] = [];
          if (!upkeepActive) {
            for (const s of player.holdings.storages)
              if (!s.damage) maintainedStorageIds.push(s.id);
          } else {
            for (const s of player.holdings.storages) {
              if (s.damage) continue;
              const u = storageUpkeep(s.tier);
              if (effectiveLaborAvailable - upkeepLabor >= u.labor) {
                upkeepLabor += u.labor;
                maintainedStorageIds.push(s.id);
              }
            }
          }

          push({
            type: 'PlayerIncomeApplied',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            produced: {
              gold: producedGold,
              raw: producedRaw,
              special: addStock(producedSpecial, eventSpecialDelta),
              influence: eventInfluenceDelta,
              labor: eventLaborDelta,
              magicPower: eventMagicPowerDelta,
            },
            upkeepPaid: {
              gold: upkeepGold,
              influence: upkeepInfluence,
              labor: upkeepLabor,
              raw: upkeepRaw,
              special: upkeepSpecial,
              magicPower: upkeepMagicPower,
            },
            eventTaxesPaid: {
              gold: perRoundTaxGold,
              oneTimeOfficeTaxGold: (() => {
                const warTaxStartsThisRound = workingState.globalEvents.some(
                  (e) =>
                    e.tableRollTotal === 4 && state.round === e.startsAtRound
                );
                if (!warTaxStartsThisRound) return 0;
                let sum = 0;
                for (const office of player.holdings.offices) {
                  sum +=
                    office.tier === 'small'
                      ? 4
                      : office.tier === 'medium'
                        ? 10
                        : 20;
                }
                return sum;
              })(),
            },
            upkeep: {
              maintainedWorkshopIds,
              maintainedStorageIds,
              maintainedOfficeIds: player.holdings.offices.map((o) => o.id),
              maintainedOrganizationIds: player.holdings.organizations.map(
                (o) => o.id
              ),
              maintainedTradeEnterpriseIds: player.holdings.tradeEnterprises
                .filter((t) => !t.damage)
                .map((t) => t.id),
              maintainedTroops:
                upkeepActive &&
                (player.holdings.troops.bodyguardLevels > 0 ||
                  player.holdings.troops.militiaLevels > 0 ||
                  player.holdings.troops.mercenaryLevels > 0 ||
                  player.holdings.troops.thugLevels > 0),
            },
          });

          if (progressedProjects.length) {
            for (const progress of progressedProjects) {
              const project = player.holdings.longTermProjects.find(
                (p) => p.id === progress.projectId
              );
              if (!project) continue;

              push({
                type: 'PlayerLongTermProjectProgressed',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                projectId: progress.projectId,
                progressedAtRound: state.round,
                remainingRoundsAfter: progress.remainingRoundsAfter,
                upkeepPaid: progress.upkeepPaid,
                reason: 'Langzeitvorhaben: Baufortschritt',
              });
              player = workingState.players[playerId];

              if (progress.remainingRoundsAfter > 0) continue;

              // Abgeschlossen: Facility-Instanz erzeugen und einbauen.
              const p2 = player.holdings.longTermProjects.find(
                (p) => p.id === progress.projectId
              );
              const target = p2 ?? project;

              let existingFacilities: Array<{ id: string }> = [];
              if (target.location.kind === 'domain') {
                const id = target.location.id;
                const d = player.holdings.domains.find(
                  (x) => x.id === id
                );
                existingFacilities = d
                  ? [...d.facilities, ...(d.specialization?.facilities ?? [])]
                  : [];
              } else if (target.location.kind === 'cityProperty') {
                const id = target.location.id;
                const c = player.holdings.cityProperties.find(
                  (x) => x.id === id
                );
                existingFacilities = c
                  ? [...c.facilities, ...(c.specialization?.facilities ?? [])]
                  : [];
              } else if (target.location.kind === 'organization') {
                const id = target.location.id;
                const o = player.holdings.organizations.find(
                  (x) => x.id === id
                );
                existingFacilities = o?.facilities ?? [];
              } else if (target.location.kind === 'office') {
                const id = target.location.id;
                const o = player.holdings.offices.find(
                  (x) => x.id === id
                );
                existingFacilities = o
                  ? [...o.facilities, ...(o.specialization?.facilities ?? [])]
                  : [];
              } else if (target.location.kind === 'tradeEnterprise') {
                const id = target.location.id;
                const t = player.holdings.tradeEnterprises.find(
                  (x) => x.id === id
                );
                existingFacilities = t?.facilities ?? [];
              } else if (target.location.kind === 'workshop') {
                const id = target.location.id;
                const w = player.holdings.workshops.find(
                  (x) => x.id === id
                );
                existingFacilities = w?.facilities ?? [];
              } else if (target.location.kind === 'personal') {
                existingFacilities = player.holdings.personalFacilities;
              } else if (target.location.kind === 'troops') {
                existingFacilities = player.holdings.troops.facilities;
              }

              const facilityInstanceId = generateFacilityInstanceId(
                target.location,
                existingFacilities
              );

              push({
                type: 'PlayerLongTermProjectCompleted',
                visibility: { scope: 'private', playerId: player.id },
                playerId: player.id,
                projectId: progress.projectId,
                completedAtRound: state.round,
                kind: 'facility',
                location: target.location as any,
                facilityInstanceId,
                facilityKey: target.facilityKey,
              });
              player = workingState.players[playerId];
            }
          }

          if (incidentTenantLosses.length) {
            push({
              type: 'PlayerFollowersAdjusted',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              changes: incidentTenantLosses,
              reason: 'Plünderung: Pächterstufen verloren',
            });
          }
        }
      }

      if (from === 'actions' && to === 'conversion') {
        for (const player of Object.values(state.players)) {
          const rawBefore = player.economy.inventory.raw;
          const specialBefore = player.economy.inventory.special;
          const laborConverted = Math.max(
            0,
            Math.trunc(player.turn.laborAvailable)
          );
          const influenceConverted = Math.max(
            0,
            Math.trunc(player.turn.influenceAvailable)
          );

          const rawTotalBefore = sumStock(rawBefore);
          const specialTotalBefore = sumStock(specialBefore);
          if (
            rawTotalBefore === 0 &&
            specialTotalBefore === 0 &&
            laborConverted === 0 &&
            influenceConverted === 0
          ) {
            continue;
          }

          // Workshop conversion: consume up to capacity for each workshop's input, produce configured Sondermaterial.
          const rawConsumedByType: MaterialStock = {};
          const rawAfterWorkshop: MaterialStock = { ...rawBefore };
          const rawProducedByType: MaterialStock = {};
          const specialProducedByType: MaterialStock = {};

          const workshops = player.turn.upkeep.maintainedWorkshopIds
            .map((id) => player.holdings.workshops.find((x) => x.id === id))
            .filter((w): w is NonNullable<typeof w> => Boolean(w))
            .sort((a, b) => a.id.localeCompare(b.id));

          for (const w of workshops) {
            const inputId = w.inputMaterialId ?? 'raw.grain';
            const outputBaseId =
              w.outputMaterialId ?? defaultWorkshopOutputForInput(inputId);
            const available = rawAfterWorkshop[inputId] ?? 0;
            if (available <= 0) continue;
            const cap = workshopCapacity(w.tier);
            const rawForWorkshop = Math.min(available, cap.rawIn);
            const outputMat = getMaterialOrThrow(outputBaseId);

            // Alternative: RM -> verbesserte RM (1:1)
            if (outputMat.kind === 'raw') {
              const converted = rawForWorkshop;
              if (converted <= 0) continue;
              rawAfterWorkshop[inputId] = available - converted;
              if (rawAfterWorkshop[inputId] <= 0)
                delete rawAfterWorkshop[inputId];
              rawConsumedByType[inputId] =
                (rawConsumedByType[inputId] ?? 0) + converted;
              rawProducedByType[outputBaseId] =
                (rawProducedByType[outputBaseId] ?? 0) + converted;
              continue;
            }

            // Standard: RM -> SM (4:1, plus ggf. Bonus-SM bei mittlerer/großer Werkstatt)
            const smBase = Math.min(
              Math.floor(rawForWorkshop / 4),
              cap.specialOutMax
            );
            const bonusSm =
              smBase > 0
                ? w.tier === 'medium'
                  ? 1
                  : w.tier === 'large'
                    ? 2
                    : 0
                : 0;
            const sm = smBase + bonusSm;
            const consumed = smBase * 4;
            if (consumed <= 0) continue;
            rawAfterWorkshop[inputId] = available - consumed;
            if (rawAfterWorkshop[inputId] <= 0)
              delete rawAfterWorkshop[inputId];
            rawConsumedByType[inputId] =
              (rawConsumedByType[inputId] ?? 0) + consumed;

            const steps = refinementStepsForLocation(player, w.location);
            const outputId = refineSpecialMaterialId(outputBaseId, steps);
            specialProducedByType[outputId] =
              (specialProducedByType[outputId] ?? 0) + sm;
          }

          const storeOrder = (ids: string[]) =>
            ids.sort((a, b) => {
              const ma = getMaterialOrThrow(a);
              const mb = getMaterialOrThrow(b);
              const tier =
                materialTierRank(mb.tier) - materialTierRank(ma.tier);
              if (tier) return tier;
              const bonus = mb.saleBonusGold - ma.saleBonusGold;
              if (bonus) return bonus;
              return a.localeCompare(b);
            });

          const rawAfterWorkshopWithOutputs = addStock(
            rawAfterWorkshop,
            rawProducedByType
          );
          const specialAfterWorkshop = addStock(
            specialBefore,
            specialProducedByType
          );

          // Facility conversion (v1 subset): Gasse der Kunsthandwerker.
          const facilityRawConsumedByType: MaterialStock = {};
          const facilitySpecialConsumedByType: MaterialStock = {};
          const facilityRawProducedByType: MaterialStock = {};
          const facilitySpecialProducedByType: MaterialStock = {};

          const hasArtisan =
            player.holdings.specialists.some(
              (s) => s.kind === 'artisan' || s.secondaryKind === 'artisan'
            ) ||
            player.holdings.specialists.some(
              (s) => s.kind === 'workshop' || s.secondaryKind === 'workshop'
            );

          const autoGoldEq = (materialId: string, count: number): number => {
            const c = Math.max(0, Math.trunc(count));
            if (!c) return 0;
            const material = getMaterialOrThrow(materialId);
            if (material.kind === 'raw') {
              const divisor = rawAutoConvertDivisor(
                materialId,
                state.globalEvents,
                state.round
              );
              const saleBonus = Math.floor(c / 4) * material.saleBonusGold;
              return c / Math.max(1, divisor) + saleBonus;
            }
            const saleBonus = Math.floor(c / 4) * material.saleBonusGold;
            return c * 2 + saleBonus;
          };

          if (hasArtisan) {
            type Recipe = {
              id: string;
              inRaw: MaterialStock;
              inSpecial: MaterialStock;
              outRaw: MaterialStock;
              outSpecial: MaterialStock;
            };
            const recipes: Recipe[] = [
              {
                id: 'gasse.gems',
                inRaw: { 'raw.unpolishedGems': 1 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.cutGems': 1 },
              },
              {
                id: 'gasse.metals',
                inRaw: { 'raw.preciousMetals': 1 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.jewelry': 1 },
              },
              {
                id: 'gasse.glass',
                inRaw: { 'raw.quartzSand': 4 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.glassware': 1 },
              },
              {
                id: 'gasse.perfume',
                inRaw: { 'raw.herbsFlowers': 4 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.perfume': 1 },
              },
              {
                id: 'gasse.potions',
                inRaw: { 'raw.herbsFlowers': 4 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.potions': 1 },
              },
              {
                id: 'gasse.books',
                inRaw: {},
                inSpecial: { 'special.paper': 4 },
                outRaw: {},
                outSpecial: { 'special.booksMaps': 1 },
              },
              {
                id: 'gasse.mechanics',
                inRaw: { 'raw.leadBrassTin': 2 },
                inSpecial: {},
                outRaw: {},
                outSpecial: { 'special.mechanicalParts': 1 },
              },
            ];

            const canApply = (r: Recipe) => {
              for (const [id, need] of Object.entries(r.inRaw)) {
                if ((rawAfterWorkshopWithOutputs[id] ?? 0) < need) return false;
              }
              for (const [id, need] of Object.entries(r.inSpecial)) {
                if ((specialAfterWorkshop[id] ?? 0) < need) return false;
              }
              return true;
            };

            const applyRecipe = (r: Recipe) => {
              for (const [id, need] of Object.entries(r.inRaw)) {
                const have = rawAfterWorkshopWithOutputs[id] ?? 0;
                rawAfterWorkshopWithOutputs[id] = have - need;
                if (rawAfterWorkshopWithOutputs[id] <= 0)
                  delete rawAfterWorkshopWithOutputs[id];
                facilityRawConsumedByType[id] =
                  (facilityRawConsumedByType[id] ?? 0) + need;
              }
              for (const [id, need] of Object.entries(r.inSpecial)) {
                const have = specialAfterWorkshop[id] ?? 0;
                specialAfterWorkshop[id] = have - need;
                if (specialAfterWorkshop[id] <= 0)
                  delete specialAfterWorkshop[id];
                facilitySpecialConsumedByType[id] =
                  (facilitySpecialConsumedByType[id] ?? 0) + need;
              }
              for (const [id, out] of Object.entries(r.outRaw)) {
                if (out <= 0) continue;
                rawAfterWorkshopWithOutputs[id] =
                  (rawAfterWorkshopWithOutputs[id] ?? 0) + out;
                facilityRawProducedByType[id] =
                  (facilityRawProducedByType[id] ?? 0) + out;
              }
              for (const [id, out] of Object.entries(r.outSpecial)) {
                if (out <= 0) continue;
                specialAfterWorkshop[id] =
                  (specialAfterWorkshop[id] ?? 0) + out;
                facilitySpecialProducedByType[id] =
                  (facilitySpecialProducedByType[id] ?? 0) + out;
              }
            };

            for (const city of player.holdings.cityProperties) {
              const alleys = city.facilities.filter(
                (f) => f.key === 'special.medium.artisanAlley' && !f.damage
              );
              if (alleys.length === 0) continue;

              const capacityUnits =
                1 + Math.floor((city.tenants.levels ?? 0) / 4);
              const totalUnits = alleys.length * capacityUnits;
              for (let i = 0; i < totalUnits; i += 1) {
                const feasible = recipes.filter(canApply);
                if (feasible.length === 0) break;
                // Pick the best net auto-gold-equivalent conversion; avoid negative conversions.
                let best: {
                  r: Recipe;
                  net: number;
                  out: number;
                  id: string;
                } | null = null;
                for (const r of feasible) {
                  let inValue = 0;
                  let outValue = 0;
                  for (const [id, c] of Object.entries(r.inRaw))
                    inValue += autoGoldEq(id, c);
                  for (const [id, c] of Object.entries(r.inSpecial))
                    inValue += autoGoldEq(id, c);
                  for (const [id, c] of Object.entries(r.outRaw))
                    outValue += autoGoldEq(id, c);
                  for (const [id, c] of Object.entries(r.outSpecial))
                    outValue += autoGoldEq(id, c);
                  const net = outValue - inValue;
                  if (net <= 0) continue;
                  const tieId =
                    Object.keys(r.outSpecial)[0] ??
                    Object.keys(r.outRaw)[0] ??
                    r.id;
                  if (
                    !best ||
                    net > best.net ||
                    (net === best.net && outValue > best.out) ||
                    (net === best.net &&
                      outValue === best.out &&
                      tieId.localeCompare(best.id) < 0)
                  ) {
                    best = { r, net, out: outValue, id: tieId };
                  }
                }
                if (!best) break;
                applyRecipe(best.r);
              }
            }
          }

          // Storage: store up to capacity (typed).
          let rawStorageCap = 0;
          let specialStorageCap = 0;
          for (const sId of player.turn.upkeep.maintainedStorageIds) {
            const s = player.holdings.storages.find((x) => x.id === sId);
            if (!s) continue;
            const cap = storageCapacity(s.tier, state.rules);
            rawStorageCap += cap.raw;
            specialStorageCap += cap.special;
          }

          const rawStoreTotal = Math.min(
            sumStock(rawAfterWorkshopWithOutputs),
            rawStorageCap
          );
          const { taken: rawStoredByType, remaining: rawRemaining } =
            takeFromStock(
              rawAfterWorkshopWithOutputs,
              rawStoreTotal,
              storeOrder
            );

          const specialStoreTotal = Math.min(
            sumStock(specialAfterWorkshop),
            specialStorageCap
          );
          const { taken: specialStoredByType, remaining: specialRemaining } =
            takeFromStock(specialAfterWorkshop, specialStoreTotal, storeOrder);

          // Auto conversion (default): RM 4:1, SM 1:2.
          const convertedRawByType: MaterialStock = {};
          let goldFromRaw = 0;
          for (const [materialId, count] of Object.entries(rawRemaining)) {
            const divisor = rawAutoConvertDivisor(
              materialId,
              state.globalEvents,
              state.round
            );
            const material = getMaterialOrThrow(materialId);
            const gold = count / divisor;
            const saleBonus = Math.floor(count / 4) * material.saleBonusGold;
            const consumed = count;
            goldFromRaw += gold + saleBonus;
            if (consumed > 0) convertedRawByType[materialId] = consumed;
          }

          const convertedSpecialByType: MaterialStock = {};
          let goldFromSpecial = 0;
          for (const [materialId, count] of Object.entries(specialRemaining)) {
            if (count <= 0) continue;
            const material = getMaterialOrThrow(materialId);
            convertedSpecialByType[materialId] = count;
            const saleBonus = Math.floor(count / 4) * material.saleBonusGold;
            goldFromSpecial += count * 2 + saleBonus;
          }

          const goldFromLabor = laborConverted / 4;
          const goldFromInfluence = influenceConverted / 4;

          events.push({
            type: 'PlayerMaterialsConverted',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            workshop: {
              rawConsumed: rawConsumedByType,
              rawProduced: rawProducedByType,
              specialProduced: specialProducedByType,
            },
            facilities: {
              rawConsumed: facilityRawConsumedByType,
              specialConsumed: facilitySpecialConsumedByType,
              rawProduced: facilityRawProducedByType,
              specialProduced: facilitySpecialProducedByType,
            },
            stored: {
              rawStored: rawStoredByType,
              specialStored: specialStoredByType,
            },
            convertedToGold: {
              rawByType: convertedRawByType,
              specialByType: convertedSpecialByType,
              laborConverted,
              influenceConverted,
              goldGained:
                goldFromRaw +
                goldFromSpecial +
                goldFromLabor +
                goldFromInfluence,
            },
            lost: { rawLost: {}, specialLost: {} },
          });
        }
      }

      if (from === 'conversion' && to === 'reset') {
        // Passive Erholung (Soll): Wenn keine Politischen Schritte ausgeführt wurden, KW-1 und N-1 (min. 0).
        for (const player of Object.values(state.players)) {
          if (!player.turn.usedPoliticalSteps) {
            events.push({
              type: 'PlayerPoliticsAdjusted',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              kwDelta: -1,
              nDelta: -1,
              reason: 'Passive Erholung (keine Politischen Schritte)',
            });
          }
        }

        for (const player of Object.values(state.players)) {
          const upcomingRound = state.round + 1;

          // Fachkräfte: Auto-Promotion (2w6=5) — nach 4 Runden von "einfach" → "erfahren".
          for (const s of player.holdings.specialists) {
            if (s.tier !== 'simple') continue;
            if (!s.autoPromoteAtRound) continue;
            if (s.autoPromoteAtRound !== upcomingRound) continue;
            events.push({
              type: 'PlayerSpecialistPromoted',
              visibility: { scope: 'private', playerId: player.id },
              playerId: player.id,
              specialistId: s.id,
              fromTier: s.tier,
              toTier: 'experienced',
              reason: 'Auto-Promotion (Anwerbetabelle 2w6=5)',
            });
          }

          let labor = baseLaborTotal(player.holdings);
          const influence = baseInfluencePerRound(player.holdings);

          // Event 3 (Seuche): -1 AK pro 500 Pächter/Untertanen/Anhänger/Klienten (Abschnitt)
          const plagueActiveNextRound = state.globalEvents.some(
            (e) =>
              e.tableRollTotal === 3 &&
              upcomingRound >= e.startsAtRound &&
              upcomingRound <= e.endsAtRound
          );
          if (plagueActiveNextRound) {
            const followerLevels =
              player.holdings.domains.reduce(
                (sum, d) => sum + d.tenants.levels,
                0
              ) +
              player.holdings.cityProperties.reduce(
                (sum, c) => sum + c.tenants.levels,
                0
              ) +
              player.holdings.organizations.reduce(
                (sum, o) => sum + o.followers.levels,
                0
              );
            labor = Math.max(0, labor - Math.floor(followerLevels / 2));
          }

          events.push({
            type: 'PlayerTurnReset',
            visibility: { scope: 'private', playerId: player.id },
            playerId: player.id,
            laborAvailable: labor,
            influenceAvailable: influence,
            actionsUsed: 0,
            actionKeysUsed: [],
            facilityActionUsed: false,
            usedPoliticalSteps: false,
            upkeep: {
              maintainedWorkshopIds: [],
              maintainedStorageIds: [],
              maintainedOfficeIds: [],
              maintainedOrganizationIds: [],
              maintainedTradeEnterpriseIds: [],
              maintainedTroops: false,
            },
          });
        }
      }

      events.push({
        type: 'PhaseAdvanced',
        visibility: { scope: 'public' },
        from,
        to,
        round: nextRound,
      });

      return events;
    }

    case 'GainInfluence': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const baseActionKey =
        command.kind === 'temporary' ? 'influence.temp' : 'influence.perm';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusInfluenceSlots(player);

      const canUseBase =
        !hasUsedCanonicalAction(player, baseActionKey) &&
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;

      if (!canUseBase) {
        let picked: string | null = null;
        for (let i = 1; i <= bonusSlots; i += 1) {
          const bonusKey = `influence.bonus.${i}@bonus.influence.${i}`;
          if (hasUsedCanonicalAction(player, canonicalActionKey(bonusKey)))
            continue;
          picked = bonusKey;
          break;
        }
        if (!picked) {
          // Throws a reasonable error (duplicate vs. no actions).
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
        actionKey = picked!;
        actionCost = 0;
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0)
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');

      // Deckelung (Caps)
      if (command.kind === 'temporary') {
        const hasAnySmall =
          player.holdings.offices.some((o) => o.tier === 'small') ||
          player.holdings.organizations.some((o) => o.tier === 'small');
        const hasAnyMedium =
          player.holdings.offices.some((o) => o.tier === 'medium') ||
          player.holdings.organizations.some((o) => o.tier === 'medium');
        const hasAnyLarge =
          player.holdings.offices.some((o) => o.tier === 'large') ||
          player.holdings.organizations.some((o) => o.tier === 'large');

        const cap = hasAnyLarge ? 12 : hasAnyMedium ? 8 : hasAnySmall ? 6 : 4;
        if (investments > cap) {
          throw new GameRuleError(
            'INPUT',
            `Zu viele Investitionen (max. ${cap}).`
          );
        }
      } else {
        // "Maximal 2 Punkte pro Runde + 1 mal pro Amts/Circelstufe" (Interpretation: Summe der Tier-Ränge aller Ämter + Circel/Collegien)
        const cap =
          2 +
          player.holdings.offices.reduce(
            (sum, o) => sum + postTierRank(o.tier),
            0
          ) +
          player.holdings.organizations.reduce(
            (sum, o) => sum + postTierRank(o.tier),
            0
          );
        if (investments > cap) {
          throw new GameRuleError(
            'INPUT',
            `Zu viele Investitionen (max. ${cap}).`
          );
        }
      }

      const baseDc = 12;
      // Soll (Einflussgewinn): ab 8 Investitionen = mittel (+4 DC), ab 12 = groß (+8 DC)
      const investMod = investments >= 12 ? 8 : investments >= 8 ? 4 : 0;
      const actionSize =
        investments >= 12 ? 'large' : investments >= 8 ? 'medium' : 'small';

      const acc = dcModsInit();
      applySpecialistDcMods(player, acc, { influenceGain: true });

      const influenceMods = moneyActionMods(state.globalEvents, state.round);
      dcModsAdd(acc, influenceMods.influenceDc);
      dcModsAdd(acc, asDcModifier(player.politics.as));

      if (
        actionSize === 'small' &&
        player.holdings.cityProperties.some(
          (c) => c.tier === 'small' && c.mode === 'leased'
        )
      ) {
        dcModsAdd(acc, -1);
      }
      if (
        actionSize === 'medium' &&
        player.holdings.cityProperties.some(
          (c) => c.tier === 'medium' && c.mode === 'leased'
        )
      ) {
        dcModsAdd(acc, -1);
      }
      if (
        actionSize === 'large' &&
        player.holdings.cityProperties.some(
          (c) => c.tier === 'large' && c.mode === 'leased'
        )
      ) {
        dcModsAdd(acc, -1);
      }
      if (
        actionSize === 'small' &&
        player.holdings.offices.some((o) => o.tier === 'small')
      )
        dcModsAdd(acc, -1);
      if (
        actionSize === 'medium' &&
        player.holdings.offices.some((o) => o.tier === 'medium')
      )
        dcModsAdd(acc, -1);
      if (
        actionSize === 'large' &&
        player.holdings.offices.some((o) => o.tier === 'large')
      )
        dcModsAdd(acc, -1);
      const cult = player.holdings.organizations.find((o) => o.kind === 'cult');
      if (cult) dcModsAdd(acc, -postTierRank(cult.tier));

      const dc = dcFinalize(baseDc + investMod, acc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const goldPerInvestment = command.kind === 'temporary' ? 1 : 2;
      const goldSpent = investments * goldPerInvestment;
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      let influenceGained = 0;
      let permanentInc = 0;

      if (command.kind === 'temporary') {
        if (tier === 'veryGood') influenceGained = investments * 8;
        else if (tier === 'good') influenceGained = investments * 6;
        else if (tier === 'success') influenceGained = investments * 4;
        else if (tier === 'poor')
          influenceGained = Math.max(1, investments * 2);
        else influenceGained = 0;
      } else {
        if (tier === 'veryGood') permanentInc = investments * 3;
        else if (tier === 'good') permanentInc = investments * 2;
        else if (tier === 'success') permanentInc = investments;
        else if (tier === 'poor')
          permanentInc = Math.max(1, Math.round(investments * 0.5));
        else permanentInc = 0;
        influenceGained = permanentInc;
      }

      return [
        {
          type: 'PlayerInfluenceGained',
          visibility: { scope: 'private', playerId },
          playerId,
          kind: command.kind,
          investments,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          goldSpent,
          influenceGained,
          permanentInfluenceIncreasedBy:
            command.kind === 'permanent' ? permanentInc : 0,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneyLend': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.lend';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions =
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        // One bonus money action per round (collegium trade, Stufe 3).
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0)
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');

      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const maxTradeTier = Math.max(
        0,
        ...player.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
      );
      const investmentCap =
        maxTradeTier === 0
          ? 2
          : maxTradeTier === 1
            ? 4
            : maxTradeTier === 2
              ? 6
              : 10;
      if (investments > investmentCap) {
        throw new GameRuleError(
          'INPUT',
          `Zu viele Investitionen (max. ${investmentCap}).`
        );
      }

      const actionSize =
        investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      const acc = dcModsInit();
      applySpecialistDcMods(player, acc);
      dcModsAdd(acc, moneyMods.lendDc);
      {
        const requiredRank =
          actionSize === 'small' ? 1 : actionSize === 'medium' ? 2 : 3;
        if (maxTradeTier >= requiredRank) dcModsAdd(acc, -1);
      }
      const collegiumTrade = player.holdings.organizations.find(
        (o) => o.kind === 'collegiumTrade'
      );
      if (collegiumTrade)
        dcModsAdd(acc, -2 * postTierRank(collegiumTrade.tier));
      const dc = dcFinalize(14 + investmentDcModifier(investments), acc);

      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const goldSpent = investments * 2;
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      let goldScheduled = 0;
      if (tier === 'veryGood') goldScheduled = investments * 12;
      else if (tier === 'good') goldScheduled = investments * 8;
      else if (tier === 'success') goldScheduled = investments * 4;
      else if (tier === 'poor')
        goldScheduled = investments; // lose 1 per investment, get 1 back
      else goldScheduled = 0;

      // Event 31: Wirtschaftsaufschwung: Bonusgold je 2 Investitionen.
      if (tier !== 'fail') {
        goldScheduled +=
          Math.floor(investments / 2) * moneyMods.bonusGoldPerTwoInvestments;
      }

      // Event 13: Erträge aus Geldverleih halbiert
      const lendHalved = state.globalEvents.some(
        (e) =>
          state.round >= e.startsAtRound &&
          state.round <= e.endsAtRound &&
          e.tableRollTotal === 13
      );
      if (lendHalved) goldScheduled = Math.floor(goldScheduled / 2);

      return [
        {
          type: 'PlayerMoneyLent',
          visibility: { scope: 'private', playerId },
          playerId,
          investments,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          goldSpent,
          goldScheduled,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneySell': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.sell';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions =
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const marketUsed = marketUsedForPlayerOrThrow(
        state,
        playerId,
        command.marketInstanceId
      );

      const sold: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];

      let investments = 0;
      let baseSaleGold = 0;
      let conversionGold = 0;
      let marketDeltaGold = 0;
      let materialBonusGold = 0;
      const soldMaterialIds = new Set<string>();

      for (const item of command.items) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          if (count > player.turn.laborAvailable)
            throw new GameRuleError('RESOURCES', 'Nicht genug Arbeitskraft.');
          sold.push({ kind: 'labor', count });
          investments += count;
          baseSaleGold += count * 3;
          conversionGold += count / 4;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError(
            'INPUT',
            `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`
          );
        }

        if (item.kind === 'raw') {
          if (count % 6 !== 0) {
            throw new GameRuleError(
              'INPUT',
              'Rohmaterial-Verkauf muss in 6er-Schritten erfolgen.'
            );
          }
          const available = player.economy.inventory.raw[item.materialId] ?? 0;
          if (available < count)
            throw new GameRuleError(
              'RESOURCES',
              `Nicht genug RM: ${item.materialId}.`
            );
          const inv = count / 6;
          sold.push({ kind: 'raw', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          investments += inv;
          baseSaleGold += inv * 3;
          conversionGold +=
            count /
            rawAutoConvertDivisor(
              item.materialId,
              state.globalEvents,
              state.round
            );
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          materialBonusGold += Math.floor(count / 4) * material.saleBonusGold;
          continue;
        }

        // special
        {
          const available =
            player.economy.inventory.special[item.materialId] ?? 0;
          if (available < count)
            throw new GameRuleError(
              'RESOURCES',
              `Nicht genug SM: ${item.materialId}.`
            );
          const inv = count;
          sold.push({ kind: 'special', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          investments += inv;
          baseSaleGold += inv * 3;
          conversionGold += inv * 2;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          materialBonusGold += Math.floor(count / 4) * material.saleBonusGold;
        }
      }

      if (investments <= 0)
        throw new GameRuleError('INPUT', 'Nichts zu verkaufen.');

      // Event-Sale-Boni, die nicht pro Investment über die Markttabellen laufen.
      marketDeltaGold += saleBonusGoldForAction(
        [...soldMaterialIds],
        state.globalEvents,
        state.round
      );

      const capFromTrade = player.holdings.tradeEnterprises.reduce(
        (sum, te) => sum + 2 * postTierRank(te.tier),
        0
      );
      const capFromDomains = player.holdings.domains.reduce(
        // Soll: +1 Investition pro Domänen-Stufe (Klein/Mittel/Groß). Starter-Domäne zählt nicht.
        (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
        0
      );
      const investmentCap = 4 + capFromTrade + capFromDomains;
      if (investments > investmentCap) {
        throw new GameRuleError(
          'INPUT',
          `Zu viele Investitionen (max. ${investmentCap}).`
        );
      }

      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const actionSize =
        investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      const acc = dcModsInit();
      applySpecialistDcMods(player, acc);
      dcModsAdd(acc, moneyMods.sellDc);
      {
        const maxTradeTier = Math.max(
          0,
          ...player.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
        );
        const requiredRank =
          actionSize === 'small' ? 1 : actionSize === 'medium' ? 2 : 3;
        if (maxTradeTier >= requiredRank) dcModsAdd(acc, -1);
      }
      const collegiumTrade = player.holdings.organizations.find(
        (o) => o.kind === 'collegiumTrade'
      );
      if (collegiumTrade)
        dcModsAdd(acc, -2 * postTierRank(collegiumTrade.tier));
      const dc = dcFinalize(14 + investmentDcModifier(investments), acc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const baseGold = (() => {
        switch (tier) {
          case 'veryGood':
            return baseSaleGold + investments * 3;
          case 'good':
            return baseSaleGold + investments * 2;
          case 'success':
            return baseSaleGold;
          case 'poor':
            return conversionGold;
          case 'fail':
            return Math.max(0, conversionGold - 1);
        }
      })();
      // Event 31: Wirtschaftsaufschwung: Bonusgold je 2 Investitionen.
      const bonusGold =
        tier === 'fail'
          ? 0
          : Math.floor(investments / 2) * moneyMods.bonusGoldPerTwoInvestments;
      const goldGainedGross = Math.max(
        0,
        baseGold + bonusGold + marketDeltaGold + materialBonusGold
      );
      const cargoIncident = cargoIncidentForTradeMarket({
        state,
        playerId,
        player,
        marketInstanceId: marketUsed.instanceId,
        investments,
        grossGold: goldGainedGross,
        rng: ctx.rng,
      });
      const goldGained = Math.max(
        0,
        goldGainedGross - (cargoIncident?.lossGold ?? 0)
      );

      return [
        {
          type: 'PlayerMoneySold',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          sold: sold as any,
          marketUsed,
          marketDeltaGold,
          cargoIncident: cargoIncident ?? undefined,
          goldGained,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'MoneySellBuy': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const baseSellKey = 'money.sell';
      let actionKeySell = baseSellKey;
      let actionCostSell = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseSellKey)) {
        ensureActionAvailable(player, state.rules, baseSellKey, 1);
      }

      const hasBaseActions =
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKeySell = `${baseSellKey}@${marker}`;
          actionCostSell = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseSellKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKeySell, actionCostSell);

      const marketUsed = marketUsedForPlayerOrThrow(
        state,
        playerId,
        command.marketInstanceId
      );

      const sold: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];
      let sellInvestments = 0;
      let baseSaleGold = 0;
      let conversionGold = 0;
      let sellMarketDeltaGold = 0;
      let sellMaterialBonusGold = 0;
      const soldMaterialIds = new Set<string>();

      for (const item of command.sellItems) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          if (count > player.turn.laborAvailable)
            throw new GameRuleError('RESOURCES', 'Nicht genug Arbeitskraft.');
          sold.push({ kind: 'labor', count });
          sellInvestments += count;
          baseSaleGold += count * 3;
          conversionGold += count / 4;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError(
            'INPUT',
            `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`
          );
        }

        if (item.kind === 'raw') {
          if (count % 6 !== 0) {
            throw new GameRuleError(
              'INPUT',
              'Rohmaterial-Verkauf muss in 6er-Schritten erfolgen.'
            );
          }
          const available = player.economy.inventory.raw[item.materialId] ?? 0;
          if (available < count)
            throw new GameRuleError(
              'RESOURCES',
              `Nicht genug RM: ${item.materialId}.`
            );
          const inv = count / 6;
          sold.push({ kind: 'raw', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          sellInvestments += inv;
          baseSaleGold += inv * 3;
          conversionGold +=
            count /
            rawAutoConvertDivisor(
              item.materialId,
              state.globalEvents,
              state.round
            );
          sellMarketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          sellMaterialBonusGold +=
            Math.floor(count / 4) * material.saleBonusGold;
          continue;
        }

        // special
        {
          const available =
            player.economy.inventory.special[item.materialId] ?? 0;
          if (available < count)
            throw new GameRuleError(
              'RESOURCES',
              `Nicht genug SM: ${item.materialId}.`
            );
          const inv = count;
          sold.push({ kind: 'special', materialId: item.materialId, count });
          soldMaterialIds.add(item.materialId);
          sellInvestments += inv;
          baseSaleGold += inv * 3;
          conversionGold += inv * 2;
          sellMarketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          sellMaterialBonusGold +=
            Math.floor(count / 4) * material.saleBonusGold;
        }
      }

      if (sellInvestments <= 0)
        throw new GameRuleError('INPUT', 'Nichts zu verkaufen.');

      // Event-Sale-Boni, die nicht pro Investment über die Markttabellen laufen.
      sellMarketDeltaGold += saleBonusGoldForAction(
        [...soldMaterialIds],
        state.globalEvents,
        state.round
      );

      const bought: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];
      let buyInvestments = 0;
      let baseCostGold = 0;
      let buyMarketDeltaGold = 0;
      let buyMaterialDeltaGold = 0;
      let wantsMinorMagicArtifactCount = 0;
      let minorMagicArtifactSectionStartsAtRound: number | null = null;

      for (const item of command.buyItems) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          bought.push({ kind: 'labor', count });
          buyInvestments += count;
          baseCostGold += count * 3;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError(
            'INPUT',
            `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`
          );
        }

        if (item.kind === 'raw') {
          if (count % 6 !== 0) {
            throw new GameRuleError(
              'INPUT',
              'Rohmaterial-Kauf muss in 6er-Schritten erfolgen.'
            );
          }
          const inv = count / 6;
          bought.push({ kind: 'raw', materialId: item.materialId, count });
          buyInvestments += inv;
          baseCostGold += inv * 2;
          buyMarketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          buyMaterialDeltaGold +=
            Math.floor(count / 4) * material.saleBonusGold;
          continue;
        }

        // special
        {
          // Events 14/19: "Chance auf magisches Artefakt zum Verkauf (1-5 auf w20)".
          if (item.materialId === 'special.minorMagicArtifacts') {
            wantsMinorMagicArtifactCount += count;
            if (count !== 1) {
              throw new GameRuleError(
                'RULE',
                'Mindere magische Artefakte können nur einzeln gekauft werden (count=1).'
              );
            }
            const saleEvent = state.globalEvents.find(
              (e) =>
                state.round >= e.startsAtRound &&
                state.round <= e.endsAtRound &&
                (e.tableRollTotal === 14 || e.tableRollTotal === 19) &&
                (e.meta as any)?.artifactForSaleTriggered === true
            );
            if (!saleEvent) {
              throw new GameRuleError(
                'RULE',
                'Mindere magische Artefakte sind aktuell nicht zum Kauf verfügbar (nur bei Event 14/19 und 1-5 auf w20).'
              );
            }
            minorMagicArtifactSectionStartsAtRound = saleEvent.startsAtRound;
          }
          const inv = count;
          bought.push({ kind: 'special', materialId: item.materialId, count });
          buyInvestments += inv;
          baseCostGold += inv * 3;
          buyMarketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          buyMaterialDeltaGold +=
            Math.floor(count / 4) * material.saleBonusGold;
        }
      }

      if (wantsMinorMagicArtifactCount > 1) {
        throw new GameRuleError(
          'RULE',
          'Mindere magische Artefakte können pro Aktion nur einmal gekauft werden.'
        );
      }
      if (wantsMinorMagicArtifactCount > 0) {
        if (minorMagicArtifactSectionStartsAtRound == null) {
          throw new GameRuleError(
            'STATE',
            'Interner Fehler: Abschnittsstart für Artefakt-Verkauf fehlt.'
          );
        }
        const incidents = player.eventIncidents;
        const key = '14:artifactPurchase';
        const already =
          incidents && incidents.sectionStartsAtRound === minorMagicArtifactSectionStartsAtRound
            ? Math.max(0, Math.trunc(incidents.countsByKey[key] ?? 0))
            : 0;
        if (already >= 1) {
          throw new GameRuleError(
            'RULE',
            'Du hast in diesem Abschnitt bereits ein magisches Artefakt gekauft.'
          );
        }
      }

      const capFromTrade = player.holdings.tradeEnterprises.reduce(
        (sum, te) => sum + 2 * postTierRank(te.tier),
        0
      );
      const capFromDomains = player.holdings.domains.reduce(
        // Soll: +1 Investition pro Domänen-Stufe (Klein/Mittel/Groß). Starter-Domäne zählt nicht.
        (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
        0
      );
      const investmentCap = 4 + capFromTrade + capFromDomains;
      const totalInvestments = sellInvestments + buyInvestments;
      if (totalInvestments > investmentCap) {
        throw new GameRuleError(
          'INPUT',
          `Zu viele Investitionen (max. ${investmentCap}).`
        );
      }

      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const actionSize =
        totalInvestments >= 8
          ? 'large'
          : totalInvestments >= 4
            ? 'medium'
            : 'small';
      const acc = dcModsInit();
      applySpecialistDcMods(player, acc);
      dcModsAdd(acc, moneyMods.sellDc);
      {
        const maxTradeTier = Math.max(
          0,
          ...player.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
        );
        const requiredRank =
          actionSize === 'small' ? 1 : actionSize === 'medium' ? 2 : 3;
        if (maxTradeTier >= requiredRank) dcModsAdd(acc, -1);
      }
      const collegiumTrade = player.holdings.organizations.find(
        (o) => o.kind === 'collegiumTrade'
      );
      if (collegiumTrade)
        dcModsAdd(acc, -2 * postTierRank(collegiumTrade.tier));
      const dc = dcFinalize(14 + investmentDcModifier(totalInvestments), acc);

      const sellRoll = rollD20(ctx.rng);
      const sellMod = effectiveCheck(player.checks.money, state.round);
      const sellTotal = sellRoll.total + sellMod;
      const sellTier = resolveSuccessTier(dc, sellTotal);

      const baseGold = (() => {
        switch (sellTier) {
          case 'veryGood':
            return baseSaleGold + sellInvestments * 3;
          case 'good':
            return baseSaleGold + sellInvestments * 2;
          case 'success':
            return baseSaleGold;
          case 'poor':
            return conversionGold;
          case 'fail':
            return Math.max(0, conversionGold - 1);
        }
      })();
      // Event 31: Wirtschaftsaufschwung: Bonusgold je 2 Investitionen.
      const bonusGold =
        sellTier === 'fail'
          ? 0
          : Math.floor(sellInvestments / 2) *
            moneyMods.bonusGoldPerTwoInvestments;
      const goldGainedGross = Math.max(
        0,
        baseGold + bonusGold + sellMarketDeltaGold + sellMaterialBonusGold
      );
      const cargoIncident = cargoIncidentForTradeMarket({
        state,
        playerId,
        player,
        marketInstanceId: marketUsed.instanceId,
        investments: sellInvestments,
        grossGold: goldGainedGross,
        rng: ctx.rng,
      });
      const goldGained = Math.max(
        0,
        goldGainedGross - (cargoIncident?.lossGold ?? 0)
      );

      let buyEvent: Extract<GameEvent, { type: 'PlayerMoneyBought' }> | null =
        null;
      let didBuyMinorMagicArtifact = false;
      if (buyInvestments > 0) {
        const buyKey = 'money.buy@bundle';
        ensureActionAvailable(player, state.rules, buyKey, 0);

        const buyRoll = rollD20(ctx.rng);
        const buyMod = effectiveCheck(player.checks.money, state.round);
        const buyTotal = buyRoll.total + buyMod;
        const buyTier = resolveSuccessTier(dc, buyTotal);

        const minTotalGold = buyInvestments; // min. 1 Gold pro Investment
        const baseCostAdjusted = (() => {
          switch (buyTier) {
            case 'veryGood':
              return baseCostGold - buyInvestments * 4;
            case 'good':
              return baseCostGold - buyInvestments * 2;
            case 'success':
              return baseCostGold;
            case 'poor':
              return baseCostGold + buyInvestments * 1;
            case 'fail':
              return baseCostGold;
          }
        })();

        const goldSpent = Math.max(
          minTotalGold,
          baseCostAdjusted + buyMarketDeltaGold + buyMaterialDeltaGold
        );

        const goldAfterSale = player.economy.gold + goldGained;
        if (goldSpent > goldAfterSale)
          throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

        buyEvent = {
          type: 'PlayerMoneyBought',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll: buyRoll,
          rollModifier: buyMod,
          rollTotal: buyTotal,
          tier: buyTier,
          bought: buyTier === 'fail' ? [] : (bought as any),
          marketUsed,
          marketDeltaGold: buyMarketDeltaGold,
          goldSpent,
          actionCost: 0,
          actionKey: buyKey,
        };
        didBuyMinorMagicArtifact =
          buyTier !== 'fail' && wantsMinorMagicArtifactCount > 0;
      }

      const events: GameEvent[] = [
        {
          type: 'PlayerMoneySold',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll: sellRoll,
          rollModifier: sellMod,
          rollTotal: sellTotal,
          tier: sellTier,
          sold: sold as any,
          marketUsed,
          marketDeltaGold: sellMarketDeltaGold,
          cargoIncident: cargoIncident ?? undefined,
          goldGained,
          actionCost: actionCostSell,
          actionKey: actionKeySell,
        },
      ];
      if (buyEvent) events.push(buyEvent);
      if (didBuyMinorMagicArtifact) {
        events.push({
          type: 'PlayerEventIncidentRecorded',
          visibility: { scope: 'private', playerId },
          playerId,
          sectionStartsAtRound: minorMagicArtifactSectionStartsAtRound ?? state.round,
          tableRollTotal: 14,
          incidentKind: 'artifactPurchase',
          countDelta: 1,
          reason: 'Magisches Artefakt gekauft',
        });
      }
      return events;
    }

    case 'MoneyBuy': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey = 'money.buy';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMoneySlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions =
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.money.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const marketUsed = marketUsedForPlayerOrThrow(
        state,
        playerId,
        command.marketInstanceId
      );

      const bought: Array<
        | { kind: 'labor'; count: number }
        | { kind: MaterialKind; materialId: string; count: number }
      > = [];

      let investments = 0;
      let baseCostGold = 0;
      let marketDeltaGold = 0;
      let materialDeltaGold = 0;
      let wantsMinorMagicArtifactCount = 0;
      let minorMagicArtifactSectionStartsAtRound: number | null = null;

      for (const item of command.items) {
        const count = Math.trunc(item.count);
        if (count <= 0) continue;

        if (item.kind === 'labor') {
          bought.push({ kind: 'labor', count });
          investments += count;
          baseCostGold += count * 3;
          continue;
        }

        const material = getMaterialOrThrow(item.materialId);
        if (material.kind !== item.kind) {
          throw new GameRuleError(
            'INPUT',
            `Material ${item.materialId} ist nicht vom Typ ${item.kind}.`
          );
        }

        if (item.kind === 'raw') {
          if (count % 6 !== 0) {
            throw new GameRuleError(
              'INPUT',
              'Rohmaterial-Kauf muss in 6er-Schritten erfolgen.'
            );
          }
          const inv = count / 6;
          bought.push({ kind: 'raw', materialId: item.materialId, count });
          investments += inv;
          baseCostGold += inv * 2;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          materialDeltaGold += Math.floor(count / 4) * material.saleBonusGold;
          continue;
        }

        // special
        {
          // Events 14/19: "Chance auf magisches Artefakt zum Verkauf (1-5 auf w20)".
          if (item.materialId === 'special.minorMagicArtifacts') {
            wantsMinorMagicArtifactCount += count;
            if (count !== 1) {
              throw new GameRuleError(
                'RULE',
                'Mindere magische Artefakte können nur einzeln gekauft werden (count=1).'
              );
            }
            const saleEvent = state.globalEvents.find(
              (e) =>
                state.round >= e.startsAtRound &&
                state.round <= e.endsAtRound &&
                (e.tableRollTotal === 14 || e.tableRollTotal === 19) &&
                (e.meta as any)?.artifactForSaleTriggered === true
            );
            if (!saleEvent) {
              throw new GameRuleError(
                'RULE',
                'Mindere magische Artefakte sind aktuell nicht zum Kauf verfügbar (nur bei Event 14/19 und 1-5 auf w20).'
              );
            }
            minorMagicArtifactSectionStartsAtRound = saleEvent.startsAtRound;
          }
          const inv = count;
          bought.push({ kind: 'special', materialId: item.materialId, count });
          investments += inv;
          baseCostGold += inv * 3;
          marketDeltaGold +=
            inv *
            (marketModifierPerInvestment(
              state,
              marketUsed.instanceId,
              item.materialId
            ) +
              marketDeltaPerInvestment(
                item.materialId,
                state.globalEvents,
                state.round
              ));
          materialDeltaGold += Math.floor(count / 4) * material.saleBonusGold;
        }
      }

      if (investments <= 0)
        throw new GameRuleError('INPUT', 'Nichts zu kaufen.');

      if (wantsMinorMagicArtifactCount > 1) {
        throw new GameRuleError(
          'RULE',
          'Mindere magische Artefakte können pro Aktion nur einmal gekauft werden.'
        );
      }
      if (wantsMinorMagicArtifactCount > 0) {
        if (minorMagicArtifactSectionStartsAtRound == null) {
          throw new GameRuleError(
            'STATE',
            'Interner Fehler: Abschnittsstart für Artefakt-Verkauf fehlt.'
          );
        }
        const incidents = player.eventIncidents;
        const key = '14:artifactPurchase';
        const already =
          incidents && incidents.sectionStartsAtRound === minorMagicArtifactSectionStartsAtRound
            ? Math.max(0, Math.trunc(incidents.countsByKey[key] ?? 0))
            : 0;
        if (already >= 1) {
          throw new GameRuleError(
            'RULE',
            'Du hast in diesem Abschnitt bereits ein magisches Artefakt gekauft.'
          );
        }
      }

      const capFromTrade = player.holdings.tradeEnterprises.reduce(
        (sum, te) => sum + 2 * postTierRank(te.tier),
        0
      );
      const capFromDomains = player.holdings.domains.reduce(
        // Soll: +1 Investition pro Domänen-Stufe (Klein/Mittel/Groß). Starter-Domäne zählt nicht.
        (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
        0
      );
      const investmentCap = 4 + capFromTrade + capFromDomains;
      if (investments > investmentCap) {
        throw new GameRuleError(
          'INPUT',
          `Zu viele Investitionen (max. ${investmentCap}).`
        );
      }

      const actionSize =
        investments >= 8 ? 'large' : investments >= 4 ? 'medium' : 'small';
      const moneyMods = moneyActionMods(state.globalEvents, state.round);
      const acc = dcModsInit();
      applySpecialistDcMods(player, acc);
      dcModsAdd(acc, moneyMods.sellDc);
      {
        const maxTradeTier = Math.max(
          0,
          ...player.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
        );
        const requiredRank =
          actionSize === 'small' ? 1 : actionSize === 'medium' ? 2 : 3;
        if (maxTradeTier >= requiredRank) dcModsAdd(acc, -1);
      }
      const collegiumTrade = player.holdings.organizations.find(
        (o) => o.kind === 'collegiumTrade'
      );
      if (collegiumTrade)
        dcModsAdd(acc, -2 * postTierRank(collegiumTrade.tier));
      const dc = dcFinalize(14 + investmentDcModifier(investments), acc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.money, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      const minTotalGold = investments; // min. 1 Gold pro Investment
      const baseCostAdjusted = (() => {
        switch (tier) {
          case 'veryGood':
            return baseCostGold - investments * 4;
          case 'good':
            return baseCostGold - investments * 2;
          case 'success':
            return baseCostGold;
          case 'poor':
            return baseCostGold + investments * 1;
          case 'fail':
            return baseCostGold;
        }
      })();

      const goldSpent = Math.max(
        minTotalGold,
        baseCostAdjusted + marketDeltaGold + materialDeltaGold
      );

      const finalBought = tier === 'fail' ? [] : bought;
      if (goldSpent > player.economy.gold)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      const events: GameEvent[] = [
        {
          type: 'PlayerMoneyBought',
          visibility: { scope: 'private', playerId },
          playerId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          bought: finalBought as any,
          marketUsed,
          marketDeltaGold,
          goldSpent,
          actionCost,
          actionKey,
        },
      ];
      if (tier !== 'fail' && wantsMinorMagicArtifactCount > 0) {
        events.push({
          type: 'PlayerEventIncidentRecorded',
          visibility: { scope: 'private', playerId },
          playerId,
          sectionStartsAtRound: minorMagicArtifactSectionStartsAtRound ?? state.round,
          tableRollTotal: 14,
          incidentKind: 'artifactPurchase',
          countDelta: 1,
          reason: 'Magisches Artefakt gekauft',
        });
      }
      return events;
    }

    case 'GainMaterials': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const baseActionKey =
        command.mode === 'domainAdministration'
          ? 'materials.domain'
          : 'materials.workshop';
      let actionKey = baseActionKey;
      let actionCost = 1;
      const bonusSlots = bonusMaterialsSlots(player);

      if (hasUsedCanonicalAction(player, baseActionKey)) {
        ensureActionAvailable(player, state.rules, baseActionKey, 1);
      }

      const hasBaseActions =
        player.turn.actionsUsed + 1 <= state.rules.actionsPerRound;
      if (!hasBaseActions && bonusSlots > 0) {
        const marker = 'bonus.materials.1';
        if (!hasUsedBonusMarker(player, marker)) {
          actionKey = `${baseActionKey}@${marker}`;
          actionCost = 0;
        } else {
          ensureActionAvailable(player, state.rules, baseActionKey, 1);
        }
      }

      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      const investments = Math.trunc(command.investments);
      if (investments <= 0)
        throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
      if (player.turn.laborAvailable < investments)
        throw new GameRuleError('FUNDS', 'Nicht genug Arbeitskraft.');

      const baseDc = command.mode === 'domainAdministration' ? 10 : 12;
      // Soll (Materialgewinn): ab 8 Investitionen = mittel (+4 DC), ab 12 = groß (+8 DC)
      const investMod = investments >= 12 ? 8 : investments >= 8 ? 4 : 0;
      const actionSize =
        investments >= 12 ? 'large' : investments >= 8 ? 'medium' : 'small';

      const acc = dcModsInit();
      applySpecialistDcMods(player, acc);
      const collegiumCraft = player.holdings.organizations.find(
        (o) => o.kind === 'collegiumCraft'
      );
      if (collegiumCraft)
        dcModsAdd(acc, -2 * postTierRank(collegiumCraft.tier));

      const pickDomainOrThrow = () => {
        if (command.targetId) {
          const d = player.holdings.domains.find(
            (x) => x.id === command.targetId
          );
          if (!d) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
          return d;
        }
        if (player.holdings.domains.length === 1)
          return player.holdings.domains[0];
        throw new GameRuleError(
          'INPUT',
          'targetId erforderlich (mehrere Domänen vorhanden).'
        );
      };

      const pickWorkshopOrThrow = () => {
        if (command.targetId) {
          const w = player.holdings.workshops.find(
            (x) => x.id === command.targetId
          );
          if (!w) throw new GameRuleError('INPUT', 'Unbekannte Werkstatt.');
          return w;
        }
        if (player.holdings.workshops.length === 1)
          return player.holdings.workshops[0];
        throw new GameRuleError(
          'INPUT',
          'targetId erforderlich (mehrere Werkstätten vorhanden).'
        );
      };

      if (command.mode === 'domainAdministration') {
        const domain = pickDomainOrThrow();
        const rank = domain.tier === 'starter' ? 1 : postTierRank(domain.tier);
        const investmentCap = 4 * rank;
        if (investments > investmentCap) {
          throw new GameRuleError(
            'INPUT',
            `Zu viele Investitionen (max. ${investmentCap}).`
          );
        }
        // Domänen-Vorteil: Senkt Materialgewinn-DC je nach Aktionsgröße um 1.
        if (actionSize === 'small' && domain.tier === 'small')
          dcModsAdd(acc, -1);
        if (actionSize === 'medium' && domain.tier === 'medium')
          dcModsAdd(acc, -1);
        if (actionSize === 'large' && domain.tier === 'large')
          dcModsAdd(acc, -1);
      } else {
        const workshop = pickWorkshopOrThrow();
        const investmentCap = 2 * postTierRank(workshop.tier);
        if (investments > investmentCap) {
          throw new GameRuleError(
            'INPUT',
            `Zu viele Investitionen (max. ${investmentCap}).`
          );
        }
      }

      const dc = dcFinalize(baseDc + investMod, acc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.materials, state.round);
      const total = roll.total + mod;
      const tier = resolveSuccessTier(dc, total);

      let perInvRaw = 0;
      let perInvSpecial = 0;
      if (command.mode === 'domainAdministration') {
        if (tier === 'veryGood') perInvRaw = 16;
        else if (tier === 'good') perInvRaw = 12;
        else if (tier === 'success') perInvRaw = 8;
        else if (tier === 'poor') perInvRaw = 1;
        else perInvRaw = 0;
      } else {
        if (tier === 'veryGood') perInvSpecial = 4;
        else if (tier === 'good') perInvSpecial = 3;
        else if (tier === 'success') perInvSpecial = 2;
        else if (tier === 'poor') perInvSpecial = 0.5;
        else perInvSpecial = 0;
      }

      const rawGained: MaterialStock = {};
      const specialGained: MaterialStock = {};
      if (perInvRaw) {
        const totalRaw = investments * perInvRaw;
        const domain = pickDomainOrThrow();
        const picks = safeDomainRawPicks(domain);
        const distributed = distributeRawAcrossPicks(totalRaw, picks);
        for (const [materialId, amount] of Object.entries(distributed)) {
          rawGained[materialId] = (rawGained[materialId] ?? 0) + amount;
        }
      }
      if (perInvSpecial) {
        const workshop = pickWorkshopOrThrow();
        const baseOutputId = workshop.outputMaterialId;
        const outMat = getMaterialOrThrow(baseOutputId);
        if (outMat.kind === 'raw') {
          // Wenn die Werkstatt auf verbesserte RM läuft, bilden wir Werkstattüberwachung als "Output in RM" ab.
          // Heuristik (v1): 1 SM ≙ 4 RM Output.
          const totalRawOut = Math.floor(investments * perInvSpecial * 4);
          if (totalRawOut > 0) {
            rawGained[baseOutputId] =
              (rawGained[baseOutputId] ?? 0) + totalRawOut;
          }
        } else {
          const steps = refinementStepsForLocation(player, workshop.location);
          const outputId = refineSpecialMaterialId(baseOutputId, steps);
          specialGained[outputId] =
            (specialGained[outputId] ?? 0) +
            Math.floor(investments * perInvSpecial);
        }
      }

      // Fachkraft-Charaktertabelle: Energisch (+2 RM/SM Gewinn)
      if (tier !== 'fail') {
        const bonus = specialistMaterialsActionBonus(player, command.mode);
        if (bonus.rawBonus > 0) {
          const key =
            Object.keys(rawGained)[0] ??
            (command.mode === 'domainAdministration'
              ? (domainPrimaryRawPick(pickDomainOrThrow()) ?? undefined)
              : undefined);
          if (key) rawGained[key] = (rawGained[key] ?? 0) + bonus.rawBonus;
        }
        if (bonus.specialBonus > 0) {
          const key = Object.keys(specialGained)[0];
          if (key) {
            specialGained[key] = (specialGained[key] ?? 0) + bonus.specialBonus;
          } else {
            const rawKey = Object.keys(rawGained)[0];
            if (rawKey)
              rawGained[rawKey] =
                (rawGained[rawKey] ?? 0) + bonus.specialBonus * 4;
          }
        }
      }

      return [
        {
          type: 'PlayerMaterialsGained',
          visibility: { scope: 'private', playerId },
          playerId,
          mode: command.mode,
          investments,
          targetId: command.targetId,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tier,
          laborSpent: investments,
          rawGained,
          specialGained,
          actionCost,
          actionKey,
        },
      ];
    }

    case 'AcquireDomain': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.domain';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: Exclude<DomainTier, 'starter'> = command.tier;
      const tierCount = player.holdings.domains.filter(
        (d) => d.tier === tier
      ).length;
      if (tierCount >= 4) {
        throw new GameRuleError(
          'RULE',
          `Zu viele Domänen der Größe ${tier} (max. 4).`
        );
      }
      const baseCost = tier === 'small' ? 30 : tier === 'medium' ? 80 : 140;
      const baseDc = actionDcForAcquire(10, tier);
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      dcModsAdd(dcAcc, asDcModifier(player.politics.as));
      const dc = dcFinalize(baseDc, dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);
      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const domainId = generateId('domain', player.holdings.domains);
      const goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      const rawPicks = normalizeDomainRawPicks(command.rawPicks, tier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      return [
        {
          type: 'PlayerDomainAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId,
          tier,
          rawPicks,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'AcquireCityProperty': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.cityProperty';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: CityPropertyTier = command.tier;
      const tenure = command.tenure ?? 'owned';
      const tierCount = player.holdings.cityProperties.filter(
        (c) => c.tier === tier
      ).length;
      if (tierCount >= 4) {
        throw new GameRuleError(
          'RULE',
          `Zu viele städtische Besitze der Größe ${tier} (max. 4).`
        );
      }
      let baseCost = tier === 'small' ? 12 : tier === 'medium' ? 25 : 60;

      // Event 30: Große Feuersbrunst in der Stadt → Bei 1-5 auf w20 Preis für Städtischen Besitz halbiert (1 Runde).
      const fireDiscountActive = state.globalEvents.some(
        (e) =>
          state.round >= e.startsAtRound &&
          state.round <= e.endsAtRound &&
          e.tableRollTotal === 30
      );
      if (fireDiscountActive) {
        const discountRoll = rollD20(ctx.rng);
        if (discountRoll.total <= 5) baseCost = Math.floor(baseCost / 2);
      }

      // Soll: Gepachtet = halbe Kosten, DC -2, aber +1 Gold Pacht-Unterhalt pro Runde (im Upkeep abgebildet).
      if (tenure === 'pacht') {
        baseCost = Math.floor(baseCost / 2);
      }

      const baseDc = actionDcForAcquire(tenure === 'pacht' ? 8 : 10, tier);
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      dcModsAdd(dcAcc, asDcModifier(player.politics.as));
      const dc = dcFinalize(baseDc, dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);
      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const cityPropertyId = generateId('city', player.holdings.cityProperties);
      const goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      return [
        {
          type: 'PlayerCityPropertyAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          cityPropertyId,
          tier,
          tenure,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetCityPropertyMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerCityPropertyModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          cityPropertyId: command.cityPropertyId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireOffice': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.office';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier: PostTier = command.tier;
      const smallCount = player.holdings.offices.filter(
        (o) => o.tier === 'small'
      ).length;
      const mediumCount = player.holdings.offices.filter(
        (o) => o.tier === 'medium'
      ).length;
      const largeCount = player.holdings.offices.filter(
        (o) => o.tier === 'large'
      ).length;
      const smallCap = 8 + mediumCount * 2 + largeCount * 4;
      if (tier === 'small' && smallCount >= smallCap) {
        throw new GameRuleError(
          'RULE',
          `Zu viele kleine Ämter (max. ${smallCap}).`
        );
      }
      if (tier === 'medium' && mediumCount >= 4) {
        throw new GameRuleError('RULE', 'Zu viele mittlere Ämter (max. 4).');
      }
      if (tier === 'large' && largeCount >= 4) {
        throw new GameRuleError('RULE', 'Zu viele große Ämter (max. 4).');
      }
      if (tier === 'medium') {
        if (smallCount < 2)
          throw new GameRuleError(
            'RULE',
            'Für ein mittleres Amt werden 2 kleine Ämter benötigt.'
          );
      }
      if (tier === 'large') {
        if (mediumCount < 2)
          throw new GameRuleError(
            'RULE',
            'Für ein großes Amt werden 2 mittlere Ämter benötigt.'
          );
      }

      // Soll: DC 14, +2 DC pro Stufe über Klein.
      const baseDc = 14 + (tier === 'medium' ? 2 : tier === 'large' ? 4 : 0);
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      dcModsAdd(dcAcc, asDcModifier(player.politics.as));
      // Amtsvorteile: Senkt DC für Posten gewinnen bei nächster Amtsstufe um 1.
      if (
        tier === 'medium' &&
        player.holdings.offices.some((o) => o.tier === 'small')
      )
        dcModsAdd(dcAcc, -1);
      if (
        tier === 'large' &&
        player.holdings.offices.some((o) => o.tier === 'medium')
      )
        dcModsAdd(dcAcc, -1);
      const dc = dcFinalize(baseDc, dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const cost =
        tier === 'small'
          ? { goldA: 10, infA: 4, goldB: 4, infB: 10 }
          : tier === 'medium'
            ? { goldA: 20, infA: 10, goldB: 10, infB: 20 }
            : { goldA: 80, infA: 20, goldB: 20, infB: 80 };
      const baseGold =
        command.payment === 'goldFirst' ? cost.goldA : cost.goldB;
      const baseInfluence =
        command.payment === 'goldFirst' ? cost.infA : cost.infB;
      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseGold * costMultiplier);
      const influenceSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseInfluence * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (
        tierResult !== 'fail' &&
        player.turn.influenceAvailable < influenceSpent
      )
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      const officeId = generateId('office', player.holdings.offices);

      return [
        {
          type: 'PlayerOfficeAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          officeId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetOfficeYieldMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const office = player.holdings.offices.find((o) => o.id === command.officeId);
      if (!office) throw new GameRuleError('INPUT', 'Unbekanntes Amt.');

      // Soll: Split-Ertrag ist nur mit "Administrative Reformen" möglich.
      if (command.mode === 'split') {
        const hasAdministrativeReforms = player.holdings.offices.some((o) => {
          for (const f of o.facilities)
            if (f.key === 'general.medium.office.administrativeReforms') return true;
          for (const f of o.specialization?.facilities ?? [])
            if (f.key === 'general.medium.office.administrativeReforms') return true;
          return false;
        });
        if (!hasAdministrativeReforms) {
          throw new GameRuleError(
            'RULE',
            'Split-Ertrag erfordert die Amtseinrichtung "Administrative Reformen".'
          );
        }
      }
      return [
        {
          type: 'PlayerOfficeYieldModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          officeId: command.officeId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireOrganization': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = `acquire.org.${command.kind}`;
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const existing = player.holdings.organizations.find(
        (o) => o.kind === command.kind
      );
      const fromTier: PostTier = existing?.tier ?? 'small';
      const toTier: PostTier = existing
        ? existing.tier === 'small'
          ? 'medium'
          : 'large'
        : 'small';
      if (existing && existing.tier === 'large')
        throw new GameRuleError('STATE', 'Bereits auf maximaler Stufe.');

      // HQ-Anforderung: pro Stufe des Circels braucht man einen Stadtbesitz entsprechender Größe.
      const requiredHqTier = postTierRank(toTier);
      const maxCityTier = Math.max(
        0,
        ...player.holdings.cityProperties.map((c) => postTierRank(c.tier))
      );
      if (maxCityTier < requiredHqTier) {
        throw new GameRuleError(
          'RULE',
          `Für Stufe ${toTier} wird ein Städtischer Besitz der Größe ${toTier} als Hauptquartier benötigt.`
        );
      }

      // Soll: DC 14, +2 DC pro Stufe über Klein (gilt auch für Collegien).
      const baseDc =
        14 + (toTier === 'medium' ? 2 : toTier === 'large' ? 4 : 0);
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      dcModsAdd(dcAcc, asDcModifier(player.politics.as));
      const dc = dcFinalize(baseDc, dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const baseCost = (() => {
        switch (command.kind) {
          case 'underworld':
            return { gold: 12, influence: 4 };
          case 'spy':
            return { gold: 16, influence: 6 };
          case 'cult':
            return { gold: 8, influence: 8 };
          case 'collegiumTrade':
          case 'collegiumCraft':
            return { gold: 20, influence: 2 };
        }
      })();
      const rank = postTierRank(toTier);
      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const goldSpent =
        tierResult === 'fail'
          ? 0
          : Math.ceil(baseCost.gold * rank * costMultiplier);
      const influenceSpent =
        tierResult === 'fail'
          ? 0
          : Math.ceil(baseCost.influence * rank * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (
        tierResult !== 'fail' &&
        player.turn.influenceAvailable < influenceSpent
      )
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      const organizationId =
        existing?.id ?? generateId('org', player.holdings.organizations);

      return [
        {
          type: 'PlayerOrganizationAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          organizationId,
          kind: command.kind,
          fromTier,
          toTier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'AcquireTradeEnterprise': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.trade';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const tier = command.tier;
      const tierCount = player.holdings.tradeEnterprises.filter(
        (t) => t.tier === tier
      ).length;
      if (tierCount >= 4) {
        throw new GameRuleError(
          'RULE',
          `Zu viele Handelsunternehmungen der Größe ${tier} (max. 4).`
        );
      }
      // 🧩 Regeltext nennt keine Kaufkosten für Handelsunternehmungen; v1-Interpretation:
      // Klein/Mittel/Groß: 20/40/80 Gold.
      const baseCost = tier === 'small' ? 20 : tier === 'medium' ? 40 : 80;
      const baseDc = actionDcForAcquire(10, tier);
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      dcModsAdd(dcAcc, asDcModifier(player.politics.as));
      const dc = dcFinalize(baseDc, dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseCost * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const tradeEnterpriseId = generateId(
        'trade',
        player.holdings.tradeEnterprises
      );
      return [
        {
          type: 'PlayerTradeEnterpriseAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          tradeEnterpriseId,
          tier,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'SetTradeEnterpriseMode': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerTradeEnterpriseModeSet',
          visibility: { scope: 'private', playerId },
          playerId,
          tradeEnterpriseId: command.tradeEnterpriseId,
          mode: command.mode,
        },
      ];
    }

    case 'AcquireTenants': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = 'acquire.tenants';
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const levels = Math.trunc(command.levels);
      if (levels <= 0)
        throw new GameRuleError('INPUT', 'levels muss > 0 sein.');

      const location = command.location;
      let currentLevels = 0;
      let maxLevels = 0;
      let goldPerLevel = 12;
      let influencePerLevel = 4;

      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find(
          (d) => d.id === location.id
        );
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter') {
          throw new GameRuleError(
            'RULE',
            'Auf Starter-Domänen können keine Pächter angeworben werden (erst ausbauen).'
          );
        }
        currentLevels = domain.tenants.levels;
        maxLevels =
          domain.tier === 'small' ? 2 : domain.tier === 'medium' ? 4 : 8;
      } else if (location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find(
          (c) => c.id === location.id
        );
        if (!city)
          throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        currentLevels = city.tenants.levels;
        const baseCap =
          city.tier === 'small' ? 2 : city.tier === 'medium' ? 3 : 4;
        const insulaeCount = city.facilities.filter(
          (f) => f.key === 'general.medium.city.insulae'
        ).length;
        maxLevels = baseCap + 2 * insulaeCount;
      } else {
        const org = player.holdings.organizations.find(
          (o) => o.id === location.id
        );
        if (!org)
          throw new GameRuleError('INPUT', 'Unbekannter Circel/Organisation.');
        if (org.kind === 'spy')
          throw new GameRuleError(
            'RULE',
            'Spionageringe haben keine Anhänger.'
          );

        currentLevels = org.followers.levels;

        const tierRank = postTierRank(org.tier);
        if (org.kind === 'underworld') {
          maxLevels = 2 * tierRank; // 2/4/6
          goldPerLevel = 12;
          influencePerLevel = 4;
        } else if (org.kind === 'cult') {
          maxLevels = tierRank === 1 ? 2 : tierRank === 2 ? 4 : 8;
          goldPerLevel = 8;
          influencePerLevel = 8;
        } else {
          // Collegien: Standardkosten, Cap = 1/2/3
          maxLevels = tierRank;
        }
      }

      if (currentLevels + levels > maxLevels) {
        throw new GameRuleError(
          'RULE',
          `Zu viele Stufen (max. ${maxLevels}, aktuell: ${currentLevels}).`
        );
      }

      // Kosten (Events können diese verändern)
      let baseGold = levels * goldPerLevel;
      let baseInfluence = levels * influencePerLevel;

      // Event 11: Gute Ernte → Pächterstufen sind um die Hälfte verbilligt (Interpretation: Gold+Einfluss, nur Domäne/Stadt).
      const hasGoodHarvest = state.globalEvents.some(
        (e) =>
          state.round >= e.startsAtRound &&
          state.round <= e.endsAtRound &&
          e.tableRollTotal === 11
      );
      if (
        hasGoodHarvest &&
        (location.kind === 'domain' || location.kind === 'cityProperty')
      ) {
        baseGold = Math.ceil(baseGold / 2);
        baseInfluence = Math.ceil(baseInfluence / 2);
      }

      const baseDc = 14;
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      const dc = dcFinalize(baseDc + investmentDcModifier(levels), dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;
      const goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseGold * costMultiplier);
      const influenceSpent =
        tierResult === 'fail' ? 0 : Math.ceil(baseInfluence * costMultiplier);
      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (
        tierResult !== 'fail' &&
        player.turn.influenceAvailable < influenceSpent
      )
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      return [
        {
          type: 'PlayerTenantsAcquired',
          visibility: { scope: 'private', playerId },
          playerId,
          location,
          levels,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'RecruitTroops': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');
      const actionKey = `troops.${command.troopKind}`;
      ensureActionAvailable(player, state.rules, actionKey, 1);

      const levels = Math.trunc(command.levels);
      if (levels <= 0)
        throw new GameRuleError('INPUT', 'levels muss > 0 sein.');

      const current =
        command.troopKind === 'bodyguard'
          ? player.holdings.troops.bodyguardLevels
          : command.troopKind === 'militia'
            ? player.holdings.troops.militiaLevels
            : command.troopKind === 'mercenary'
              ? player.holdings.troops.mercenaryLevels
              : player.holdings.troops.thugLevels;

      const maxBodyguard =
        3 +
        player.holdings.offices.reduce(
          (sum, o) =>
            sum + (o.tier === 'small' ? 1 : o.tier === 'medium' ? 3 : 4),
          0
        );
      const maxMilitia = player.holdings.domains.reduce(
        (sum, d) =>
          sum +
          (d.tier === 'small'
            ? 2
            : d.tier === 'medium'
              ? 4
              : d.tier === 'large'
                ? 8
                : 0),
        0
      );
      const maxMercenary = 4;
      const maxThug =
        player.holdings.cityProperties.reduce(
          (sum, c) =>
            sum + (c.tier === 'small' ? 1 : c.tier === 'medium' ? 2 : 3),
          0
        ) +
        player.holdings.organizations.reduce(
          (sum, o) =>
            o.kind === 'underworld' || o.kind === 'cult'
              ? sum + 2 * postTierRank(o.tier)
              : sum,
          0
        );

      const cap =
        command.troopKind === 'bodyguard'
          ? maxBodyguard
          : command.troopKind === 'militia'
            ? maxMilitia
            : command.troopKind === 'mercenary'
              ? maxMercenary
              : maxThug;

      if (current + levels > cap) {
        throw new GameRuleError('RULE', `Zu viele Stufen (max. ${cap}).`);
      }

      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      const dc = dcFinalize(10 + investmentDcModifier(levels), dcAcc);
      const roll = rollD20(ctx.rng);
      const mod = effectiveCheck(player.checks.influence, state.round);
      const total = roll.total + mod;
      const tierResult = resolveSuccessTier(dc, total);

      const costMultiplier =
        tierResult === 'veryGood'
          ? 0.75
          : tierResult === 'good'
            ? 0.9
            : tierResult === 'poor'
              ? 1.2
              : 1;

      let goldSpent = 0;
      let influenceSpent = 0;
      const rawSpent: MaterialStock = {};
      const specialSpent: MaterialStock = {};

      if (command.troopKind === 'militia') {
        goldSpent = 6 * levels;
        specialSpent['special.weaponsShields'] = levels;
      } else if (command.troopKind === 'mercenary') {
        // Event 17: Söldnerkosten halbiert (nur Rekrutierungskosten)
        const mercenaryHalf = state.globalEvents.some(
          (e) =>
            state.round >= e.startsAtRound &&
            state.round <= e.endsAtRound &&
            e.tableRollTotal === 17
        );
        goldSpent = (mercenaryHalf ? 4 : 8) * levels;
      } else if (command.troopKind === 'thug') {
        goldSpent = 4 * levels;
        influenceSpent = 2 * levels;
      } else if (command.troopKind === 'bodyguard') {
        goldSpent = 12 * levels;
        influenceSpent = 4 * levels;
        specialSpent['special.armor'] = levels;
        specialSpent['special.weaponsShields'] = levels;
      }

      // Event 25: Verdoppelte Truppenkosten (Gold/Einfluss)
      const troopCostsDouble = state.globalEvents.some(
        (e) =>
          state.round >= e.startsAtRound &&
          state.round <= e.endsAtRound &&
          e.tableRollTotal === 25
      );
      if (troopCostsDouble) {
        goldSpent *= 2;
        influenceSpent *= 2;
      }

      goldSpent =
        tierResult === 'fail' ? 0 : Math.ceil(goldSpent * costMultiplier);
      influenceSpent =
        tierResult === 'fail' ? 0 : Math.ceil(influenceSpent * costMultiplier);

      if (tierResult !== 'fail' && player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (
        tierResult !== 'fail' &&
        player.turn.influenceAvailable < influenceSpent
      )
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      if (tierResult !== 'fail') {
        for (const [materialId, count] of Object.entries(specialSpent)) {
          const have = player.economy.inventory.special[materialId] ?? 0;
          if (have < count)
            throw new GameRuleError(
              'RESOURCES',
              `Nicht genug SM: ${materialId}.`
            );
        }
      }

      const finalRawSpent = tierResult === 'fail' ? {} : rawSpent;
      const finalSpecialSpent = tierResult === 'fail' ? {} : specialSpent;

      return [
        {
          type: 'PlayerTroopsRecruited',
          visibility: { scope: 'private', playerId },
          playerId,
          troopKind:
            command.troopKind === 'mercenary' ? 'mercenary' : command.troopKind,
          levels,
          dc,
          roll,
          rollModifier: mod,
          rollTotal: total,
          tierResult,
          goldSpent,
          influenceSpent,
          rawSpent: finalRawSpent,
          specialSpent: finalSpecialSpent,
          actionCost: 1,
          actionKey,
        },
      ];
    }

    case 'BuildWorkshop': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const location = command.location;
      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find(
          (d) => d.id === location.id
        );
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter')
          throw new GameRuleError(
            'RULE',
            'Erst Starter-Domäne ausbauen, bevor weitere Werkstätten gebaut werden.'
          );
        const used = countFacilitySlotsUsedAtDomain(player.holdings, domain.id);
        const max = domainFacilitySlotsMax(domain.tier);
        if (used + 1 > max)
          throw new GameRuleError(
            'RULE',
            'Nicht genug Einrichtungsplätze auf dieser Domäne.'
          );
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(player.holdings, domain.id);
        if (command.tier === 'large')
          throw new GameRuleError(
            'RULE',
            'Auf Domänen sind nur kleine oder mittlere Werkstätten erlaubt.'
          );
        if (prod.total >= caps.total) {
          throw new GameRuleError(
            'RULE',
            'Nicht genug Domänen-Kapazität für Werkstatt/Lager.'
          );
        }
        if (command.tier === 'small' && prod.small >= caps.small) {
          throw new GameRuleError(
            'RULE',
            'Keine weitere kleine Werkstatt/Lager auf dieser Domäne erlaubt.'
          );
        }
        if (command.tier === 'medium' && prod.medium >= caps.medium) {
          throw new GameRuleError(
            'RULE',
            'Keine weitere mittlere Werkstatt/Lager auf dieser Domäne erlaubt.'
          );
        }
      } else {
        const city = player.holdings.cityProperties.find(
          (c) => c.id === location.id
        );
        if (!city)
          throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        if (city.mode !== 'production')
          throw new GameRuleError(
            'RULE',
            'Werkstätten können nur bei Eigenproduktion im Stadtbesitz betrieben werden.'
          );
        const prod = countCityProductionByTier(player.holdings, city.id);
        const next: CityProductionCounts = { ...prod };
        if (command.tier === 'small') next.small += 1;
        else if (command.tier === 'medium') next.medium += 1;
        else next.large += 1;
        next.total = next.small + next.medium + next.large;
        assertCityProductionCapOrThrow(city.tier, next);
      }

      const requiredTier =
        command.tier === 'large'
          ? 'experienced'
          : command.tier === 'medium'
            ? 'simple'
            : null;
      if (requiredTier) {
        const has = player.holdings.specialists.some(
          (s) =>
            ((s.kind === 'artisan' || s.kind === 'workshop') &&
              (requiredTier === 'simple'
                ? true
                : s.tier === 'experienced' || s.tier === 'master')) ||
            ((s.secondaryKind === 'artisan' ||
              s.secondaryKind === 'workshop') &&
              requiredTier === 'simple')
        );
        if (!has)
          throw new GameRuleError(
            'RULE',
            'Für diese Werkstattgröße wird ein Handwerksmeister (Fachkraft) benötigt.'
          );
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const goldSpent =
        command.tier === 'small' ? 8 : command.tier === 'medium' ? 16 : 40;
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const workshopId = generateId('workshop', player.holdings.workshops);

      const fallbackInput =
        location.kind === 'domain'
          ? domainPrimaryRawPick(
              player.holdings.domains.find((d) => d.id === location.id) ?? {}
            )
          : domainPrimaryRawPick(player.holdings.domains[0] ?? {});
      const inputMaterialId =
        command.inputMaterialId ?? fallbackInput ?? 'raw.grain';
      const inputMat = getMaterialOrThrow(inputMaterialId);
      if (inputMat.kind !== 'raw')
        throw new GameRuleError(
          'INPUT',
          'inputMaterialId muss ein Rohmaterial sein.'
        );
      if (inputMat.tier !== 'cheap' && inputMat.tier !== 'basic') {
        throw new GameRuleError(
          'INPUT',
          'inputMaterialId muss billig oder einfach sein.'
        );
      }

      const outputMaterialId =
        command.outputMaterialId ??
        defaultWorkshopOutputForInput(inputMaterialId);
      const outputMat = getMaterialOrThrow(outputMaterialId);
      if (outputMat.kind === 'special') {
        if (outputMat.tier !== 'cheap' && outputMat.tier !== 'basic') {
          throw new GameRuleError(
            'INPUT',
            'outputMaterialId muss billiges oder einfaches Sondermaterial sein.'
          );
        }
        if (
          materialTierRank(outputMat.tier) > materialTierRank(inputMat.tier)
        ) {
          throw new GameRuleError(
            'INPUT',
            'outputMaterialId darf nicht hoeher als inputMaterialId sein.'
          );
        }
      } else if (outputMat.kind === 'raw') {
        if (!outputMat.tags.includes('improved')) {
          throw new GameRuleError(
            'INPUT',
            'outputMaterialId (raw) muss ein verbessertes Rohmaterial sein.'
          );
        }
        if (outputMat.tier !== inputMat.tier) {
          throw new GameRuleError(
            'INPUT',
            'outputMaterialId (raw) muss die gleiche Tierstufe wie inputMaterialId haben.'
          );
        }
        const sharedTags = outputMat.tags.filter(
          (t) => t !== 'improved' && inputMat.tags.includes(t)
        ).length;
        if (sharedTags <= 0) {
          throw new GameRuleError(
            'INPUT',
            'outputMaterialId (raw) muss thematisch zum inputMaterialId passen (Tags).'
          );
        }
      } else {
        throw new GameRuleError(
          'INPUT',
          'outputMaterialId muss ein Sondermaterial oder verbessertes Rohmaterial sein.'
        );
      }

      return [
        {
          type: 'PlayerWorkshopBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          workshopId,
          location,
          tier: command.tier,
          inputMaterialId,
          outputMaterialId,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeWorkshop': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const workshop = player.holdings.workshops.find(
        (w) => w.id === command.workshopId
      );
      if (!workshop) throw new GameRuleError('INPUT', 'Unbekannte Werkstatt.');
      if (workshop.tier === 'large')
        throw new GameRuleError(
          'RULE',
          'Werkstatt ist bereits auf maximaler Stufe.'
        );
      const expectedNext = workshop.tier === 'small' ? 'medium' : 'large';
      if (command.toTier !== expectedNext)
        throw new GameRuleError(
          'RULE',
          `Upgrade nur auf nächste Stufe möglich (${expectedNext}).`
        );

      const requiredTier =
        command.toTier === 'large' ? 'experienced' : 'simple';
      const has = player.holdings.specialists.some(
        (s) =>
          ((s.kind === 'artisan' || s.kind === 'workshop') &&
            (requiredTier === 'simple'
              ? true
              : s.tier === 'experienced' || s.tier === 'master')) ||
          ((s.secondaryKind === 'artisan' || s.secondaryKind === 'workshop') &&
            requiredTier === 'simple')
      );
      if (!has)
        throw new GameRuleError(
          'RULE',
          'Für dieses Upgrade wird ein Handwerksmeister (Fachkraft) benötigt.'
        );

      if (workshop.location.kind === 'domain') {
        const domain = player.holdings.domains.find(
          (d) => d.id === workshop.location.id
        );
        if (!domain)
          throw new GameRuleError('STATE', 'Domäne der Werkstatt fehlt.');
        if (command.toTier === 'large') {
          throw new GameRuleError(
            'RULE',
            'Auf Domänen sind nur kleine oder mittlere Werkstätten erlaubt.'
          );
        }
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(player.holdings, domain.id, {
          excludeWorkshopId: workshop.id,
        });
        const nextSmall = prod.small;
        const nextMedium = prod.medium + 1;
        if (
          nextSmall > caps.small ||
          nextMedium > caps.medium ||
          nextSmall + nextMedium > caps.total
        ) {
          throw new GameRuleError(
            'RULE',
            'Nicht genug Domänen-Kapazität für Werkstatt/Lager.'
          );
        }
      } else if (workshop.location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find(
          (c) => c.id === workshop.location.id
        );
        if (!city)
          throw new GameRuleError('STATE', 'Stadtbesitz der Werkstatt fehlt.');
        if (city.mode !== 'production')
          throw new GameRuleError(
            'RULE',
            'Werkstätten können nur bei Eigenproduktion im Stadtbesitz betrieben werden.'
          );
        const prod = countCityProductionByTier(player.holdings, city.id, {
          excludeWorkshopId: workshop.id,
        });
        const next: CityProductionCounts = { ...prod };
        if (command.toTier === 'medium') next.medium += 1;
        else next.large += 1;
        next.total = next.small + next.medium + next.large;
        assertCityProductionCapOrThrow(city.tier, next);
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const baseCost = (tier: WorkshopTier) =>
        tier === 'small' ? 8 : tier === 'medium' ? 16 : 40;
      const goldSpent = baseCost(command.toTier) - baseCost(workshop.tier);
      if (goldSpent <= 0)
        throw new GameRuleError('STATE', 'Ungültige Upgrade-Kosten.');
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      return [
        {
          type: 'PlayerWorkshopUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          workshopId: workshop.id,
          fromTier: workshop.tier,
          toTier: command.toTier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'BuildStorage': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const location = command.location;
      if (location.kind === 'domain') {
        const domain = player.holdings.domains.find(
          (d) => d.id === location.id
        );
        if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
        if (domain.tier === 'starter')
          throw new GameRuleError(
            'RULE',
            'Erst Starter-Domäne ausbauen, bevor Lager gebaut werden.'
          );
        const used = countFacilitySlotsUsedAtDomain(player.holdings, domain.id);
        const max = domainFacilitySlotsMax(domain.tier);
        if (used + 1 > max)
          throw new GameRuleError(
            'RULE',
            'Nicht genug Einrichtungsplätze auf dieser Domäne.'
          );
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(player.holdings, domain.id);
        if (command.tier === 'large')
          throw new GameRuleError(
            'RULE',
            'Auf Domänen sind nur kleine oder mittlere Lager erlaubt.'
          );
        if (prod.total >= caps.total) {
          throw new GameRuleError(
            'RULE',
            'Nicht genug Domänen-Kapazität für Werkstatt/Lager.'
          );
        }
        if (command.tier === 'small' && prod.small >= caps.small) {
          throw new GameRuleError(
            'RULE',
            'Kein weiteres kleines Lager/Werkstatt auf dieser Domäne erlaubt.'
          );
        }
        if (command.tier === 'medium' && prod.medium >= caps.medium) {
          throw new GameRuleError(
            'RULE',
            'Kein weiteres mittleres Lager/Werkstatt auf dieser Domäne erlaubt.'
          );
        }
      } else {
        const city = player.holdings.cityProperties.find(
          (c) => c.id === location.id
        );
        if (!city)
          throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        if (city.mode !== 'production')
          throw new GameRuleError(
            'RULE',
            'Lager können nur bei Eigenproduktion im Stadtbesitz betrieben werden.'
          );
        const prod = countCityProductionByTier(player.holdings, city.id);
        const next: CityProductionCounts = { ...prod };
        if (command.tier === 'small') next.small += 1;
        else if (command.tier === 'medium') next.medium += 1;
        else next.large += 1;
        next.total = next.small + next.medium + next.large;
        assertCityProductionCapOrThrow(city.tier, next);
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const goldSpent =
        command.tier === 'small' ? 8 : command.tier === 'medium' ? 16 : 40;
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      const storageId = generateId('storage', player.holdings.storages);

      return [
        {
          type: 'PlayerStorageBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          storageId,
          location,
          tier: command.tier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeStorage': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const storage = player.holdings.storages.find(
        (s) => s.id === command.storageId
      );
      if (!storage) throw new GameRuleError('INPUT', 'Unbekanntes Lager.');
      if (storage.tier === 'large')
        throw new GameRuleError(
          'RULE',
          'Lager ist bereits auf maximaler Stufe.'
        );
      const expectedNext = storage.tier === 'small' ? 'medium' : 'large';
      if (command.toTier !== expectedNext)
        throw new GameRuleError(
          'RULE',
          `Upgrade nur auf nächste Stufe möglich (${expectedNext}).`
        );

      if (storage.location.kind === 'domain') {
        const domain = player.holdings.domains.find(
          (d) => d.id === storage.location.id
        );
        if (!domain)
          throw new GameRuleError('STATE', 'Domäne des Lagers fehlt.');
        if (command.toTier === 'large') {
          throw new GameRuleError(
            'RULE',
            'Auf Domänen sind nur kleine oder mittlere Lager erlaubt.'
          );
        }
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(player.holdings, domain.id, {
          excludeStorageId: storage.id,
        });
        const nextSmall = prod.small;
        const nextMedium = prod.medium + 1;
        if (
          nextSmall > caps.small ||
          nextMedium > caps.medium ||
          nextSmall + nextMedium > caps.total
        ) {
          throw new GameRuleError(
            'RULE',
            'Nicht genug Domänen-Kapazität für Werkstatt/Lager.'
          );
        }
      } else if (storage.location.kind === 'cityProperty') {
        const city = player.holdings.cityProperties.find(
          (c) => c.id === storage.location.id
        );
        if (!city)
          throw new GameRuleError('STATE', 'Stadtbesitz des Lagers fehlt.');
        if (city.mode !== 'production')
          throw new GameRuleError(
            'RULE',
            'Lager können nur bei Eigenproduktion im Stadtbesitz betrieben werden.'
          );
        const prod = countCityProductionByTier(player.holdings, city.id, {
          excludeStorageId: storage.id,
        });
        const next: CityProductionCounts = { ...prod };
        if (command.toTier === 'medium') next.medium += 1;
        else next.large += 1;
        next.total = next.small + next.medium + next.large;
        assertCityProductionCapOrThrow(city.tier, next);
      }

      const { usedFree } = consumeFacilityOrAction(player, state.rules);
      const baseCost = (tier: StorageTier) =>
        tier === 'small' ? 8 : tier === 'medium' ? 16 : 40;
      const goldSpent = baseCost(command.toTier) - baseCost(storage.tier);
      if (goldSpent <= 0)
        throw new GameRuleError('STATE', 'Ungültige Upgrade-Kosten.');
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      return [
        {
          type: 'PlayerStorageUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          storageId: storage.id,
          fromTier: storage.tier,
          toTier: command.toTier,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'BuildFacility': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const { usedFree } = consumeFacilityOrAction(player, state.rules);

      const location = command.location;
      let existingFacilities: Array<{ id: string }> | undefined;
      let usedSlots = 0;
      let maxSlots = Number.POSITIVE_INFINITY;
      switch (location.kind) {
        case 'domain':
          {
            const domain = player.holdings.domains.find(
              (d) => d.id === location.id
            );
            existingFacilities = domain
              ? [
                  ...domain.facilities,
                  ...(domain.specialization?.facilities ?? []),
                ]
              : undefined;
            if (domain) {
              usedSlots = countFacilitySlotsUsedAtDomain(
                player.holdings,
                domain.id
              );
              maxSlots = domainFacilitySlotsMax(domain.tier);
            }
          }
          break;
        case 'cityProperty':
          {
            const city = player.holdings.cityProperties.find(
              (c) => c.id === location.id
            );
            existingFacilities = city
              ? [...city.facilities, ...(city.specialization?.facilities ?? [])]
              : undefined;
            if (city) {
              usedSlots = countFacilitySlotsUsedAtCity(
                player.holdings,
                city.id
              );
              maxSlots = cityFacilitySlotsMax(city.tier);
            }
          }
          break;
        case 'organization':
          {
            const org = player.holdings.organizations.find(
              (o) => o.id === location.id
            );
            existingFacilities = org?.facilities;
            if (org) {
              const projectSlots = player.holdings.longTermProjects.filter(
                (p) =>
                  p.kind === 'facility' &&
                  p.location.kind === 'organization' &&
                  p.location.id === org.id
              ).length;
              usedSlots = org.facilities.length + projectSlots;
              maxSlots = 2 * postTierRank(org.tier);
            }
          }
          break;
        case 'office':
          {
            const office = player.holdings.offices.find(
              (o) => o.id === location.id
            );
            existingFacilities = office
              ? [
                  ...office.facilities,
                  ...(office.specialization?.facilities ?? []),
                ]
              : undefined;
            if (office) {
              const projectSlots = player.holdings.longTermProjects.filter(
                (p) =>
                  p.kind === 'facility' &&
                  p.location.kind === 'office' &&
                  p.location.id === office.id
              ).length;
              usedSlots =
                office.facilities.length +
                (office.specialization?.facilities?.length ?? 0) +
                projectSlots;
              maxSlots = cityFacilitySlotsMax(office.tier);
            }
          }
          break;
        case 'tradeEnterprise':
          {
            const te = player.holdings.tradeEnterprises.find(
              (t) => t.id === location.id
            );
            existingFacilities = te?.facilities;
            if (te) {
              const projectSlots = player.holdings.longTermProjects.filter(
                (p) =>
                  p.kind === 'facility' &&
                  p.location.kind === 'tradeEnterprise' &&
                  p.location.id === te.id
              ).length;
              usedSlots = te.facilities.length + projectSlots;
              maxSlots = 2 * postTierRank(te.tier);
            }
          }
          break;
        case 'workshop':
          {
            const workshop = player.holdings.workshops.find(
              (w) => w.id === location.id
            );
            existingFacilities = workshop?.facilities;
            if (workshop) {
              const projectSlots = player.holdings.longTermProjects.filter(
                (p) =>
                  p.kind === 'facility' &&
                  p.location.kind === 'workshop' &&
                  p.location.id === workshop.id
              ).length;
              usedSlots = workshop.facilities.length + projectSlots;
              maxSlots = workshopFacilitySlotsMax(workshop.tier);
            }
          }
          break;
        case 'troops':
          usedSlots =
            player.holdings.troops.facilities.length +
            player.holdings.longTermProjects.filter(
              (p) => p.kind === 'facility' && p.location.kind === 'troops'
            ).length;
          existingFacilities = player.holdings.troops.facilities;
          break;
        case 'personal':
          usedSlots =
            player.holdings.personalFacilities.length +
            player.holdings.longTermProjects.filter(
              (p) => p.kind === 'facility' && p.location.kind === 'personal'
            ).length;
          existingFacilities = player.holdings.personalFacilities;
          maxSlots = 6;
          break;
        default:
          existingFacilities = undefined;
      }

      if (!existingFacilities) {
        throw new GameRuleError('INPUT', 'Ungültiger Ort für Einrichtung.');
      }

      if (usedSlots + 1 > maxSlots) {
        throw new GameRuleError('RULE', 'Nicht genug Einrichtungsplätze.');
      }

      const parsedKey = parseFacilityKey(command.facilityKey);
      if (!parsedKey) {
        throw new GameRuleError(
          'INPUT',
          'Unbekannte Einrichtung (erwartet: general.<tier>.* oder special.<tier>.*).'
        );
      }
      const { category, rest } = parsedKey;

      if (location.kind === 'personal' && !rest.startsWith('personal.')) {
        throw new GameRuleError(
          'RULE',
          'Persönliche Einrichtungen müssen mit general.<tier>.personal.* oder special.<tier>.personal.* benannt sein.'
        );
      }

      const cost = facilityBuildCostV1(command.facilityKey);
      if (!cost)
        throw new GameRuleError(
          'INPUT',
          'Unbekannte Einrichtung (erwartet: general.<tier>.* oder special.<tier>.*).'
        );

      // Location-spezifische Regeln (v1 subset)
      if (
        command.facilityKey === 'special.medium.artisanAlley' &&
        location.kind !== 'cityProperty'
      ) {
        throw new GameRuleError(
          'RULE',
          'Gasse der Kunsthandwerker kann nur im städtischen Besitz errichtet werden.'
        );
      }

      if (command.facilityKey === 'general.medium.city.insulae') {
        if (location.kind !== 'cityProperty') {
          throw new GameRuleError(
            'RULE',
            'Insulaebau kann nur im städtischen Besitz errichtet werden.'
          );
        }
        const city = player.holdings.cityProperties.find((c) => c.id === location.id);
        if (!city)
          throw new GameRuleError('INPUT', 'Unbekannter städtischer Besitz.');
        if (city.tier === 'small') {
          throw new GameRuleError(
            'RULE',
            'Insulaebau ist erst ab mittlerem städtischen Besitz möglich.'
          );
        }
        const maxByTier = city.tier === 'medium' ? 2 : 4;
        const existingCount = city.facilities.filter(
          (f) => f.key === 'general.medium.city.insulae'
        ).length;
        const inProgressCount = player.holdings.longTermProjects.filter(
          (p) =>
            p.kind === 'facility' &&
            p.facilityKey === 'general.medium.city.insulae' &&
            p.location.kind === 'cityProperty' &&
            p.location.id === city.id
        ).length;
        if (existingCount + inProgressCount >= maxByTier) {
          throw new GameRuleError(
            'RULE',
            `Zu viele Insulaebauten in dieser Stadt (max. ${maxByTier}).`
          );
        }
      }

      // Soll: Administrative Reformen (Amtseinrichtung) – erlaubt Split-Ertrag.
      if (command.facilityKey === 'general.medium.office.administrativeReforms') {
        if (location.kind !== 'office') {
          throw new GameRuleError(
            'RULE',
            'Administrative Reformen können nur in einem Amt errichtet werden.'
          );
        }
        const office = player.holdings.offices.find((o) => o.id === location.id);
        if (!office) throw new GameRuleError('INPUT', 'Unbekanntes Amt.');
        if (office.tier === 'small') {
          throw new GameRuleError(
            'RULE',
            'Administrative Reformen sind erst ab mittlerem Amt möglich.'
          );
        }
        if (player.holdings.offices.length < 2) {
          throw new GameRuleError(
            'RULE',
            'Administrative Reformen setzen mind. 2 Ämter voraus.'
          );
        }
        const existingCount = player.holdings.offices.reduce((sum, o) => {
          const all = [...o.facilities, ...(o.specialization?.facilities ?? [])];
          return (
            sum +
            all.filter((f) => f.key === 'general.medium.office.administrativeReforms')
              .length
          );
        }, 0);
        const inProgressCount = player.holdings.longTermProjects.filter(
          (p) =>
            p.kind === 'facility' &&
            p.facilityKey === 'general.medium.office.administrativeReforms'
        ).length;
        if (existingCount + inProgressCount >= 1) {
          throw new GameRuleError(
            'RULE',
            'Administrative Reformen können nur einmal pro Spieler errichtet werden.'
          );
        }
      }

      let goldSpent = cost.gold;
      const influenceSpent = cost.influence;
      let laborSpent = cost.labor;
      const rawSpent: MaterialStock = cost.raw;
      const specialSpent: MaterialStock = cost.special;
      let magicPowerSpent = cost.magicPower;

      const activeEvents = state.globalEvents.filter(
        (e) => state.round >= e.startsAtRound && state.round <= e.endsAtRound
      );

      // Event 23: Erhöhte Steuereinnahmen → Kosten Allgemeiner Amtseinrichtungen verdoppelt (4 Runden).
      if (
        location.kind === 'office' &&
        category === 'general' &&
        activeEvents.some((e) => e.tableRollTotal === 23)
      ) {
        goldSpent *= 2;
      }

      // Event 13: Zusammenbruch einer großen Handelsunternehmung → Handelsunternehmungs-Einrichtungen 1 Runde halbiert.
      // (Regeltext: "Möglichkeit ... günstig Einrichtungen zu erwerben" → v1: gilt in der Start-Runde des Ereignisses.)
      if (
        location.kind === 'tradeEnterprise' &&
        activeEvents.some(
          (e) => e.tableRollTotal === 13 && state.round === e.startsAtRound
        )
      ) {
        goldSpent = Math.max(0, Math.ceil(goldSpent / 2));
      }

      const buildTime = facilityBuildTimeV1(command.facilityKey);
      if (buildTime && Math.trunc(buildTime.rounds) > 1) {
        const buildLaborMultiplier = activeEvents.some((e) => e.tableRollTotal === 36)
          ? 2
          : 1;
        laborSpent += Math.max(0, Math.trunc(buildTime.laborPerRound)) * buildLaborMultiplier;
        magicPowerSpent += Math.max(0, Math.trunc(buildTime.magicPowerPerRound));
      }

      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (player.turn.influenceAvailable < influenceSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');
      if (player.turn.laborAvailable < laborSpent)
        throw new GameRuleError('RESOURCES', 'Nicht genug Arbeitskraft.');
      if (player.economy.inventory.magicPower < magicPowerSpent)
        throw new GameRuleError('RESOURCES', 'Nicht genug Zauberkraft.');
      for (const [materialId, count] of Object.entries(rawSpent)) {
        const have = player.economy.inventory.raw[materialId] ?? 0;
        if (have < count)
          throw new GameRuleError(
            'RESOURCES',
            `Nicht genug RM: ${materialId}.`
          );
      }
      for (const [materialId, count] of Object.entries(specialSpent)) {
        const have = player.economy.inventory.special[materialId] ?? 0;
        if (have < count)
          throw new GameRuleError(
            'RESOURCES',
            `Nicht genug SM: ${materialId}.`
          );
      }

      if (buildTime && Math.trunc(buildTime.rounds) > 1) {
        const rounds = Math.max(2, Math.trunc(buildTime.rounds));
        const projectId = generateId('project', player.holdings.longTermProjects);
        return [
          {
            type: 'PlayerLongTermProjectStarted',
            visibility: { scope: 'private', playerId },
            playerId,
            projectId,
            kind: 'facility',
            location: location as any,
            facilityKey: command.facilityKey,
            startedAtRound: state.round,
            totalRounds: rounds,
            remainingRounds: Math.max(0, rounds - 1),
            laborPerRound: Math.max(0, Math.trunc(buildTime.laborPerRound)),
            magicPowerPerRound: Math.max(
              0,
              Math.trunc(buildTime.magicPowerPerRound)
            ),
            upfrontCosts: {
              goldSpent,
              influenceSpent,
              laborSpent,
              rawSpent,
              specialSpent,
              magicPowerSpent,
            },
            usedFreeFacilityBuild: usedFree,
          },
        ];
      }

      const facilityInstanceId = generateFacilityInstanceId(
        location as any,
        existingFacilities
      );
      return [
        {
          type: 'PlayerFacilityBuilt',
          visibility: { scope: 'private', playerId },
          playerId,
          location: location as any,
          facilityInstanceId,
          facilityKey: command.facilityKey,
          goldSpent,
          influenceSpent,
          laborSpent,
          rawSpent,
          specialSpent,
          magicPowerSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'SetDomainSpecialization': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const domain = player.holdings.domains.find(
        (d) => d.id === command.domainId
      );
      if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
      if (domain.tier === 'starter')
        throw new GameRuleError(
          'RULE',
          'Starter-Domänen können nicht spezialisiert werden (erst ausbauen).'
        );
      if (domain.specialization)
        throw new GameRuleError('RULE', 'Domäne ist bereits spezialisiert.');

      const { usedFree } = consumeFacilityOrAction(player, state.rules);

      let goldSpent = 0;
      let rawSpent: MaterialStock = {};
      let nextRawPicks: string[] | undefined;

      if (command.kind === 'agriculture') {
        goldSpent = 10;
        const preferred = command.picks?.costRawId ?? 'raw.grain';
        const mat = getMaterialOrThrow(preferred);
        if (mat.kind !== 'raw')
          throw new GameRuleError(
            'INPUT',
            'costRawId muss ein Rohmaterial sein.'
          );
        rawSpent = { [preferred]: 2 };
        nextRawPicks = normalizeAgricultureRawPicks(command.picks?.rawPicks);
      } else if (command.kind === 'animalHusbandry') {
        goldSpent = 15;
        const animalIds = Object.keys(player.economy.inventory.raw).filter(
          (id) => {
            try {
              return getMaterialOrThrow(id).tags.includes('animal');
            } catch {
              return false;
            }
          }
        );
        const order = (ids: string[]) =>
          [...ids].sort((a, b) => {
            const ma = getMaterialOrThrow(a);
            const mb = getMaterialOrThrow(b);
            const tier = materialTierRank(ma.tier) - materialTierRank(mb.tier);
            if (tier) return tier;
            return a.localeCompare(b);
          });
        const animalStock: MaterialStock = {};
        for (const id of animalIds)
          animalStock[id] = player.economy.inventory.raw[id] ?? 0;
        const { taken } = takeFromStock(animalStock, 4, order);
        if (sumStock(taken) < 4)
          throw new GameRuleError(
            'RESOURCES',
            'Nicht genug Tiere (RM mit Tag "animal").'
          );
        rawSpent = taken;
        if (command.picks?.rawPicks)
          nextRawPicks = normalizeDomainRawPicks(
            command.picks.rawPicks,
            domain.tier
          );
      } else if (command.kind === 'forestry') {
        goldSpent = 6;
        rawSpent = {};
        if (command.picks?.rawPicks)
          nextRawPicks = normalizeDomainRawPicks(
            command.picks.rawPicks,
            domain.tier
          );
      } else if (command.kind === 'mining') {
        // Minimal-Interpretation (Steinbruch): 20 Gold, 4 RM Bauholz.
        goldSpent = 20;
        rawSpent = { 'raw.wood': 4 };
        if (command.picks?.rawPicks)
          nextRawPicks = normalizeDomainRawPicks(
            command.picks.rawPicks,
            domain.tier
          );
      }

      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      for (const [materialId, count] of Object.entries(rawSpent)) {
        const have = player.economy.inventory.raw[materialId] ?? 0;
        if (have < count)
          throw new GameRuleError(
            'RESOURCES',
            `Nicht genug RM: ${materialId}.`
          );
      }

      return [
        {
          type: 'PlayerDomainSpecializationSet',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId: command.domainId,
          kind: command.kind,
          picks: nextRawPicks
            ? { ...command.picks, rawPicks: nextRawPicks }
            : command.picks,
          goldSpent,
          rawSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'UpgradeStarterDomain': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const domain = player.holdings.domains.find(
        (d) => d.id === command.domainId
      );
      if (!domain) throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
      if (domain.tier !== 'starter')
        throw new GameRuleError(
          'RULE',
          'Nur Starter-Domänen können so ausgebaut werden.'
        );

      const { usedFree, actionCost } = consumeFacilityOrAction(
        player,
        state.rules
      );
      if (actionCost > 0)
        ensureActionAvailable(
          player,
          state.rules,
          `facility.upgradeStarterDomain.${command.domainId}`,
          1
        );

      const goldSpent = 8;
      const laborSpent = 4;
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (player.turn.laborAvailable < laborSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Arbeitskraft.');

      return [
        {
          type: 'PlayerStarterDomainUpgraded',
          visibility: { scope: 'private', playerId },
          playerId,
          domainId: command.domainId,
          goldSpent,
          laborSpent,
          usedFreeFacilityBuild: usedFree,
        },
      ];
    }

    case 'HireSpecialist': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const { usedFree, actionCost } = consumeFacilityOrAction(
        player,
        state.rules
      );

      const countMediumLargePosts = () => {
        let count = 0;
        for (const d of player.holdings.domains)
          if (d.tier === 'medium' || d.tier === 'large') count += 1;
        for (const c of player.holdings.cityProperties)
          if (c.tier === 'medium' || c.tier === 'large') count += 1;
        for (const o of player.holdings.organizations)
          if (o.tier === 'medium' || o.tier === 'large') count += 1;
        for (const o of player.holdings.offices)
          if (o.tier === 'medium' || o.tier === 'large') count += 1;
        for (const t of player.holdings.tradeEnterprises)
          if (t.tier === 'medium' || t.tier === 'large') count += 1;
        return count;
      };
      const specialistCap = 2 + countMediumLargePosts();
      const specialistCapWithPersonal =
        specialistCap + player.holdings.personalFacilities.length;
      if (player.holdings.specialists.length >= specialistCapWithPersonal) {
        throw new GameRuleError(
          'RULE',
          `Zu viele Fachkräfte (max. ${specialistCapWithPersonal}).`
        );
      }

      const baseCost =
        command.tier === 'simple'
          ? 10
          : command.tier === 'experienced'
            ? 25
            : 50;
      if (player.economy.gold < baseCost)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      const dc = dcFinalize(
        10 +
          (command.tier === 'experienced'
            ? 4
            : command.tier === 'master'
              ? 8
              : 0),
        dcAcc
      );
      const roll = rollD20(ctx.rng);
      const rollModifier = effectiveCheck(player.checks.influence, state.round);
      const rollTotal = roll.total + rollModifier;
      const tierResult = resolveSuccessTier(dc, rollTotal);

      const specialistId = generateId('spec', player.holdings.specialists);
      if (tierResult === 'fail') {
        return [
          {
            type: 'PlayerSpecialistHired',
            visibility: { scope: 'private', playerId },
            playerId,
            specialistId,
            kind: command.kind,
            tier: command.tier,
            dc,
            roll,
            rollModifier,
            rollTotal,
            tierResult,
            tableRoll: null,
            costAdjustmentGold: 0,
            loyaltyRolled: null,
            loyaltyFinal: null,
            traitRoll: null,
            influencePerRoundBonus: 0,
            traits: [],
            goldSpent: baseCost,
            usedFreeFacilityBuild: usedFree,
            actionCost,
          },
        ];
      }

      const tableRoll = rollDice('2d6', ctx.rng);

      let kind = command.kind;
      let tier = command.tier;
      let costAdj = 0;
      let baseEffectBonus = 0;
      let influencePerRoundBonus = 0;
      let loyaltyMode:
        | { kind: 'fixed'; value: number }
        | { kind: 'roll'; dice: '1d6+2' | '1d4+2' } = {
        kind: 'roll',
        dice: '1d6+2',
      };
      const additionalTraitIds: number[] = [];
      let autoPromoteAtRound: number | undefined;
      let addExtraPositiveOnlyTrait = false;
      let addApprentice = false;

      const allKinds = [
        'tactician',
        'wizard',
        'administrator',
        'strategist',
        'cleric',
        'financier',
        'politician',
        'builder',
        'workshop',
        'enforcer',
        'artisan',
      ] as const;

      if (tableRoll.total === 2) {
        costAdj = 20;
        tier = 'master';
        loyaltyMode = { kind: 'fixed', value: 6 };
        addExtraPositiveOnlyTrait = true;
      } else if (tableRoll.total === 3) {
        costAdj = 20;
        addApprentice = true;
      } else if (tableRoll.total === 4) {
        costAdj = -10;
        loyaltyMode = { kind: 'fixed', value: 6 };
      } else if (tableRoll.total === 5) {
        costAdj = -10;
        tier = 'simple';
        additionalTraitIds.push(1); // Ambitioniert
        autoPromoteAtRound = state.round + 4;
      } else if (tableRoll.total === 6) {
        costAdj = -5;
        loyaltyMode = { kind: 'roll', dice: '1d4+2' };
      } else if (tableRoll.total === 7) {
        costAdj = 0;
        loyaltyMode = { kind: 'roll', dice: '1d6+2' };
      } else if (tableRoll.total === 8) {
        costAdj = 5;
      } else if (tableRoll.total === 9) {
        costAdj = 20;
        tier = 'master';
        influencePerRoundBonus = 2;
      } else if (tableRoll.total === 10) {
        costAdj = 25;
        tier = 'master';
        loyaltyMode = { kind: 'roll', dice: '1d4+2' };
        baseEffectBonus = 1;
      } else if (tableRoll.total === 11) {
        kind = allKinds[ctx.rng.nextIntInclusive(0, allKinds.length - 1)];
      } else if (tableRoll.total === 12) {
        kind = allKinds[ctx.rng.nextIntInclusive(0, allKinds.length - 1)];
        tier = 'master';
        costAdj = 50;
        baseEffectBonus = 1;
      }

      const goldSpent = Math.max(0, baseCost + costAdj);
      if (player.economy.gold < goldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');

      let loyaltyRolled: DiceRoll | null = null;
      let loyaltyFinal: number | null = null;
      if (loyaltyMode.kind === 'fixed') {
        loyaltyFinal = Math.max(0, Math.min(6, Math.trunc(loyaltyMode.value)));
      } else {
        const base =
          loyaltyMode.dice === '1d4+2'
            ? rollDice('1d4', ctx.rng)
            : rollDice('1d6', ctx.rng);
        loyaltyRolled = base;
        loyaltyFinal = Math.max(0, Math.min(6, base.total + 2));
      }

      const traitRoll = rollDice('1d20', ctx.rng);
      const baseTraitId = specialistTraitByRoll(traitRoll.total).id;

      const traitInstances: SpecialistTrait[] = [];
      traitInstances.push({ ...specialistTraitByRoll(baseTraitId) });
      for (const id of additionalTraitIds)
        traitInstances.push({ ...specialistTraitByRoll(id) });

      if (addExtraPositiveOnlyTrait) {
        const already = new Set(traitInstances.map((t) => t.id));
        let extraId: number | null = null;
        for (let i = 0; i < 5; i += 1) {
          const extraRoll = rollDice('1d20', ctx.rng);
          const candidate = specialistTraitByRoll(extraRoll.total).id;
          if (!already.has(candidate)) {
            extraId = candidate;
            break;
          }
        }
        if (extraId != null) {
          traitInstances.push({
            ...specialistTraitByRoll(extraId),
            positiveOnly: true,
          });
        }
      }

      // Recruitment table: roll 10 doubles negative effects; roll 12 doubles all effects.
      if (tableRoll.total === 10) {
        for (const t of traitInstances)
          t.negativeMultiplier = (t.negativeMultiplier ?? 1) * 2;
      }
      if (tableRoll.total === 12) {
        for (const t of traitInstances) {
          t.positiveMultiplier = (t.positiveMultiplier ?? 1) * 2;
          t.negativeMultiplier = (t.negativeMultiplier ?? 1) * 2;
        }
      }

      const traits = Array.from(
        new Map(traitInstances.map((t) => [t.id, t])).values()
      );

      let secondaryKind: SpecialistKind | undefined;
      if (traits.some((t) => t.id === 8)) {
        const options = allKinds.filter((k) => k !== kind);
        secondaryKind =
          options[ctx.rng.nextIntInclusive(0, options.length - 1)];
      }

      let apprentice:
        | {
            specialistId: string;
            kind: SpecialistKind;
            secondaryKind?: SpecialistKind;
            tier: SpecialistTier;
            loyalty: number;
            traitRoll: DiceRoll;
            traits: SpecialistTrait[];
          }
        | undefined;

      if (addApprentice) {
        const apprenticeId = generateId('spec', [
          ...player.holdings.specialists,
          { id: specialistId },
        ]);
        const apprenticeTraitRoll = rollDice('1d20', ctx.rng);
        const apprenticeTraitId = specialistTraitByRoll(
          apprenticeTraitRoll.total
        ).id;

        const apprenticeTraits: SpecialistTrait[] = [
          { ...specialistTraitByRoll(apprenticeTraitId) },
        ];
        let apprenticeSecondaryKind: SpecialistKind | undefined;
        if (apprenticeTraits.some((t) => t.id === 8)) {
          const options = allKinds.filter((k) => k !== kind);
          apprenticeSecondaryKind =
            options[ctx.rng.nextIntInclusive(0, options.length - 1)];
        }
        apprentice = {
          specialistId: apprenticeId,
          kind,
          secondaryKind: apprenticeSecondaryKind,
          tier: 'simple',
          loyalty: 3,
          traitRoll: apprenticeTraitRoll,
          traits: apprenticeTraits,
        };
      }

      return [
        {
          type: 'PlayerSpecialistHired',
          visibility: { scope: 'private', playerId },
          playerId,
          specialistId,
          kind,
          secondaryKind,
          tier,
          baseEffectBonus: baseEffectBonus || undefined,
          autoPromoteAtRound,
          dc,
          roll,
          rollModifier,
          rollTotal,
          tierResult,
          tableRoll,
          costAdjustmentGold: costAdj,
          loyaltyRolled,
          loyaltyFinal,
          traitRoll,
          influencePerRoundBonus,
          traits,
          apprentice,
          goldSpent,
          usedFreeFacilityBuild: usedFree,
          actionCost,
        },
      ];
    }

    case 'PoliticalSteps': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'actions');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      const player = state.players[playerId];
      if (!player) throw new Error('Player missing');

      const baseActionKey = `political.${command.kind}`;
      const actionKey = baseActionKey;
      const actionCost = 1;
      ensureActionAvailable(player, state.rules, actionKey, actionCost);

      if (command.kind === 'convertInformation') {
        const amount = Math.trunc(command.amount);
        if (amount <= 0)
          throw new GameRuleError('INPUT', 'amount muss > 0 sein.');
        const infoSpent = amount;
        if (player.economy.information < infoSpent)
          throw new GameRuleError('FUNDS', 'Nicht genug Information.');
        const goldGained = command.to === 'gold' ? amount * 2 : 0;
        const influenceGained = command.to === 'influence' ? amount * 4 : 0;
        return [
          {
            type: 'PlayerPoliticalStepsResolved',
            visibility: { scope: 'private', playerId },
            playerId,
            kind: 'convertInformation',
            to: command.to,
            amount,
            infoSpent,
            goldGained,
            influenceGained,
            actionCost,
            actionKey,
          },
        ];
      }

      const sizeRank = postTierRank(command.size);
      const baseCosts = { gold: sizeRank, influence: sizeRank };

      const infoSpentRaw = Math.max(0, Math.trunc(command.infoSpent ?? 0));
      const infoSpent = infoSpentRaw;
      if (infoSpent > 0 && player.economy.information < infoSpent) {
        throw new GameRuleError('FUNDS', 'Nicht genug Information.');
      }
      const infoBonus = infoSpent * 2;

      let investments = 0;
      const investmentCosts = { gold: 0, influence: 0 };

      if (command.kind === 'damageDefend') {
        investments = Math.trunc(command.investments);
        if (investments <= 0)
          throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
        if (command.investmentPayment === 'combat') {
          const open =
            openCombatPower(player.holdings.troops) +
            specialistCombatPowerBonus(player);
          if (open < investments) {
            throw new GameRuleError(
              'FUNDS',
              `Nicht genug Kampfkraft (offen) für ${investments} Investitionen.`
            );
          }
        } else {
          investmentCosts.influence = investments * 6;
        }
      } else if (command.kind === 'manipulate') {
        investments = Math.trunc(command.investments);
        if (investments <= 0)
          throw new GameRuleError('INPUT', 'Investitionen müssen > 0 sein.');
        if (command.investmentPayment === 'influenceFirst') {
          investmentCosts.influence = investments * 6;
          investmentCosts.gold = investments * 2;
        } else {
          investmentCosts.influence = investments * 2;
          investmentCosts.gold = investments * 6;
        }
      } else {
        // loyaltySecure
        const targets = command.targets ?? [];
        if (!Array.isArray(targets) || targets.length === 0) {
          throw new GameRuleError(
            'INPUT',
            'targets muss mindestens 1 Ziel enthalten.'
          );
        }
        if (targets.length > 3) {
          throw new GameRuleError(
            'INPUT',
            'Maximal 3 Loyalitäts-Ziele pro Runde (v1).'
          );
        }
        const key = (t: { kind: string; id: string }) => `${t.kind}:${t.id}`;
        const unique = new Set<string>();
        for (const t of targets) {
          if (!t?.id || typeof t.id !== 'string')
            throw new GameRuleError('INPUT', 'Ungültiges target.id.');
          if (unique.has(key(t)))
            throw new GameRuleError('INPUT', 'targets enthält Duplikate.');
          unique.add(key(t));
          if (t.kind === 'domain') {
            if (!player.holdings.domains.some((d) => d.id === t.id))
              throw new GameRuleError('INPUT', 'Unbekannte Domäne.');
          } else if (t.kind === 'cityProperty') {
            if (!player.holdings.cityProperties.some((c) => c.id === t.id))
              throw new GameRuleError(
                'INPUT',
                'Unbekannter städtischer Besitz.'
              );
          } else if (t.kind === 'organization') {
            if (!player.holdings.organizations.some((o) => o.id === t.id))
              throw new GameRuleError('INPUT', 'Unbekannte Organisation.');
          } else {
            throw new GameRuleError('INPUT', 'Ungültiges target.kind.');
          }
        }
        investments = targets.length;
        if (command.investmentPayment === 'influenceFirst') {
          investmentCosts.influence = investments * 6;
          investmentCosts.gold = investments * 2;
        } else {
          investmentCosts.influence = investments * 2;
          investmentCosts.gold = investments * 6;
        }
      }

      const baseDc = 14;
      const investDc =
        command.kind === 'loyaltySecure'
          ? investments >= 3
            ? 8
            : investments >= 2
              ? 4
              : 0
          : investments >= 8
            ? 8
            : investments >= 4
              ? 4
              : 0;
      const dcAcc = dcModsInit();
      applySpecialistDcMods(player, dcAcc);
      // Event 18: Korruptionsuntersuchung → Politische Schritte -2 DC (4 Runden).
      if (
        state.globalEvents.some(
          (e) =>
            state.round >= e.startsAtRound &&
            state.round <= e.endsAtRound &&
            e.tableRollTotal === 18
        )
      ) {
        dcModsAdd(dcAcc, -2);
      }
      const dc = dcFinalize(
        baseDc + investDc + kwDcModifier(player.politics.kw),
        dcAcc
      );

      const roll = rollD20(ctx.rng);
      const rollModifier = effectiveCheck(player.checks.influence, state.round);
      const rollTotal = roll.total + rollModifier + infoBonus;
      const tierResult = resolveSuccessTier(dc, rollTotal);

      const reduceGold = (
        baseGold: number,
        investGold: number,
        reduction: number
      ) => {
        let remaining = Math.max(0, Math.trunc(reduction));
        let nextInvest = Math.max(0, Math.trunc(investGold));
        let nextBase = Math.max(0, Math.trunc(baseGold));
        const fromInvest = Math.min(nextInvest, remaining);
        nextInvest -= fromInvest;
        remaining -= fromInvest;
        const fromBase = Math.min(nextBase, remaining);
        nextBase -= fromBase;
        remaining -= fromBase;
        return { baseGold: nextBase, investGold: nextInvest };
      };

      let finalBaseCosts = { ...baseCosts };
      let finalInvestmentCosts = { ...investmentCosts };
      let influencePenalty = 0;
      let infoGained = 0;
      const politicsDelta = { kwDelta: 0, asDelta: 0, nDelta: 0 };
      let defense:
        | {
            dc: number;
            roll: ReturnType<typeof rollD20>;
            rollModifier: number;
            rollTotal: number;
            defended: boolean;
          }
        | undefined = undefined;

      if (command.kind === 'damageDefend' || command.kind === 'manipulate') {
        const influenceInvestments =
          command.kind === 'damageDefend'
            ? command.investmentPayment === 'influence'
              ? investments
              : 0
            : command.investmentPayment === 'influenceFirst'
              ? investments
              : 0;

        if (tierResult === 'veryGood') {
          infoGained = 3;
          politicsDelta.kwDelta -= 4;
          politicsDelta.asDelta += 1;
          const reduced = reduceGold(
            finalBaseCosts.gold,
            finalInvestmentCosts.gold,
            2
          );
          finalBaseCosts.gold = reduced.baseGold;
          finalInvestmentCosts.gold = reduced.investGold;
        } else if (tierResult === 'good') {
          infoGained = 2;
          politicsDelta.kwDelta -= 2;
          const reduced = reduceGold(
            finalBaseCosts.gold,
            finalInvestmentCosts.gold,
            1
          );
          finalBaseCosts.gold = reduced.baseGold;
          finalInvestmentCosts.gold = reduced.investGold;
        } else if (tierResult === 'success') {
          infoGained = 1;
        } else if (tierResult === 'poor') {
          influencePenalty = influenceInvestments;
          politicsDelta.asDelta -= 1;
          politicsDelta.kwDelta += 2;
          politicsDelta.nDelta += 2;
        } else {
          // fail
          politicsDelta.kwDelta += 4;
          politicsDelta.nDelta += 4;

          const defenseDc = 10 + investDc;
          const dRoll = rollD20(ctx.rng);
          const dMod = defenseRollModifier(player);
          const dTotal = dRoll.total + dMod;
          const defended = dTotal >= defenseDc;
          defense = {
            dc: defenseDc,
            roll: dRoll,
            rollModifier: dMod,
            rollTotal: dTotal,
            defended,
          };

          if (!defended) {
            influencePenalty = influenceInvestments * 2;
            politicsDelta.asDelta -= 1;
          }
        }
      } else {
        // loyaltySecure
        if (tierResult === 'veryGood') {
          const reduced = reduceGold(
            finalBaseCosts.gold,
            finalInvestmentCosts.gold,
            3
          );
          finalBaseCosts.gold = reduced.baseGold;
          finalInvestmentCosts.gold = reduced.investGold;
        } else if (tierResult === 'good') {
          const reduced = reduceGold(
            finalBaseCosts.gold,
            finalInvestmentCosts.gold,
            2 * investments
          );
          finalBaseCosts.gold = reduced.baseGold;
          finalInvestmentCosts.gold = reduced.investGold;
        } else if (tierResult === 'poor') {
          finalBaseCosts = {
            gold: finalBaseCosts.gold * 2,
            influence: finalBaseCosts.influence * 2,
          };
          finalInvestmentCosts = {
            gold: finalInvestmentCosts.gold * 2,
            influence: finalInvestmentCosts.influence * 2,
          };
        }
      }

      const totalGoldSpent = finalBaseCosts.gold + finalInvestmentCosts.gold;
      const totalInfluenceSpent =
        finalBaseCosts.influence +
        finalInvestmentCosts.influence +
        influencePenalty;

      if (player.economy.gold < totalGoldSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Gold.');
      if (player.turn.influenceAvailable < totalInfluenceSpent)
        throw new GameRuleError('FUNDS', 'Nicht genug Einfluss.');

      const resolvedEvent: GameEvent = {
        type: 'PlayerPoliticalStepsResolved',
        visibility: { scope: 'private', playerId },
        playerId,
        kind: command.kind,
        size: command.size,
        investments,
        investmentPayment: (command as any).investmentPayment,
        baseCosts: finalBaseCosts,
        investmentCosts: finalInvestmentCosts,
        infoSpent,
        infoBonus,
        infoGained,
        dc,
        roll,
        rollModifier,
        rollTotal,
        tierResult,
        influencePenalty,
        politicsDelta,
        defense,
        actionCost,
        actionKey,
      } as any;

      const eventsOut: GameEvent[] = [resolvedEvent];

      if (command.kind === 'loyaltySecure') {
        const targets = command.targets ?? [];
        const loyaltyDelta =
          tierResult === 'veryGood'
            ? 2
            : tierResult === 'good'
              ? 1
              : tierResult === 'success'
                ? 1
                : tierResult === 'poor'
                  ? 1
                  : -1;
        if (loyaltyDelta) {
          eventsOut.push({
            type: 'PlayerFollowersAdjusted',
            visibility: { scope: 'private', playerId },
            playerId,
            changes: targets.map((t) => ({ location: t, loyaltyDelta })),
            reason: `Politische Schritte: Loyalität sichern (${tierResult})`,
          });
        }
      }

      return eventsOut;
    }

    case 'SetCounterReactionLossChoice': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      assertPhase(state, 'maintenance');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      if (command.choice !== 'gold' && command.choice !== 'influence') {
        throw new GameRuleError('INPUT', 'Ungültige Wahl (gold|influence).');
      }
      return [
        {
          type: 'PlayerCounterReactionLossChoiceSet',
          visibility: { scope: 'private', playerId },
          playerId,
          choice: command.choice,
        },
      ];
    }

    case 'AddPrivateNote': {
      if (!state) throw new GameRuleError('STATE', 'Kampagne existiert nicht.');
      const playerId = getActingPlayerIdOrThrow(state, ctx.actor);
      return [
        {
          type: 'PlayerPrivateNoteAdded',
          visibility: { scope: 'private', playerId },
          playerId,
          note: command.note,
        },
      ];
    }
  }
}

function postTierRank(tier: PostTier): number {
  switch (tier) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}
