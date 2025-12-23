import {
  asUserId,
  createSeededRng,
  decide,
  reduceEvents,
  type ActorContext,
  type CampaignState,
  type GameCommand,
  type PlayerState,
} from '../core';

import { getMaterialOrThrow, MATERIALS_V1 } from '../core/rules/materials_v1';

import type { Agent, RoundContext } from './types';
import { computeNetWorth, type NetWorthWeights } from './plannerScore';

type PlannerConfig = {
  id: Agent['id'];
  name: string;
  weights: NetWorthWeights;
  // How deep to look ahead in the current turn (in "runner slots", not engine actions).
  depth: number;
  // Monte-Carlo rollouts per candidate for evaluation.
  rollouts: number;
  // Hard cap for action candidates per decision.
  maxActionCandidates: number;
  // Hard cap for facility candidates (including null).
  maxFacilityCandidates: number;
};

function hashStringToSeed(input: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function patchCampaignId(command: GameCommand, campaignId: string): GameCommand {
  return { ...command, campaignId } as GameCommand;
}

function getPlayerByUserId(state: CampaignState, userId: string): PlayerState {
  const playerId = state.playerIdByUserId[asUserId(userId)];
  const player = state.players[playerId];
  if (!player) throw new Error(`Player missing for userId=${userId}`);
  return player;
}

function tryExecute(
  state: CampaignState,
  command: GameCommand,
  actor: ActorContext,
  rng: ReturnType<typeof createSeededRng>,
): CampaignState | null {
  try {
    const events = decide(state, patchCampaignId(command, state.id), { actor, rng, emitPublicLogs: false });
    return reduceEvents(state, events) as CampaignState;
  } catch {
    return null;
  }
}

function tryAdvanceToNextRoundActions(
  state: CampaignState,
  rng: ReturnType<typeof createSeededRng>,
): CampaignState | null {
  const gm: ActorContext = { role: 'gm', userId: 'gm' };

  // actions -> conversion
  let s = tryExecute(state, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  // conversion -> reset
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  // reset -> maintenance (round increments)
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  // maintenance -> actions (market + income)
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  return s;
}

function sellInvestmentCap(player: PlayerState): number {
  const tierRank = (tier: 'small' | 'medium' | 'large') => (tier === 'small' ? 1 : tier === 'medium' ? 2 : 3);
  const capFromTrade = player.holdings.tradeEnterprises.reduce((sum, te) => sum + 2 * tierRank(te.tier), 0);
  const capFromDomains = player.holdings.domains.reduce((sum, d) => sum + (d.tier === 'starter' ? 0 : tierRank(d.tier)), 0);
  return 2 + capFromTrade + capFromDomains;
}

function buyInvestmentCap(player: PlayerState): number {
  const tierRank = (tier: 'small' | 'medium' | 'large') => (tier === 'small' ? 1 : tier === 'medium' ? 2 : 3);
  const capFromTrade = player.holdings.tradeEnterprises.reduce((sum, te) => sum + 2 * tierRank(te.tier), 0);
  const capFromDomains = player.holdings.domains.reduce((sum, d) => sum + (d.tier === 'starter' ? 0 : tierRank(d.tier)), 0);
  return 3 + capFromTrade + capFromDomains;
}

function localMarketInstanceId(): string {
  return 'local';
}

function accessibleMarketInstanceIds(state: CampaignState, me: PlayerState): string[] {
  const ids = new Set<string>();
  for (const inst of state.market.instances) {
    if (!inst.ownerPlayerId || inst.ownerPlayerId === me.id) ids.add(inst.id);
  }
  ids.add(localMarketInstanceId());
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function marketModifierPerInvestment(
  state: CampaignState,
  marketInstanceId: string,
  materialId: string,
  opts: { includeSaleBonus?: boolean } = {},
): number {
  const inst =
    state.market.instances.find((i) => i.id === marketInstanceId) ??
    state.market.instances.find((i) => i.id === localMarketInstanceId()) ??
    state.market.instances[0];
  if (!inst) return 0;
  const mat = getMaterialOrThrow(materialId);
  const mods = mat.kind === 'raw' ? inst.raw.modifiersByGroup : inst.special.modifiersByGroup;
  const tableMod = Math.trunc(mods[mat.marketGroup] ?? 0);
  return opts.includeSaleBonus ? tableMod + (mat.saleBonusGold ?? 0) : tableMod;
}

function buildMoneySellForMarket(state: CampaignState, me: PlayerState, marketInstanceId: string): GameCommand | null {
  const cap = Math.max(0, sellInvestmentCap(me));
  if (cap <= 0) return null;

  type Lot = { kind: 'raw' | 'special'; materialId: string; investments: number; score: number };
  const lots: Lot[] = [];

  for (const [materialId, count] of Object.entries(me.economy.inventory.raw)) {
    const inv = Math.floor((count ?? 0) / 6);
    if (inv <= 0) continue;
    lots.push({
      kind: 'raw',
      materialId,
      investments: inv,
      score: marketModifierPerInvestment(state, marketInstanceId, materialId, { includeSaleBonus: true }),
    });
  }
  for (const [materialId, count] of Object.entries(me.economy.inventory.special)) {
    const inv = Math.floor(count ?? 0);
    if (inv <= 0) continue;
    lots.push({
      kind: 'special',
      materialId,
      investments: inv,
      score: marketModifierPerInvestment(state, marketInstanceId, materialId, { includeSaleBonus: true }),
    });
  }
  if (!lots.length) return null;

  lots.sort((a, b) => b.score - a.score || a.materialId.localeCompare(b.materialId));

  let remaining = cap;
  const rawCounts: Record<string, number> = {};
  const specialCounts: Record<string, number> = {};
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.investments, remaining);
    remaining -= take;
    if (lot.kind === 'raw') rawCounts[lot.materialId] = (rawCounts[lot.materialId] ?? 0) + take * 6;
    else specialCounts[lot.materialId] = (specialCounts[lot.materialId] ?? 0) + take;
  }

  const items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  > = [];
  for (const [materialId, count] of Object.entries(rawCounts)) items.push({ kind: 'raw', materialId, count });
  for (const [materialId, count] of Object.entries(specialCounts)) items.push({ kind: 'special', materialId, count });
  if (!items.length) return null;
  return { type: 'MoneySell', campaignId: '', marketInstanceId, items };
}

function buildMoneySellCandidates(state: CampaignState, me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];
  for (const marketId of accessibleMarketInstanceIds(state, me)) {
    const cmd = buildMoneySellForMarket(state, me, marketId);
    if (cmd) out.push(cmd);
  }
  return out;
}

function buildGainInfluence(me: PlayerState, kind: 'temporary' | 'permanent'): GameCommand | null {
  const capTemporary = (() => {
    const hasAnySmall = me.holdings.offices.length > 0 || me.holdings.organizations.length > 0;
    const hasAnyMedium =
      me.holdings.offices.some((o) => o.tier === 'medium' || o.tier === 'large') ||
      me.holdings.organizations.some((o) => o.tier === 'medium' || o.tier === 'large');
    const hasAnyLarge =
      me.holdings.offices.some((o) => o.tier === 'large') || me.holdings.organizations.some((o) => o.tier === 'large');
    return hasAnyLarge ? 12 : hasAnyMedium ? 8 : hasAnySmall ? 6 : 4;
  })();

  const capPermanent =
    2 +
    me.holdings.offices.reduce((sum, o) => sum + (o.tier === 'small' ? 1 : o.tier === 'medium' ? 2 : 3), 0) +
    me.holdings.organizations.reduce((sum, o) => sum + (o.tier === 'small' ? 1 : o.tier === 'medium' ? 2 : 3), 0);

  const cap = kind === 'temporary' ? capTemporary : capPermanent;
  const goldPerInvestment = kind === 'temporary' ? 1 : 2;
  const maxAffordable = Math.floor(me.economy.gold / goldPerInvestment);
  const investments = Math.min(cap, maxAffordable);
  if (investments <= 0) return null;
  return { type: 'GainInfluence', campaignId: '', kind, investments };
}

function buildGainMaterials(me: PlayerState, mode: 'domainAdministration' | 'workshopOversight'): GameCommand | null {
  const labor = Math.max(0, me.turn.laborAvailable);
  if (labor <= 0) return null;
  if (mode === 'domainAdministration') {
    // Pick the biggest domain (starter counts as rank 1).
    const rank = (tier: PlayerState['holdings']['domains'][number]['tier']) =>
      tier === 'starter' ? 1 : tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
    const sorted = [...me.holdings.domains].sort((a, b) => rank(b.tier) - rank(a.tier));
    const target = sorted[0];
    if (!target) return null;
    const cap = 4 * rank(target.tier);
    const investments = Math.min(labor, cap);
    if (investments <= 0) return null;
    return { type: 'GainMaterials', campaignId: '', mode, investments, targetId: target.id };
  }

  // workshopOversight
  const tierRank = (tier: 'small' | 'medium' | 'large') => (tier === 'small' ? 1 : tier === 'medium' ? 2 : 3);
  const sorted = [...me.holdings.workshops].sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
  const target = sorted[0];
  if (!target) return null;
  const cap = 2 * tierRank(target.tier);
  const investments = Math.min(labor, cap);
  if (investments <= 0) return null;
  return { type: 'GainMaterials', campaignId: '', mode, investments, targetId: target.id };
}

function buildMoneyLend(me: PlayerState): GameCommand | null {
  const tierRank = (tier: 'small' | 'medium' | 'large') => (tier === 'small' ? 1 : tier === 'medium' ? 2 : 3);
  const maxTradeTier = Math.max(0, ...me.holdings.tradeEnterprises.map((t) => tierRank(t.tier)));
  const cap = maxTradeTier === 0 ? 2 : maxTradeTier === 1 ? 4 : maxTradeTier === 2 ? 6 : 10;
  const maxAffordable = Math.floor(me.economy.gold / 2);
  const investments = Math.min(cap, maxAffordable);
  if (investments <= 0) return null;
  return { type: 'MoneyLend', campaignId: '', investments };
}

function buildAcquireOffice(me: PlayerState): GameCommand[] {
  const tierRank = (tier: 'small' | 'medium' | 'large') => (tier === 'small' ? 1 : tier === 'medium' ? 2 : 3);
  const out: GameCommand[] = [];
  const tiers: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
  for (const tier of tiers) {
    if (tier === 'medium' && me.holdings.offices.filter((o) => o.tier === 'small').length < 2) continue;
    if (tier === 'large' && me.holdings.offices.filter((o) => o.tier === 'medium').length < 2) continue;
    // Try both payment mixes; engine will validate affordability.
    out.push({ type: 'AcquireOffice', campaignId: '', tier, payment: 'goldFirst' });
    out.push({ type: 'AcquireOffice', campaignId: '', tier, payment: 'influenceFirst' });
    // Minor pruning: if we're far from affording either payment, skip.
    const minGold = tier === 'small' ? 4 : tier === 'medium' ? 10 : 24;
    if (me.economy.gold < minGold && me.turn.influenceAvailable < 2 * tierRank(tier)) {
      out.pop();
      out.pop();
    }
  }
  return out;
}

function buildAcquireCityProperty(me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];
  const tiers: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
  for (const tier of tiers) {
    const minGold = tier === 'small' ? 15 : tier === 'medium' ? 25 : 50;
    if (me.economy.gold < minGold) continue;
    out.push({ type: 'AcquireCityProperty', campaignId: '', tier });
  }
  return out;
}

function buildAcquireDomain(me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];
  const tiers: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
  for (const tier of tiers) {
    const minGold = tier === 'small' ? 25 : tier === 'medium' ? 60 : 120;
    if (me.economy.gold < minGold) continue;
    out.push({ type: 'AcquireDomain', campaignId: '', tier });
  }
  return out;
}

function buildAcquireTradeEnterprise(me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];
  const tiers: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
  for (const tier of tiers) {
    const minGold = tier === 'small' ? 20 : tier === 'medium' ? 40 : 80;
    if (me.economy.gold < minGold) continue;
    out.push({ type: 'AcquireTradeEnterprise', campaignId: '', tier });
  }
  return out;
}

function buildAcquireOrganizations(): GameCommand[] {
  const kinds: Array<'underworld' | 'spy' | 'cult' | 'collegiumTrade' | 'collegiumCraft'> = [
    'underworld',
    'spy',
    'cult',
    'collegiumTrade',
    'collegiumCraft',
  ];
  const out: GameCommand[] = [];
  for (const kind of kinds) {
    out.push({ type: 'AcquireOrganization', campaignId: '', kind });
  }
  return out;
}

function buildAcquireTenants(me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];
  for (const d of me.holdings.domains) {
    if (d.tier === 'starter') continue;
    const cap = d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : 8;
    if (d.tenants.levels >= cap) continue;
    out.push({ type: 'AcquireTenants', campaignId: '', location: { kind: 'domain', id: d.id }, levels: 1 });
  }
  for (const c of me.holdings.cityProperties) {
    const cap = c.tier === 'small' ? 2 : c.tier === 'medium' ? 3 : 4;
    if (c.tenants.levels >= cap) continue;
    out.push({ type: 'AcquireTenants', campaignId: '', location: { kind: 'cityProperty', id: c.id }, levels: 1 });
  }
  for (const o of me.holdings.organizations) {
    if (o.kind === 'spy') continue;
    const tierRank = o.tier === 'small' ? 1 : o.tier === 'medium' ? 2 : 3;
    const cap = o.kind === 'underworld' ? 2 * tierRank : o.kind === 'cult' ? (tierRank === 1 ? 2 : tierRank === 2 ? 4 : 8) : tierRank;
    if (o.followers.levels >= cap) continue;
    out.push({ type: 'AcquireTenants', campaignId: '', location: { kind: 'organization', id: o.id }, levels: 1 });
  }
  return out;
}

function buildRecruitTroops(): GameCommand[] {
  const out: GameCommand[] = [];
  // Keep this small: 1 level as a "test" buy.
  for (const troopKind of ['bodyguard', 'militia', 'mercenary', 'thug'] as const) {
    out.push({ type: 'RecruitTroops', campaignId: '', troopKind, levels: 1 });
  }
  return out;
}

function buildMoneyBuyCandidates(state: CampaignState, me: PlayerState): GameCommand[] {
  const cap = Math.max(0, buyInvestmentCap(me));
  if (cap <= 0) return [];

  const out: GameCommand[] = [];

  // Buy 1 permanent labor (if affordable).
  if (me.economy.gold >= 8) {
    out.push({
      type: 'MoneyBuy',
      campaignId: '',
      marketInstanceId: localMarketInstanceId(),
      items: [{ kind: 'labor', count: 1 }],
    });
  }

  // Buy 5 raw of the "best price" material this round.
  // (We approximate "best" via market modifier only; engine will apply full pricing + checks.)
  let bestRaw: { id: string; score: number } | null = null;
  for (const material of Object.values(MATERIALS_V1)) {
    if (material.kind !== 'raw') continue;
    const score = marketModifierPerInvestment(state, localMarketInstanceId(), material.id);
    if (!bestRaw || score > bestRaw.score || (score === bestRaw.score && material.id < bestRaw.id)) {
      bestRaw = { id: material.id, score };
    }
  }
  if (bestRaw && me.economy.gold >= 3) {
    out.push({
      type: 'MoneyBuy',
      campaignId: '',
      marketInstanceId: localMarketInstanceId(),
      items: [{ kind: 'raw', materialId: bestRaw.id, count: 5 }],
    });
  }

  // Buy 1 special of the "best price" material this round.
  let bestSpecial: { id: string; score: number } | null = null;
  for (const material of Object.values(MATERIALS_V1)) {
    if (material.kind !== 'special') continue;
    const score = marketModifierPerInvestment(state, localMarketInstanceId(), material.id);
    if (!bestSpecial || score > bestSpecial.score || (score === bestSpecial.score && material.id < bestSpecial.id)) {
      bestSpecial = { id: material.id, score };
    }
  }
  if (bestSpecial && me.economy.gold >= 3) {
    out.push({
      type: 'MoneyBuy',
      campaignId: '',
      marketInstanceId: localMarketInstanceId(),
      items: [{ kind: 'special', materialId: bestSpecial.id, count: 1 }],
    });
  }

  return out.slice(0, 3);
}

function buildFacilityCandidates(me: PlayerState): GameCommand[] {
  const out: GameCommand[] = [];

  // Upgrade starter domain.
  const starter = me.holdings.domains.find((d) => d.tier === 'starter');
  if (starter && me.economy.gold >= 10 && me.turn.laborAvailable >= 4) {
    out.push({ type: 'UpgradeStarterDomain', campaignId: '', domainId: starter.id });
  }

  // Build small storage on first non-starter domain (or production city).
  const domain = me.holdings.domains.find((d) => d.tier !== 'starter');
  if (domain && me.economy.gold >= 8) {
    const has = me.holdings.storages.some((s) => s.location.kind === 'domain' && s.location.id === domain.id);
    if (!has) out.push({ type: 'BuildStorage', campaignId: '', location: { kind: 'domain', id: domain.id }, tier: 'small' });
  }

  // Build small workshop on first non-starter domain.
  if (domain && me.economy.gold >= 8) {
    const used = me.holdings.workshops.some((w) => w.location.kind === 'domain' && w.location.id === domain.id);
    if (!used) out.push({ type: 'BuildWorkshop', campaignId: '', location: { kind: 'domain', id: domain.id }, tier: 'small' });
  }

  // Domain specialization (first available non-starter domain).
  if (domain && !domain.specialization) {
    out.push({ type: 'SetDomainSpecialization', campaignId: '', domainId: domain.id, kind: 'agriculture' });
    out.push({ type: 'SetDomainSpecialization', campaignId: '', domainId: domain.id, kind: 'forestry' });
    out.push({ type: 'SetDomainSpecialization', campaignId: '', domainId: domain.id, kind: 'mining' });
    out.push({ type: 'SetDomainSpecialization', campaignId: '', domainId: domain.id, kind: 'animalHusbandry' });
  }

  return out;
}

type ScoredCommand = { command: GameCommand; score: number };

function cmdKey(command: GameCommand): string {
  // Stable key for deterministic tie-breaking.
  return JSON.stringify(command);
}

function evaluateTerminal(
  state: CampaignState,
  ctx: { userId: string; weights: NetWorthWeights; seedSalt: string; rollouts: number },
): number {
  const { userId, weights, seedSalt, rollouts } = ctx;

  let sum = 0;
  for (let i = 0; i < rollouts; i += 1) {
    const rng = createSeededRng(hashStringToSeed(`${seedSalt}|eval|${i}`));
    const next = tryAdvanceToNextRoundActions(state, rng);
    if (!next) continue;
    const me = getPlayerByUserId(next, userId);
    sum += computeNetWorth(next, me, weights).score;
  }

  return rollouts > 0 ? sum / rollouts : Number.NEGATIVE_INFINITY;
}

function chooseBestAction(
  state: CampaignState,
  ctx: {
    userId: string;
    weights: NetWorthWeights;
    seedSalt: string;
    depth: number;
    rollouts: number;
    maxCandidates: number;
  },
): ScoredCommand[] {
  const me = getPlayerByUserId(state, ctx.userId);
  const actor: ActorContext = { role: 'player', userId: ctx.userId };

  const candidates: GameCommand[] = [
    ...buildAcquireOffice(me),
    ...buildAcquireCityProperty(me),
    ...buildAcquireDomain(me),
    ...buildAcquireTradeEnterprise(me),
    ...buildAcquireOrganizations(),
    ...buildAcquireTenants(me),
    ...buildRecruitTroops(),
    ...buildMoneyBuyCandidates(state, me),
  ];

  candidates.push(...buildMoneySellCandidates(state, me));

  const lend = buildMoneyLend(me);
  if (lend) candidates.push(lend);

  const gm = buildGainMaterials(me, 'domainAdministration');
  if (gm) candidates.push(gm);
  const gw = buildGainMaterials(me, 'workshopOversight');
  if (gw) candidates.push(gw);

  const infTemp = buildGainInfluence(me, 'temporary');
  if (infTemp) candidates.push(infTemp);
  const infPerm = buildGainInfluence(me, 'permanent');
  if (infPerm) candidates.push(infPerm);

  // Rough pruning: prefer commands that are at least plausible with current funds.
  // (Engine validation is still authoritative.)
  const trimmed = candidates.slice(0, Math.max(0, ctx.maxCandidates));

  const scored: ScoredCommand[] = [];
  for (const command of trimmed) {
    let sum = 0;
    let samples = 0;
    for (let i = 0; i < ctx.rollouts; i += 1) {
      const rng = createSeededRng(hashStringToSeed(`${ctx.seedSalt}|a0|${cmdKey(command)}|${i}`));
      const next = tryExecute(state, command, actor, rng);
      if (!next) continue;

      let value = 0;
      if (ctx.depth <= 1) {
        value = evaluateTerminal(next, {
          userId: ctx.userId,
          weights: ctx.weights,
          seedSalt: `${ctx.seedSalt}|leaf|${cmdKey(command)}|${i}`,
          rollouts: 1,
        });
      } else {
        const deeper = chooseBestAction(next, { ...ctx, depth: ctx.depth - 1, seedSalt: `${ctx.seedSalt}|d1|${cmdKey(command)}|${i}` });
        const bestChild = deeper[0];
        const leafState = bestChild
          ? (() => {
              const rng2 = createSeededRng(hashStringToSeed(`${ctx.seedSalt}|a1|${cmdKey(command)}|${cmdKey(bestChild.command)}|${i}`));
              return tryExecute(next, bestChild.command, actor, rng2);
            })()
          : null;
        value = evaluateTerminal(leafState ?? next, {
          userId: ctx.userId,
          weights: ctx.weights,
          seedSalt: `${ctx.seedSalt}|leaf2|${cmdKey(command)}|${i}`,
          rollouts: 1,
        });
      }

      sum += value;
      samples += 1;
    }
    if (samples > 0) scored.push({ command, score: sum / samples });
  }

  scored.sort((a, b) => b.score - a.score || cmdKey(a.command).localeCompare(cmdKey(b.command)));
  return scored;
}

export function createPlannerAgent(config: PlannerConfig): Agent {
  return {
    id: config.id,
    name: config.name,
    decideFacility(ctx: RoundContext) {
      const me = ctx.me;
      const candidates = [null, ...buildFacilityCandidates(me)].filter(Boolean) as Array<GameCommand | null>;
      const trimmed = candidates.slice(0, Math.max(1, config.maxFacilityCandidates));
      const actor: ActorContext = { role: 'player', userId: ctx.profile.userId };

      let best: { cmd: GameCommand | null; score: number } = { cmd: null, score: Number.NEGATIVE_INFINITY };
      for (const facility of trimmed) {
        const salt = `${ctx.state.id}|${ctx.profile.playerId}|r${ctx.round}|facility|${facility ? cmdKey(facility) : 'none'}`;
        const rng = createSeededRng(hashStringToSeed(salt));
        const next = facility ? tryExecute(ctx.state, facility, actor, rng) : ctx.state;
        if (!next) continue;

        const scored = chooseBestAction(next, {
          userId: ctx.profile.userId,
          weights: config.weights,
          seedSalt: `${salt}|actions`,
          depth: config.depth,
          rollouts: config.rollouts,
          maxCandidates: config.maxActionCandidates,
        });
        const top = scored[0];
        const score =
          top?.score ??
          evaluateTerminal(next, {
            userId: ctx.profile.userId,
            weights: config.weights,
            seedSalt: `${salt}|terminal`,
            rollouts: config.rollouts,
          });

        if (score > best.score) best = { cmd: facility, score };
      }

      return best.cmd;
    },
    decideActions(ctx: RoundContext) {
      const salt = `${ctx.state.id}|${ctx.profile.playerId}|r${ctx.round}|slot|used=${ctx.me.turn.actionsUsed}|keys=${ctx.me.turn.actionKeysUsed.join(';')}`;
      const scored = chooseBestAction(ctx.state, {
        userId: ctx.profile.userId,
        weights: config.weights,
        seedSalt: salt,
        depth: config.depth,
        rollouts: config.rollouts,
        maxCandidates: config.maxActionCandidates,
      });
      return scored.map((s) => s.command);
    },
  };
}
