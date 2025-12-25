import { type LanguageModel, Output, generateText } from 'ai';
import { z } from 'zod';

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
import { facilityInfluencePerRound, workshopFacilitySlotsMax } from '../core/rules/v1';
import { getMaterialOrThrow, MATERIALS_V1 } from '../core/rules/materials_v1';

import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { llmEnv } from '../llm/env';
import {
  computeNetWorth,
  FULL_NET_WORTH_WEIGHTS,
  type NetWorthWeights,
} from './plannerScore';
import {
  bonusMaterialsSlots,
  bonusMoneySlots,
  hasRemainingInfluenceBonus,
  hasUsedCanonicalAction,
  hasUsedMarker,
  remainingInfluenceBonusSlots,
} from './turnRules';
import type { StrategyCard } from './types';

export type AgentCommand = GameCommand;

type Candidate = {
  id: string;
  kind: 'facility' | 'action';
  command: AgentCommand;
  actionKey: string | null;
  possibleNow: boolean;
  summary: string;
};

type McCandidate = {
  id: string;
  kind: 'facility' | 'action';
  command: GameCommand | null;
  summary: string;
  possibleNow: boolean;
};

type McScoredCandidate = {
  candidate: McCandidate;
  mean: number;
  p10: number;
  p90: number;
  samples: number;
};

const MC_TOP_N_ACTION = 8;
const MC_TOP_N_FACILITY = 6;
const MC_ROLLOUTS = 2;
const MC_DEPTH = 3;
const MC_MAX_ACTION_CANDIDATES = 18;

export type LlmFacilityPlan = {
  facility: AgentCommand | null;
  note: string | null;
  debug?: {
    facilityCandidates: Candidate[];
    rawModelOutput: unknown;
  };
};

export type LlmActionPlan = {
  action: AgentCommand | null;
  note: string | null;
  debug?: {
    actionCandidates: Candidate[];
    rawModelOutput: unknown;
  };
};

const facilityDecisionSchema = z.object({
  facilityCandidateId: z.string().nullable(),
  note: z.string().min(1).max(400),
});

const actionDecisionSchema = z.object({
  actionCandidateId: z.string(),
  note: z.string().min(1).max(400),
});

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
}

function formatStockSummary(
  stock: Record<string, number>,
  limit = 6
): string {
  const entries = Object.entries(stock)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => `${id}x${Math.trunc(count ?? 0)}`);
  return entries.length > 0 ? entries.join(', ') : '-';
}

type McContext = {
  userId: string;
  weights: NetWorthWeights;
  seedSalt: string;
  rollouts: number;
  depth: number;
  bufferFactor: number;
  maxActionCandidates: number;
};

function hashStringToSeed(input: string): number {
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
  rng: ReturnType<typeof createSeededRng>
): CampaignState | null {
  try {
    const events = decide(state, patchCampaignId(command, state.id), {
      actor,
      rng,
      emitPublicLogs: false,
    });
    return reduceEvents(state, events) as CampaignState;
  } catch {
    return null;
  }
}

function tryAdvanceToNextRoundActions(
  state: CampaignState,
  rng: ReturnType<typeof createSeededRng>
): CampaignState | null {
  const gm: ActorContext = { role: 'gm', userId: 'gm' };
  let s = tryExecute(state, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  s = tryExecute(s, { type: 'AdvancePhase', campaignId: '' }, gm, rng);
  if (!s) return null;
  return s;
}

function weightsForStrategy(strategyCard?: StrategyCard): NetWorthWeights {
  if (!strategyCard?.title) return { ...FULL_NET_WORTH_WEIGHTS };
  return { ...FULL_NET_WORTH_WEIGHTS };
}

function evaluateTerminalOnce(state: CampaignState, ctx: McContext, tag: string): number | null {
  const rng = createSeededRng(hashStringToSeed(`${ctx.seedSalt}|terminal|${tag}`));
  const next = tryAdvanceToNextRoundActions(state, rng);
  if (!next) return null;
  const me = getPlayerByUserId(next, ctx.userId);
  return computeNetWorth(next, me, ctx.weights).score;
}

function pickBestFollowUpScore(state: CampaignState, ctx: McContext, tag: string): number | null {
  if (ctx.depth <= 1) return null;
  const me = getPlayerByUserId(state, ctx.userId);
  const actionCandidates = buildActionCandidates({
    round: state.round,
    me,
    state: { market: state.market },
    bufferFactor: ctx.bufferFactor,
  });
  const allowed = filterActionCandidates(
    me,
    actionCandidates,
    state.rules.actionsPerRound
  ).slice(
    0,
    Math.max(1, ctx.maxActionCandidates)
  );
  if (allowed.length === 0) return null;
  const actor: ActorContext = { role: 'player', userId: ctx.userId };
  let best: number | null = null;
  for (const candidate of allowed) {
    const rng = createSeededRng(
      hashStringToSeed(`${ctx.seedSalt}|follow|${tag}|${candidate.id}`)
    );
    const next = tryExecute(state, candidate.command, actor, rng);
    if (!next) continue;
    const score = evaluateTerminalOnce(next, ctx, `${tag}|${candidate.id}`);
    if (score == null) continue;
    if (best == null || score > best) best = score;
  }
  return best;
}

function scoreCandidateWithMc(
  state: CampaignState,
  candidate: McCandidate,
  ctx: McContext
): McScoredCandidate | null {
  const actor: ActorContext = { role: 'player', userId: ctx.userId };
  const samples: number[] = [];
  for (let i = 0; i < ctx.rollouts; i += 1) {
    const rng = createSeededRng(
      hashStringToSeed(`${ctx.seedSalt}|cand|${candidate.id}|${i}`)
    );
    const next = candidate.command ? tryExecute(state, candidate.command, actor, rng) : state;
    if (!next) continue;
    const tag = `${candidate.id}|${i}`;
    const followUp = pickBestFollowUpScore(next, ctx, tag);
    const score = followUp ?? evaluateTerminalOnce(next, ctx, tag);
    if (score == null) continue;
    samples.push(score);
  }
  if (samples.length === 0) return null;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const p10 = sorted[Math.floor((sorted.length - 1) * 0.1)];
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  return { candidate, mean, p10, p90, samples: samples.length };
}

function scoreCandidatesWithMc(
  state: CampaignState,
  candidates: McCandidate[],
  ctx: McContext
): McScoredCandidate[] {
  const scored: McScoredCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.possibleNow) continue;
    const score = scoreCandidateWithMc(state, candidate, ctx);
    if (score) scored.push(score);
  }
  scored.sort((a, b) => b.mean - a.mean || a.candidate.id.localeCompare(b.candidate.id));
  return scored;
}

function scoreCandidatesFallback(
  state: CampaignState,
  candidates: McCandidate[],
  ctx: McContext,
  tag: string
): McScoredCandidate[] {
  const actor: ActorContext = { role: 'player', userId: ctx.userId };
  const scored: McScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.possibleNow) continue;
    const rng = createSeededRng(
      hashStringToSeed(`${ctx.seedSalt}|fallback|${tag}|${candidate.id}`)
    );
    const next = candidate.command
      ? tryExecute(state, candidate.command, actor, rng)
      : state;
    if (!next) continue;

    const terminal = evaluateTerminalOnce(next, ctx, `fallback|${tag}|${candidate.id}`);
    const score =
      terminal ??
      (() => {
        try {
          const me = getPlayerByUserId(next, ctx.userId);
          return computeNetWorth(next, me, ctx.weights).score;
        } catch {
          return null;
        }
      })();
    if (score == null) continue;

    scored.push({ candidate, mean: score, p10: score, p90: score, samples: 1 });
  }

  scored.sort((a, b) => b.mean - a.mean || a.candidate.id.localeCompare(b.candidate.id));
  return scored;
}

function formatMcScore(score: McScoredCandidate): string {
  const fmt = (value: number) => Math.round(value * 100) / 100;
  return `mc=${fmt(score.mean)} p10=${fmt(score.p10)} p90=${fmt(score.p90)}`;
}

function postTierRank(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
}

function domainTierRank(tier: 'starter' | 'small' | 'medium' | 'large'): number {
  return tier === 'starter' ? 0 : postTierRank(tier);
}

const COST_BUFFER = 1.1;
const ROLL_COST_MULTIPLIER_WORST = 1.1;

function buffered(cost: number, bufferFactor: number): number {
  return Math.ceil(cost * bufferFactor);
}

function worstCaseCost(cost: number, bufferFactor: number): number {
  return Math.ceil(cost * Math.max(ROLL_COST_MULTIPLIER_WORST, bufferFactor));
}

function bufferFactorForStrategy(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): number {
  if (strategyCard?.risk === 'aggressive') return 1;
  if (strategyCard?.risk === 'conservative') return COST_BUFFER;
  const hay = systemPreamble?.toLowerCase() ?? '';
  if (hay.includes('risiko') && hay.includes('hoch')) return 1;
  return COST_BUFFER;
}

function roundCheckBonus(round: number): number {
  return Math.floor(Math.max(1, round) / 10);
}

function effectiveCheckValue(base: number, round: number): number {
  return base + roundCheckBonus(round);
}

type OfficeRequirement = {
  tier: 'small' | 'medium' | 'large';
  payment: 'goldFirst' | 'influenceFirst';
  gold: number;
  influence: number;
};

function strategyWantsOffices(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): boolean {
  const parts: string[] = [];
  if (strategyCard?.title) parts.push(strategyCard.title);
  if (strategyCard?.primary) parts.push(...strategyCard.primary);
  if (strategyCard?.secondary) parts.push(...strategyCard.secondary);
  if (systemPreamble) parts.push(systemPreamble);
  const hay = parts.join(' ').toLowerCase();
  return hay.includes('amt') || hay.includes('aemter');
}

function strategyWantsMoney(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): boolean {
  const parts: string[] = [];
  if (strategyCard?.title) parts.push(strategyCard.title);
  if (strategyCard?.primary) parts.push(...strategyCard.primary);
  if (strategyCard?.secondary) parts.push(...strategyCard.secondary);
  if (systemPreamble) parts.push(systemPreamble);
  const hay = parts.join(' ').toLowerCase();
  return (
    hay.includes('handel') ||
    hay.includes('geld') ||
    hay.includes('money') ||
    hay.includes('trade')
  );
}

function strategyWantsUnderworld(
  strategyCard?: StrategyCard,
  systemPreamble?: string
): boolean {
  const parts: string[] = [];
  if (strategyCard?.title) parts.push(strategyCard.title);
  if (strategyCard?.primary) parts.push(...strategyCard.primary);
  if (strategyCard?.secondary) parts.push(...strategyCard.secondary);
  if (strategyCard?.avoid) parts.push(...strategyCard.avoid);
  if (systemPreamble) parts.push(systemPreamble);
  const hay = parts.join(' ').toLowerCase();
  return hay.includes('unterwelt');
}

function underworldTier(me: PlayerState): number {
  return Math.max(
    0,
    ...me.holdings.organizations
      .filter((o) => o.kind === 'underworld')
      .map((o) => postTierRank(o.tier))
  );
}

function isInfluencePostCommand(cmd?: GameCommand | null): boolean {
  if (!cmd) return false;
  if (cmd.type === 'AcquireOffice') return true;
  if (cmd.type === 'AcquireOrganization') return true;
  if (cmd.type === 'AcquireTenants') return true;
  if (cmd.type === 'RecruitTroops') {
    return cmd.troopKind === 'bodyguard' || cmd.troopKind === 'thug';
  }
  return false;
}

function findTempInfluenceUnlockCandidate(params: {
  state: CampaignState;
  me: PlayerState;
  userId: string;
  round: number;
  actionSlot: number;
  actionsPerRound: number;
  actionCandidates: Candidate[];
  allowedCandidates: Candidate[];
}): Candidate | null {
  const {
    state,
    me,
    userId,
    round,
    actionSlot,
    actionsPerRound,
    actionCandidates,
    allowedCandidates,
  } = params;

  const baseRemaining = actionsPerRound - me.turn.actionsUsed;
  const canUseBonusInfluence = hasRemainingInfluenceBonus(me);
  const canTempThenPost =
    baseRemaining >= 2 || (baseRemaining >= 1 && canUseBonusInfluence);
  if (!canTempThenPost) return null;

  const alreadyPossiblePost = allowedCandidates.some((c) =>
    isInfluencePostCommand(c.command)
  );
  if (alreadyPossiblePost) return null;

  const tempCandidates = allowedCandidates
    .filter(
      (c) =>
        c.command?.type === 'GainInfluence' && c.command.kind === 'temporary'
    )
    .sort((a, b) => {
      const aInv =
        a.command?.type === 'GainInfluence' ? a.command.investments : 0;
      const bInv =
        b.command?.type === 'GainInfluence' ? b.command.investments : 0;
      return aInv - bInv;
    });
  if (tempCandidates.length === 0) return null;

  const postCandidates = actionCandidates.filter((c) =>
    isInfluencePostCommand(c.command)
  );
  if (postCandidates.length === 0) return null;

  const actor: ActorContext = { role: 'player', userId };

  for (const temp of tempCandidates) {
    const tempRng = createSeededRng(
      hashStringToSeed(
        `${state.id}|${userId}|r${round}|slot${actionSlot}|temp|${temp.id}`
      )
    );
    const tempState = tryExecute(state, temp.command!, actor, tempRng);
    if (!tempState) continue;
    for (const post of postCandidates) {
      const postRng = createSeededRng(
        hashStringToSeed(
          `${state.id}|${userId}|r${round}|slot${actionSlot}|post|${temp.id}|${post.id}`
        )
      );
      const postState = tryExecute(tempState, post.command!, actor, postRng);
      if (postState) return temp;
    }
  }

  return null;
}

function officeRequirements(me: PlayerState): OfficeRequirement[] {
  const out: OfficeRequirement[] = [
    { tier: 'small', payment: 'goldFirst', gold: 8, influence: 2 },
    { tier: 'small', payment: 'influenceFirst', gold: 4, influence: 8 },
  ];

  const smallCount = me.holdings.offices.filter((o) => o.tier === 'small').length;
  const mediumCount = me.holdings.offices.filter((o) => o.tier === 'medium').length;

  if (smallCount >= 2) {
    out.push(
      { tier: 'medium', payment: 'goldFirst', gold: 18, influence: 8 },
      { tier: 'medium', payment: 'influenceFirst', gold: 10, influence: 18 }
    );
  }
  if (mediumCount >= 2) {
    out.push(
      { tier: 'large', payment: 'goldFirst', gold: 70, influence: 20 },
      { tier: 'large', payment: 'influenceFirst', gold: 24, influence: 70 }
    );
  }

  return out;
}

function pickTempInfluenceForOffice(params: {
  me: PlayerState;
  actionsPerRound: number;
  candidates: Candidate[];
  strategyCard?: StrategyCard;
  systemPreamble?: string;
  bufferFactor: number;
}): Candidate | null {
  const { me, actionsPerRound, candidates, strategyCard, systemPreamble } =
    params;
  const { bufferFactor } = params;
  if (!strategyWantsOffices(strategyCard, systemPreamble)) return null;
  if (candidates.some((c) => c.actionKey === 'acquire.office')) return null;

  const tempCandidates = candidates
    .filter(
      (
        c
      ): c is Candidate & {
        command: Extract<GameCommand, { type: 'GainInfluence' }>;
      } =>
        c.command.type === 'GainInfluence' &&
        c.command.kind === 'temporary' &&
        Number.isFinite(c.command.investments)
    )
    .map((c) => ({
      candidate: c,
      investments: Math.trunc(c.command.investments),
    }))
    .filter((c) => c.investments > 0)
    .sort((a, b) => a.investments - b.investments);

  if (tempCandidates.length === 0) return null;

  const baseRemaining = Math.max(0, actionsPerRound - me.turn.actionsUsed);
  const influenceUsesBase =
    !hasUsedCanonicalAction(me, 'influence') && baseRemaining >= 1;
  const canTakeOfficeAfterInfluence = influenceUsesBase
    ? baseRemaining >= 2
    : baseRemaining >= 1;
  if (!canTakeOfficeAfterInfluence) return null;

  const requirements = officeRequirements(me);
  const currentInfluence = me.turn.influenceAvailable;

  for (const req of requirements) {
    const neededInfluence = worstCaseCost(req.influence, bufferFactor);
    const shortfall = neededInfluence - currentInfluence;
    if (shortfall <= 0) continue;

    for (const temp of tempCandidates) {
      const minGain = Math.max(1, temp.investments * 2);
      const goldAfterTemp = me.economy.gold - temp.investments;
      if (goldAfterTemp < worstCaseCost(req.gold, bufferFactor)) continue;
      if (minGain >= shortfall) return temp.candidate;
    }

    for (const temp of tempCandidates) {
      const expectedGain = temp.investments * 4;
      const goldAfterTemp = me.economy.gold - temp.investments;
      if (goldAfterTemp < worstCaseCost(req.gold, bufferFactor)) continue;
      if (expectedGain >= shortfall) return temp.candidate;
    }
  }

  return null;
}

function pickBudgetOptions(max: number): number[] {
  if (max <= 0) return [];
  const mid = Math.ceil(max / 2);
  const raw = [1, mid, max].filter((v) => v > 0 && v <= max);
  return Array.from(new Set(raw));
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function sellInvestmentCap(me: PlayerState): number {
  const capFromTrade = me.holdings.tradeEnterprises.reduce(
    (sum, te) => sum + 2 * postTierRank(te.tier),
    0
  );
  const capFromDomains = me.holdings.domains.reduce(
    (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
    0
  );
  return 2 + capFromTrade + capFromDomains;
}

function buyInvestmentCap(me: PlayerState): number {
  const capFromTrade = me.holdings.tradeEnterprises.reduce(
    (sum, te) => sum + 2 * postTierRank(te.tier),
    0
  );
  const capFromDomains = me.holdings.domains.reduce(
    (sum, d) => sum + (d.tier === 'starter' ? 0 : postTierRank(d.tier)),
    0
  );
  return 3 + capFromTrade + capFromDomains;
}

function tierUnits(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 4;
}

function domainFacilitySlotsMax(tier: 'starter' | 'small' | 'medium' | 'large'): number {
  if (tier === 'starter') return 0;
  return 2 * postTierRank(tier);
}

function cityFacilitySlotsMax(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 2 : tier === 'medium' ? 3 : 4;
}

function productionCapacityUnitsMaxForCity(tier: 'small' | 'medium' | 'large'): number {
  return 2 * tierUnits(tier);
}

function domainProductionCaps(tier: 'starter' | 'small' | 'medium' | 'large'): {
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
  holdings: PlayerState['holdings'],
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
    if (options.excludeWorkshopId && w.id === options.excludeWorkshopId) continue;
    if (w.tier === 'small') small += 1;
    else if (w.tier === 'medium') medium += 1;
    else large += 1;
  }
  for (const s of holdings.storages) {
    if (s.location.kind !== 'domain') continue;
    if (s.location.id !== domainId) continue;
    if (options.excludeStorageId && s.id === options.excludeStorageId) continue;
    if (s.tier === 'small') small += 1;
    else if (s.tier === 'medium') medium += 1;
    else large += 1;
  }
  return { small, medium, large, total: small + medium + large };
}

function countFacilitySlotsUsedAtDomain(
  holdings: PlayerState['holdings'],
  domainId: string
): number {
  const domain = holdings.domains.find((d) => d.id === domainId);
  if (!domain) return 0;
  const workshopSlots = holdings.workshops.filter(
    (w) =>
      w.location.kind === 'domain' &&
      w.location.id === domainId &&
      w.id !== 'workshop-starter'
  ).length;
  const storageSlots = holdings.storages.filter(
    (s) => s.location.kind === 'domain' && s.location.id === domainId
  ).length;
  const specSlots = domain.specialization?.facilities?.length ?? 0;
  return domain.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countFacilitySlotsUsedAtCity(
  holdings: PlayerState['holdings'],
  cityId: string
): number {
  const city = holdings.cityProperties.find((c) => c.id === cityId);
  if (!city) return 0;
  const workshopSlots = holdings.workshops.filter(
    (w) => w.location.kind === 'cityProperty' && w.location.id === cityId
  ).length;
  const storageSlots = holdings.storages.filter(
    (s) => s.location.kind === 'cityProperty' && s.location.id === cityId
  ).length;
  const specSlots = city.specialization?.facilities?.length ?? 0;
  return city.facilities.length + specSlots + workshopSlots + storageSlots;
}

function countProductionUnitsUsedAtCity(
  holdings: PlayerState['holdings'],
  cityId: string
): number {
  const workshopUnits = holdings.workshops
    .filter((w) => w.location.kind === 'cityProperty' && w.location.id === cityId)
    .reduce((sum, w) => sum + tierUnits(w.tier), 0);
  const storageUnits = holdings.storages
    .filter((s) => s.location.kind === 'cityProperty' && s.location.id === cityId)
    .reduce((sum, s) => sum + tierUnits(s.tier), 0);
  return workshopUnits + storageUnits;
}

function hasWorkshopSpecialist(
  me: PlayerState,
  requiredTier: 'simple' | 'experienced'
): boolean {
  return me.holdings.specialists.some((s) => {
    if (s.kind !== 'artisan' && s.kind !== 'workshop') return false;
    if (requiredTier === 'simple') return true;
    return s.tier === 'experienced' || s.tier === 'master';
  });
}

function buildFacilityCandidates(
  me: PlayerState,
  bufferFactor: number
): Candidate[] {
  const candidates: Candidate[] = [];
  const domainsByTier = [...me.holdings.domains].sort(
    (a, b) => domainTierRank(b.tier) - domainTierRank(a.tier)
  );
  const citiesByTier = [...me.holdings.cityProperties].sort(
    (a, b) => postTierRank(b.tier) - postTierRank(a.tier)
  );

  const starter = me.holdings.domains.find((d) => d.tier === 'starter');
  if (starter) {
    const possibleNow = me.economy.gold >= 10 && me.turn.laborAvailable >= 4;
    candidates.push({
      id: 'facility.domain.upgradeStarter',
      kind: 'facility',
      command: {
        type: 'UpgradeStarterDomain',
        campaignId: '',
        domainId: starter.id,
      },
      actionKey: null,
      possibleNow,
      summary: 'Starter-Domäne ausbauen (10 Gold, 4 AK).',
    });
  }

  const leasedCity = citiesByTier.find((c) => c.mode === 'leased');
  const minGoldForCityProduction = buffered(8, bufferFactor);
  const canBuildProductionInCity = leasedCity
    ? countFacilitySlotsUsedAtCity(me.holdings, leasedCity.id) + 1 <=
        cityFacilitySlotsMax(leasedCity.tier) &&
      countProductionUnitsUsedAtCity(me.holdings, leasedCity.id) +
        tierUnits('small') <=
        productionCapacityUnitsMaxForCity(leasedCity.tier)
    : false;
  if (
    leasedCity &&
    canBuildProductionInCity &&
    me.economy.gold >= minGoldForCityProduction
  ) {
    candidates.push({
      id: `facility.city.mode.production.${leasedCity.id}`,
      kind: 'facility',
      command: {
        type: 'SetCityPropertyMode',
        campaignId: '',
        cityPropertyId: leasedCity.id,
        mode: 'production',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Stadtbesitz ${leasedCity.id} auf Produktion umstellen (nur wenn Werkstatt/Lager bau moeglich; mind. ${minGoldForCityProduction} Gold).`,
    });
  }

  const tradeMode = me.holdings.tradeEnterprises.find(
    (t) => t.mode !== 'trade'
  );
  if (tradeMode) {
    candidates.push({
      id: `facility.trade.mode.trade.${tradeMode.id}`,
      kind: 'facility',
      command: {
        type: 'SetTradeEnterpriseMode',
        campaignId: '',
        tradeEnterpriseId: tradeMode.id,
        mode: 'trade',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Handelsunternehmung ${tradeMode.id} auf Handel umstellen.`,
    });
  }

  const officeMode = me.holdings.offices.find((o) => o.yieldMode !== 'gold');
  if (officeMode) {
    candidates.push({
      id: `facility.office.mode.gold.${officeMode.id}`,
      kind: 'facility',
      command: {
        type: 'SetOfficeYieldMode',
        campaignId: '',
        officeId: officeMode.id,
        mode: 'gold',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Amt ${officeMode.id} auf Gold-Ertrag umstellen.`,
    });
  }
  const officeSplit = me.holdings.offices.find((o) => o.yieldMode !== 'split');
  if (officeSplit) {
    candidates.push({
      id: `facility.office.mode.split.${officeSplit.id}`,
      kind: 'facility',
      command: {
        type: 'SetOfficeYieldMode',
        campaignId: '',
        officeId: officeSplit.id,
        mode: 'split',
      },
      actionKey: null,
      possibleNow: true,
      summary: `Amt ${officeSplit.id} auf Split-Ertrag umstellen (50/50 Gold + Einfluss).`,
    });
  }

  const facilitySizes = [
    { size: 'small', general: 8, special: 10 },
    { size: 'medium', general: 12, special: 20 },
    { size: 'large', general: 30, special: 40 },
  ] as const;

  const pushFacilityBuildOptions = (
    location: {
      kind: 'office' | 'tradeEnterprise' | 'workshop' | 'organization';
      id: string;
    },
    label: string,
    usedSlots: number,
    maxSlots: number,
    influenceKind: 'office' | 'tradeEnterprise' | 'workshop' | 'organization'
  ) => {
    if (usedSlots + 1 > maxSlots) return;
    for (const tier of facilitySizes) {
      const generalKey = `general.${tier.size}.${influenceKind}`;
      const specialKey = `special.${tier.size}.${influenceKind}`;
      const generalInfluence = facilityInfluencePerRound(
        generalKey,
        influenceKind
      );
      const specialInfluence = facilityInfluencePerRound(
        specialKey,
        influenceKind
      );
      candidates.push({
        id: `facility.${location.kind}.${location.id}.general.${tier.size}`,
        kind: 'facility',
        command: {
          type: 'BuildFacility',
          campaignId: '',
          location,
          facilityKey: generalKey,
        },
        actionKey: null,
        possibleNow: me.economy.gold >= buffered(tier.general, bufferFactor),
        summary:
          `Allg. Einrichtung (${tier.size}) bauen an ${label} ` +
          `(${tier.general} Gold, +${generalInfluence} Einfluss/Runde).`,
      });
      candidates.push({
        id: `facility.${location.kind}.${location.id}.special.${tier.size}`,
        kind: 'facility',
        command: {
          type: 'BuildFacility',
          campaignId: '',
          location,
          facilityKey: specialKey,
        },
        actionKey: null,
        possibleNow: me.economy.gold >= buffered(tier.special, bufferFactor),
        summary:
          `Bes. Einrichtung (${tier.size}) bauen an ${label} ` +
          `(${tier.special} Gold, +${specialInfluence} Einfluss/Runde).`,
      });
    }
  };

  for (const office of me.holdings.offices) {
    const used =
      office.facilities.length + (office.specialization?.facilities.length ?? 0);
    const max = cityFacilitySlotsMax(office.tier);
    pushFacilityBuildOptions(
      { kind: 'office', id: office.id },
      `Amt ${office.id}`,
      used,
      max,
      'office'
    );
  }

  for (const trade of me.holdings.tradeEnterprises) {
    const used = trade.facilities.length;
    const max = 2 * postTierRank(trade.tier);
    pushFacilityBuildOptions(
      { kind: 'tradeEnterprise', id: trade.id },
      `Handelsunternehmung ${trade.id}`,
      used,
      max,
      'tradeEnterprise'
    );
  }

  for (const org of me.holdings.organizations) {
    const used = org.facilities.length;
    const max = 2 * postTierRank(org.tier);
    pushFacilityBuildOptions(
      { kind: 'organization', id: org.id },
      `Organisation ${org.kind} ${org.id}`,
      used,
      max,
      'organization'
    );
  }

  for (const workshop of me.holdings.workshops) {
    const used = workshop.facilities.length;
    const max = workshopFacilitySlotsMax(workshop.tier);
    pushFacilityBuildOptions(
      { kind: 'workshop', id: workshop.id },
      `Werkstatt ${workshop.id}`,
      used,
      max,
      'workshop'
    );
  }

  const specDomain = domainsByTier.find(
    (d) => d.tier !== 'starter' && !d.specialization
  );
  if (specDomain) {
    if (me.economy.gold >= buffered(6, bufferFactor)) {
      candidates.push({
        id: `facility.domain.spec.forestry.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'forestry',
        },
        actionKey: null,
        possibleNow: true,
        summary: `Domäne ${specDomain.id} spezialisieren: Forstwirtschaft (6 Gold).`,
      });
    }
    if (
      me.economy.gold >= buffered(10, bufferFactor) &&
      (me.economy.inventory.raw['raw.grainVeg'] ?? 0) >= 2
    ) {
      candidates.push({
        id: `facility.domain.spec.agriculture.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'agriculture',
          picks: { costRawId: 'raw.grainVeg' },
        },
        actionKey: null,
        possibleNow: true,
        summary: `Domäne ${specDomain.id} spezialisieren: Landwirtschaft (10 Gold, 2 RM raw.grainVeg).`,
      });
    }
    if (
      me.economy.gold >= buffered(20, bufferFactor) &&
      (me.economy.inventory.raw['raw.wood'] ?? 0) >= 4
    ) {
      candidates.push({
        id: `facility.domain.spec.mining.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'mining',
        },
        actionKey: null,
        possibleNow: true,
        summary: `Domäne ${specDomain.id} spezialisieren: Bergbau (20 Gold, 4 RM raw.wood).`,
      });
    }
    const animalCount = Object.entries(me.economy.inventory.raw).reduce(
      (sum, [materialId, count]) => {
        try {
          const mat = getMaterialOrThrow(materialId);
          if (mat.tags.includes('animal')) return sum + (count ?? 0);
        } catch {
          return sum;
        }
        return sum;
      },
      0
    );
    if (me.economy.gold >= buffered(15, bufferFactor) && animalCount >= 4) {
      candidates.push({
        id: `facility.domain.spec.animal.${specDomain.id}`,
        kind: 'facility',
        command: {
          type: 'SetDomainSpecialization',
          campaignId: '',
          domainId: specDomain.id,
          kind: 'animalHusbandry',
        },
        actionKey: null,
        possibleNow: true,
        summary: `Domäne ${specDomain.id} spezialisieren: Viehzucht (15 Gold, 4 RM Tiere).`,
      });
    }
  }

  const domainForWorkshop = domainsByTier.find((d) => {
    if (d.tier === 'starter') return false;
    const used = countFacilitySlotsUsedAtDomain(me.holdings, d.id);
    const max = domainFacilitySlotsMax(d.tier);
    if (used + 1 > max) return false;
    const caps = domainProductionCaps(d.tier);
    const prod = countDomainProductionByTier(me.holdings, d.id);
    if (caps.total <= 0) return false;
    if (prod.total >= caps.total) return false;
    if (caps.small <= prod.small) return false;
    return true;
  });
  if (domainForWorkshop) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.workshop.buildSmall.domain.${domainForWorkshop.id}`,
      kind: 'facility',
      command: {
        type: 'BuildWorkshop',
        campaignId: '',
        location: { kind: 'domain', id: domainForWorkshop.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt (klein) bauen auf Domäne ${domainForWorkshop.id} (8 Gold).`,
    });
  }

  const domainForStorage = domainsByTier.find((d) => {
    if (d.tier === 'starter') return false;
    const used = countFacilitySlotsUsedAtDomain(me.holdings, d.id);
    const max = domainFacilitySlotsMax(d.tier);
    if (used + 1 > max) return false;
    const caps = domainProductionCaps(d.tier);
    const prod = countDomainProductionByTier(me.holdings, d.id);
    if (caps.total <= 0) return false;
    if (prod.total >= caps.total) return false;
    if (caps.small <= prod.small) return false;
    return true;
  });
  if (domainForStorage) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.storage.buildSmall.domain.${domainForStorage.id}`,
      kind: 'facility',
      command: {
        type: 'BuildStorage',
        campaignId: '',
        location: { kind: 'domain', id: domainForStorage.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Lager (klein) bauen auf Domäne ${domainForStorage.id} (8 Gold).`,
    });
  }

  const domainForRefine = domainsByTier.find((d) => {
    if (d.tier === 'starter') return false;
    const used = countFacilitySlotsUsedAtDomain(me.holdings, d.id);
    const max = domainFacilitySlotsMax(d.tier);
    return used + 1 <= max;
  });
  if (domainForRefine) {
    const possibleNow = me.economy.gold >= buffered(10, bufferFactor);
    candidates.push({
      id: `facility.domain.refine.small.${domainForRefine.id}`,
      kind: 'facility',
      command: {
        type: 'BuildFacility',
        campaignId: '',
        location: { kind: 'domain', id: domainForRefine.id },
        facilityKey: 'special.small.refine',
      },
      actionKey: null,
      possibleNow,
      summary: `Veredelung (klein) bauen auf Domäne ${domainForRefine.id} (10 Gold).`,
    });
  }

  const cityForWorkshop = citiesByTier.find((c) => {
    if (c.mode !== 'production') return false;
    const usedSlots = countFacilitySlotsUsedAtCity(me.holdings, c.id);
    const maxSlots = cityFacilitySlotsMax(c.tier);
    if (usedSlots + 1 > maxSlots) return false;
    const usedUnits = countProductionUnitsUsedAtCity(me.holdings, c.id);
    return (
      usedUnits + tierUnits('small') <= productionCapacityUnitsMaxForCity(c.tier)
    );
  });
  if (cityForWorkshop) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.workshop.buildSmall.city.${cityForWorkshop.id}`,
      kind: 'facility',
      command: {
        type: 'BuildWorkshop',
        campaignId: '',
        location: { kind: 'cityProperty', id: cityForWorkshop.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt (klein) bauen in Stadtbesitz ${cityForWorkshop.id} (8 Gold).`,
    });
  }

  const cityForStorage = citiesByTier.find((c) => {
    if (c.mode !== 'production') return false;
    const usedSlots = countFacilitySlotsUsedAtCity(me.holdings, c.id);
    const maxSlots = cityFacilitySlotsMax(c.tier);
    if (usedSlots + 1 > maxSlots) return false;
    const usedUnits = countProductionUnitsUsedAtCity(me.holdings, c.id);
    return (
      usedUnits + tierUnits('small') <= productionCapacityUnitsMaxForCity(c.tier)
    );
  });
  if (cityForStorage) {
    const possibleNow = me.economy.gold >= 8;
    candidates.push({
      id: `facility.storage.buildSmall.city.${cityForStorage.id}`,
      kind: 'facility',
      command: {
        type: 'BuildStorage',
        campaignId: '',
        location: { kind: 'cityProperty', id: cityForStorage.id },
        tier: 'small',
      },
      actionKey: null,
      possibleNow,
      summary: `Lager (klein) bauen in Stadtbesitz ${cityForStorage.id} (8 Gold).`,
    });
  }

  const workshopToUpgrade = me.holdings.workshops.find(
    (w) => w.tier !== 'large'
  );
  if (workshopToUpgrade) {
    const toTier = workshopToUpgrade.tier === 'small' ? 'medium' : 'large';
    const requires = toTier === 'large' ? 'experienced' : 'simple';
    const hasSpecialist = hasWorkshopSpecialist(me, requires);
    let possibleCityCapacity = true;
    let possibleDomainCapacity = true;
    if (workshopToUpgrade.location.kind === 'cityProperty') {
      const city = me.holdings.cityProperties.find(
        (c) => c.id === workshopToUpgrade.location.id
      );
      if (city && city.mode === 'production') {
        const usedUnits = countProductionUnitsUsedAtCity(me.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(toTier) - tierUnits(workshopToUpgrade.tier);
        possibleCityCapacity = usedUnits + deltaUnits <= maxUnits;
      } else {
        possibleCityCapacity = false;
      }
    } else if (workshopToUpgrade.location.kind === 'domain') {
      const domain = me.holdings.domains.find(
        (d) => d.id === workshopToUpgrade.location.id
      );
      if (!domain) {
        possibleDomainCapacity = false;
      } else if (toTier === 'large') {
        possibleDomainCapacity = false;
      } else {
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(me.holdings, domain.id, {
          excludeWorkshopId: workshopToUpgrade.id,
        });
        const nextSmall = prod.small;
        const nextMedium = prod.medium + 1;
        possibleDomainCapacity =
          nextSmall <= caps.small &&
          nextMedium <= caps.medium &&
          nextSmall + nextMedium <= caps.total;
      }
    }
    const goldCost =
      toTier === 'medium'
        ? 8
        : toTier === 'large'
          ? 24
          : 0;
    const possibleNow =
      hasSpecialist &&
      possibleCityCapacity &&
      possibleDomainCapacity &&
      me.economy.gold >= buffered(goldCost, bufferFactor);
    candidates.push({
      id: `facility.workshop.upgrade.${workshopToUpgrade.id}.${toTier}`,
      kind: 'facility',
      command: {
        type: 'UpgradeWorkshop',
        campaignId: '',
        workshopId: workshopToUpgrade.id,
        toTier,
      },
      actionKey: null,
      possibleNow,
      summary: `Werkstatt ${workshopToUpgrade.id} auf ${toTier} upgraden (ca. ${goldCost} Gold).`,
    });
  }

  const storageToUpgrade = me.holdings.storages.find((s) => s.tier !== 'large');
  if (storageToUpgrade) {
    const toTier = storageToUpgrade.tier === 'small' ? 'medium' : 'large';
    let possibleCityCapacity = true;
    let possibleDomainCapacity = true;
    if (storageToUpgrade.location.kind === 'cityProperty') {
      const city = me.holdings.cityProperties.find(
        (c) => c.id === storageToUpgrade.location.id
      );
      if (city && city.mode === 'production') {
        const usedUnits = countProductionUnitsUsedAtCity(me.holdings, city.id);
        const maxUnits = productionCapacityUnitsMaxForCity(city.tier);
        const deltaUnits = tierUnits(toTier) - tierUnits(storageToUpgrade.tier);
        possibleCityCapacity = usedUnits + deltaUnits <= maxUnits;
      } else {
        possibleCityCapacity = false;
      }
    } else if (storageToUpgrade.location.kind === 'domain') {
      const domain = me.holdings.domains.find(
        (d) => d.id === storageToUpgrade.location.id
      );
      if (!domain) {
        possibleDomainCapacity = false;
      } else if (toTier === 'large') {
        possibleDomainCapacity = false;
      } else {
        const caps = domainProductionCaps(domain.tier);
        const prod = countDomainProductionByTier(me.holdings, domain.id, {
          excludeStorageId: storageToUpgrade.id,
        });
        const nextSmall = prod.small;
        const nextMedium = prod.medium + 1;
        possibleDomainCapacity =
          nextSmall <= caps.small &&
          nextMedium <= caps.medium &&
          nextSmall + nextMedium <= caps.total;
      }
    }
    const goldCost =
      toTier === 'medium'
        ? 8
        : toTier === 'large'
          ? 24
          : 0;
    const possibleNow =
      possibleCityCapacity &&
      possibleDomainCapacity &&
      me.economy.gold >= buffered(goldCost, bufferFactor);
    candidates.push({
      id: `facility.storage.upgrade.${storageToUpgrade.id}.${toTier}`,
      kind: 'facility',
      command: {
        type: 'UpgradeStorage',
        campaignId: '',
        storageId: storageToUpgrade.id,
        toTier,
      },
      actionKey: null,
      possibleNow,
      summary: `Lager ${storageToUpgrade.id} auf ${toTier} upgraden (ca. ${goldCost} Gold).`,
    });
  }

  return dedupeCandidates(candidates);
}

function formatPlayerState(state: { me: PlayerState; round: number }): string {
  const me = state.me;
  const rawTotal = sumStock(me.economy.inventory.raw);
  const specialTotal = sumStock(me.economy.inventory.special);

  const domains = me.holdings.domains.map((d) => d.tier).join(', ') || '-';
  const domainPicks =
    me.holdings.domains
      .map((d) => `${d.id}:${d.tier}[${(d.rawPicks ?? []).join(', ')}]`)
      .join(' | ') || '-';
  const cities =
    me.holdings.cityProperties.map((c) => `${c.tier}/${c.mode}`).join(', ') ||
    '-';
  const offices =
    me.holdings.offices.map((o) => `${o.tier}/${o.yieldMode}`).join(', ') ||
    '-';
  const orgs =
    me.holdings.organizations.map((o) => `${o.kind}/${o.tier}`).join(', ') ||
    '-';
  const trades =
    me.holdings.tradeEnterprises.map((t) => `${t.tier}/${t.mode}`).join(', ') ||
    '-';
  const workshops =
    me.holdings.workshops
      .map((w) => `${w.id}:${w.tier} ${w.inputMaterialId}->${w.outputMaterialId}`)
      .join(' | ') || '-';
  const checkBonus = roundCheckBonus(state.round);
  const infCheck = effectiveCheckValue(me.checks.influence, state.round);
  const moneyCheck = effectiveCheckValue(me.checks.money, state.round);
  const matCheck = effectiveCheckValue(me.checks.materials, state.round);

  return [
    `Runde: ${state.round}`,
    `Gold: ${me.economy.gold} (pending: ${me.economy.pending.gold})`,
    `RM: ${rawTotal}, SM: ${specialTotal}, Zauberkraft: ${me.economy.inventory.magicPower}`,
    `RM-Top: ${formatStockSummary(me.economy.inventory.raw)}`,
    `SM-Top: ${formatStockSummary(me.economy.inventory.special)}`,
    `Checks: influence=${me.checks.influence}+${checkBonus}=${infCheck}, money=${me.checks.money}+${checkBonus}=${moneyCheck}, materials=${me.checks.materials}+${checkBonus}=${matCheck}`,
    `AK verfügbar: ${me.turn.laborAvailable}, Einfluss verfügbar: ${me.turn.influenceAvailable}`,
    `Perm: Einfluss=${me.holdings.permanentInfluence}, AK=${me.holdings.permanentLabor}`,
    `Aktionen: used=${me.turn.actionsUsed}, keys=[${me.turn.actionKeysUsed.join(', ')}]`,
    `Domänen: ${domains}`,
    `Domänen-Picks: ${domainPicks}`,
    `Stadtbesitz: ${cities}`,
    `Ämter: ${offices}`,
    `Organisationen: ${orgs}`,
    `Handelsunternehmungen: ${trades}`,
    `Werkstätten: ${workshops}`,
    `Truppen: bodyguard=${me.holdings.troops.bodyguardLevels}, militia=${me.holdings.troops.militiaLevels}, merc=${me.holdings.troops.mercenaryLevels}, thug=${me.holdings.troops.thugLevels}`,
  ].join('\n');
}

function formatMarketSnapshot(
  me: PlayerState,
  market: CampaignMarketLike
): string[] {
  const instances = market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === me.id
  );
  if (instances.length === 0) return ['(keine verfuegbaren Maerkte)'];

  const fmtMods = (mods: Record<string, number>) => {
    const entries = Object.entries(mods)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([group, mod]) => `${group}:${mod >= 0 ? '+' : ''}${mod}`);
    return entries.length > 0 ? entries.join(', ') : '-';
  };

  return instances.map((inst) => {
    const best = buildSellItems(me, inst, sellInvestmentCap(me));
    const bestInv =
      best && best.topIds.length > 0
        ? `${best.topIds.join(', ')} (mod≈${best.topScore})`
        : '-';
    return `${inst.label}: raw[${fmtMods(inst.raw.modifiersByGroup)}] special[${fmtMods(
      inst.special.modifiersByGroup
    )}] invBest[${bestInv}]`;
  });
}

function formatActionCapacity(
  me: PlayerState,
  actionsPerRound: number
): string {
  const baseRemaining = Math.max(0, actionsPerRound - me.turn.actionsUsed);
  const influenceBonusRemaining = remainingInfluenceBonusSlots(me);
  const moneyBonusRemaining =
    bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1') ? 1 : 0;
  const materialsBonusRemaining =
    bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1')
      ? 1
      : 0;

  return `Aktionen verbleibend: base=${baseRemaining}, bonusInfluence=${influenceBonusRemaining}, bonusMoney=${moneyBonusRemaining}, bonusMaterials=${materialsBonusRemaining}`;
}

function formatStrategyCard(card: StrategyCard): string[] {
  const lines: string[] = [];
  lines.push(`Titel: ${card.title}`);
  if (card.risk) lines.push(`Risiko: ${card.risk}`);
  if (card.primary.length > 0)
    lines.push(`Primaer: ${card.primary.join('; ')}`);
  if (card.secondary && card.secondary.length > 0)
    lines.push(`Sekundaer: ${card.secondary.join('; ')}`);
  if (card.avoid && card.avoid.length > 0)
    lines.push(`Vermeiden: ${card.avoid.join('; ')}`);
  if (card.guardrails && card.guardrails.length > 0)
    lines.push(`Guardrails: ${card.guardrails.join('; ')}`);
  return lines;
}

function filterActionCandidates(
  me: PlayerState,
  candidates: Candidate[],
  actionsPerRound: number
): Candidate[] {
  const baseRemaining = actionsPerRound - me.turn.actionsUsed;
  const allowBase = baseRemaining > 0;
  const allowBonusInfluence = hasRemainingInfluenceBonus(me);
  const allowBonusMoney =
    bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1');
  const allowBonusMaterials =
    bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1');

  return candidates.filter((c) => {
    if (!c.possibleNow) return false;
    if (!c.actionKey) return true;
    if (
      c.command.type === 'MoneySellBuy' &&
      hasUsedCanonicalAction(me, 'money.buy')
    ) {
      return false;
    }
    const used = hasUsedCanonicalAction(me, c.actionKey);
    if (!used && allowBase) return true;
    if (c.actionKey === 'influence') return allowBonusInfluence;
    if (c.actionKey.startsWith('money.')) return allowBonusMoney;
    if (c.actionKey.startsWith('materials.')) return allowBonusMaterials;
    return false;
  });
}

function buildSellItems(
  me: PlayerState,
  inst: CampaignMarketLike['instances'][number],
  budget: number
): {
  items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  >;
  topIds: string[];
  topScore: number;
} | null {
  type Lot = {
    kind: 'raw' | 'special';
    materialId: string;
    investments: number;
    score: number;
  };
  const lots: Lot[] = [];

  for (const [materialId, count] of Object.entries(me.economy.inventory.raw)) {
    const inv = Math.floor((count ?? 0) / 6);
    if (inv <= 0) continue;
    const mat = getMaterialOrThrow(materialId);
    const mod = Math.trunc(inst.raw.modifiersByGroup[mat.marketGroup] ?? 0);
    lots.push({
      kind: 'raw',
      materialId,
      investments: inv,
      score: mod + (mat.saleBonusGold ?? 0),
    });
  }
  for (const [materialId, count] of Object.entries(
    me.economy.inventory.special
  )) {
    const inv = Math.floor(count ?? 0);
    if (inv <= 0) continue;
    const mat = getMaterialOrThrow(materialId);
    const mod = Math.trunc(inst.special.modifiersByGroup[mat.marketGroup] ?? 0);
    lots.push({
      kind: 'special',
      materialId,
      investments: inv,
      score: mod + (mat.saleBonusGold ?? 0),
    });
  }

  if (lots.length === 0) return null;
  lots.sort(
    (a, b) => b.score - a.score || a.materialId.localeCompare(b.materialId)
  );
  const topScore = lots[0]?.score ?? 0;

  let remaining = budget;
  const rawCounts: Record<string, number> = {};
  const specialCounts: Record<string, number> = {};
  const topIds: string[] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.investments, remaining);
    remaining -= take;
    if (topIds.length < 2 && !topIds.includes(lot.materialId)) {
      topIds.push(lot.materialId);
    }
    if (lot.kind === 'raw')
      rawCounts[lot.materialId] = (rawCounts[lot.materialId] ?? 0) + take * 6;
    else
      specialCounts[lot.materialId] =
        (specialCounts[lot.materialId] ?? 0) + take;
  }

  const items: Array<
    | { kind: 'raw'; materialId: string; count: number }
    | { kind: 'special'; materialId: string; count: number }
  > = [];
  for (const [materialId, count] of Object.entries(rawCounts))
    items.push({ kind: 'raw', materialId, count });
  for (const [materialId, count] of Object.entries(specialCounts))
    items.push({ kind: 'special', materialId, count });

  if (items.length === 0) return null;
  return { items, topIds, topScore };
}

function buildMoneySellCandidates(
  state: { me: PlayerState; market: CampaignMarketLike },
  maxInvestments?: number
): Candidate[] {
  const me = state.me;
  const cap = sellInvestmentCap(me);
  const budgetMax = Math.max(
    0,
    Math.min(cap, Math.trunc(maxInvestments ?? cap))
  );
  if (budgetMax <= 0) return [];

  const budgets = pickBudgetOptions(budgetMax);

  const instances = state.market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === state.me.id
  );
  if (instances.length === 0) return [];

  const candidates: Candidate[] = [];
  for (const inst of instances) {
    for (const budget of budgets) {
      const built = buildSellItems(me, inst, budget);
      if (!built) continue;
      const itemsLabel =
        built.topIds.length > 0 ? `, top: ${built.topIds.join(', ')}` : '';
      const scoreLabel =
        built.topScore !== 0 ? `, bestMod≈${built.topScore}` : '';
      candidates.push({
        id: `action.money.sell.${inst.id}.best.${budget}`,
        kind: 'action',
        command: {
          type: 'MoneySell',
          campaignId: '',
          marketInstanceId: inst.id,
          items: built.items,
        },
        actionKey: 'money.sell',
        possibleNow: true,
        summary: `Verkauf (bestes Paket, ~${budget} Investments) auf ${inst.label}${itemsLabel}${scoreLabel}.`,
      });
    }
  }

  return candidates;
}

function minGoldFromSellItems(
  items: Array<{ kind: 'raw' | 'special'; materialId: string; count: number }>
): number {
  let investments = 0;
  let conversionGold = 0;
  for (const item of items) {
    const count = Math.trunc(item.count);
    if (count <= 0) continue;
    if (item.kind === 'raw') {
      const inv = Math.floor(count / 6);
      investments += inv;
      conversionGold += inv * 1;
      continue;
    }
    const inv = count;
    investments += inv;
    conversionGold += inv * 2;
  }
  return Math.max(0, conversionGold - investments);
}

function estimateBuyCost(
  inst: CampaignMarketLike['instances'][number],
  items: Array<
    { kind: 'raw' | 'special'; materialId: string; count: number } | { kind: 'labor'; count: number }
  >
): number {
  let baseCost = 0;
  let deltaCost = 0;
  for (const item of items) {
    const count = Math.trunc(item.count);
    if (count <= 0) continue;
    if (item.kind === 'labor') {
      baseCost += count * 8;
      continue;
    }
    const mat = getMaterialOrThrow(item.materialId);
    if (item.kind === 'raw') {
      const inv = Math.floor(count / 5);
      baseCost += inv * 3;
      const mod = Math.trunc(inst.raw.modifiersByGroup[mat.marketGroup] ?? 0);
      deltaCost += inv * -mod;
      continue;
    }
    const inv = count;
    baseCost += inv * 3;
    const mod = Math.trunc(inst.special.modifiersByGroup[mat.marketGroup] ?? 0);
    deltaCost += inv * -mod;
  }
  return baseCost + deltaCost;
}

function buildBestBuyItems(
  inst: CampaignMarketLike['instances'][number]
): { items: Array<{ kind: 'raw'; materialId: string; count: number }>; label: string } | null {
  let bestRaw: { id: string; score: number } | null = null;
  for (const material of Object.values(MATERIALS_V1)) {
    if (material.kind !== 'raw') continue;
    const mod = Math.trunc(inst.raw.modifiersByGroup[material.marketGroup] ?? 0);
    if (!bestRaw || mod > bestRaw.score || (mod === bestRaw.score && material.id < bestRaw.id)) {
      bestRaw = { id: material.id, score: mod };
    }
  }
  if (!bestRaw) return null;
  return {
    items: [{ kind: 'raw', materialId: bestRaw.id, count: 5 }],
    label: `${bestRaw.id} (mod≈${bestRaw.score})`,
  };
}

function buildMoneySellBuyCandidates(
  state: { me: PlayerState; market: CampaignMarketLike },
  maxInvestments?: number
): Candidate[] {
  const me = state.me;
  const cap = sellInvestmentCap(me);
  const budgetMax = Math.max(
    0,
    Math.min(cap, Math.trunc(maxInvestments ?? cap))
  );
  if (budgetMax <= 0) return [];

  const instances = state.market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === state.me.id
  );
  if (instances.length === 0) return [];

  const candidates: Candidate[] = [];
  for (const inst of instances) {
    const built = buildSellItems(me, inst, budgetMax);
    if (!built) continue;
    const buy = buildBestBuyItems(inst);
    if (!buy) continue;
    const minSaleGold = minGoldFromSellItems(built.items);
    const estBuyCost = estimateBuyCost(inst, buy.items);
    const possibleNow = me.economy.gold + minSaleGold >= estBuyCost;
    candidates.push({
      id: `action.money.sellbuy.${inst.id}.best.${budgetMax}`,
      kind: 'action',
      command: {
        type: 'MoneySellBuy',
        campaignId: '',
        marketInstanceId: inst.id,
        sellItems: built.items,
        buyItems: buy.items,
      },
      actionKey: 'money.sell',
      possibleNow,
      summary: `Verkauf+Kauf (${inst.label}), sell top: ${built.topIds.join(', ')}, buy: ${buy.label}`,
    });
  }

  return candidates;
}

function buildMoneyBuyCandidates(
  state: { me: PlayerState; market: CampaignMarketLike },
  maxInvestments?: number
): Candidate[] {
  const me = state.me;
  const cap = buyInvestmentCap(me);
  const budgetMax = Math.max(
    0,
    Math.min(cap, Math.trunc(maxInvestments ?? cap))
  );
  if (budgetMax <= 0) return [];

  const instances = state.market.instances.filter(
    (inst) => !inst.ownerPlayerId || inst.ownerPlayerId === state.me.id
  );
  if (instances.length === 0) return [];

  const candidates: Candidate[] = [];
  for (const inst of instances) {
    const best = buildBestBuyItems(inst);
    if (!best) continue;
    for (const inv of pickBudgetOptions(budgetMax)) {
      const items = best.items.map((item) => ({
        ...item,
        count: item.count * inv,
      }));
      const estCost = estimateBuyCost(inst, items);
      const possibleNow = me.economy.gold >= estCost;
      candidates.push({
        id: `action.money.buy.${inst.id}.best.${inv}`,
        kind: 'action',
        command: {
          type: 'MoneyBuy',
          campaignId: '',
          marketInstanceId: inst.id,
          items,
        },
        actionKey: 'money.buy',
        possibleNow,
        summary: `Kauf (${inst.label}) inv=${inv}, buy: ${best.label}`,
      });
    }
  }

  return candidates;
}

type CampaignMarketLike = {
  instances: Array<{
    id: string;
    label: string;
    ownerPlayerId?: string;
    raw: { modifiersByGroup: Record<string, number> };
    special: { modifiersByGroup: Record<string, number> };
  }>;
};

function buildActionCandidates(options: {
  round: number;
  me: PlayerState;
  state: { market: CampaignMarketLike };
  bufferFactor: number;
}): Candidate[] {
  const { me } = options;
  const bufferFactor = options.bufferFactor;
  const candidates: Candidate[] = [];
  const domainsByTier = [...me.holdings.domains].sort(
    (a, b) => domainTierRank(b.tier) - domainTierRank(a.tier)
  );
  const citiesByTier = [...me.holdings.cityProperties].sort(
    (a, b) => postTierRank(b.tier) - postTierRank(a.tier)
  );

  // Materialgewinn (Domain) – max.
  {
    const domain = domainsByTier[0];
    if (domain) {
      const rank = domain.tier === 'starter' ? 1 : postTierRank(domain.tier);
      const cap = 4 * rank;
      const maxInvestments = Math.min(cap, me.turn.laborAvailable);
      for (const investments of pickBudgetOptions(maxInvestments)) {
        candidates.push({
          id: `action.materials.domain.${domain.id}.${investments}`,
          kind: 'action',
          command: {
            type: 'GainMaterials',
            campaignId: '',
            mode: 'domainAdministration',
            investments,
            targetId: domain.id,
          },
          actionKey: 'materials.domain',
          possibleNow: true,
          summary: `Materialgewinn Domäne (${domain.id}) inv=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Materialgewinn (Werkstatt) – max.
  {
    const workshop = me.holdings.workshops[0];
    if (workshop) {
      const cap = 2 * postTierRank(workshop.tier);
      const maxInvestments = Math.min(cap, me.turn.laborAvailable);
      for (const investments of pickBudgetOptions(maxInvestments)) {
        candidates.push({
          id: `action.materials.workshop.${workshop.id}.${investments}`,
          kind: 'action',
          command: {
            type: 'GainMaterials',
            campaignId: '',
            mode: 'workshopOversight',
            investments,
            targetId: workshop.id,
          },
          actionKey: 'materials.workshop',
          possibleNow: true,
          summary: `Materialgewinn Werkstatt (${workshop.id}) inv=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Einflussgewinn (temp/permanent) – 1/mid/max
  {
    const hasAnySmall =
      me.holdings.offices.some((o) => o.tier === 'small') ||
      me.holdings.organizations.some((o) => o.tier === 'small');
    const hasAnyMedium =
      me.holdings.offices.some((o) => o.tier === 'medium') ||
      me.holdings.organizations.some((o) => o.tier === 'medium');
    const hasAnyLarge =
      me.holdings.offices.some((o) => o.tier === 'large') ||
      me.holdings.organizations.some((o) => o.tier === 'large');

    const tempCap = hasAnyLarge ? 12 : hasAnyMedium ? 8 : hasAnySmall ? 6 : 4;
    const tempMax = Math.min(tempCap, me.economy.gold);
    for (const inv of pickBudgetOptions(tempMax)) {
      candidates.push({
        id: `action.influence.temp.${inv}`,
        kind: 'action',
        command: {
          type: 'GainInfluence',
          campaignId: '',
          kind: 'temporary',
          investments: inv,
        },
        actionKey: 'influence',
        possibleNow: true,
        summary: `Einflussgewinn (temp), Inv=${inv} (Kosten: ${inv} Gold).`,
      });
    }

    const permCap =
      2 +
      me.holdings.offices.reduce((sum, o) => sum + postTierRank(o.tier), 0) +
      me.holdings.organizations.reduce(
        (sum, o) => sum + postTierRank(o.tier),
        0
      );
    const permMax = Math.min(permCap, Math.floor(me.economy.gold / 2));
    for (const inv of pickBudgetOptions(permMax)) {
      candidates.push({
        id: `action.influence.perm.${inv}`,
        kind: 'action',
        command: {
          type: 'GainInfluence',
          campaignId: '',
          kind: 'permanent',
          investments: inv,
        },
        actionKey: 'influence',
        possibleNow: true,
        summary: `Einflussgewinn (perm), Inv=${inv} (Kosten: ${inv * 2} Gold).`,
      });
    }
  }

  // Geldverleih – 1..cap (begrenzt auf 4 Optionen zur Prompt-Größe)
  {
    const maxTradeTier = Math.max(
      0,
      ...me.holdings.tradeEnterprises.map((t) => postTierRank(t.tier))
    );
    const cap =
      maxTradeTier === 0
        ? 2
        : maxTradeTier === 1
          ? 4
          : maxTradeTier === 2
            ? 6
            : 10;
    const maxAffordable = Math.floor(me.economy.gold / 2);
    const max = Math.min(cap, maxAffordable);
    for (const inv of pickBudgetOptions(max)) {
      candidates.push({
        id: `action.money.lend.${inv}`,
        kind: 'action',
        command: { type: 'MoneyLend', campaignId: '', investments: inv },
        actionKey: 'money.lend',
        possibleNow: inv * 2 <= me.economy.gold,
        summary: `Geldverleih, Inv=${inv} (Kosten: ${inv * 2} Gold; Auszahlung nächste Runde).`,
      });
    }
  }

  // Verkauf (best effort)
  {
    const sells = buildMoneySellCandidates(
      { me, market: options.state.market },
      sellInvestmentCap(me)
    );
    candidates.push(...sells);
  }
  // Verkauf + Kauf (kombiniert, best effort)
  {
    const sellBuy = buildMoneySellBuyCandidates(
      { me, market: options.state.market },
      sellInvestmentCap(me)
    );
    candidates.push(...sellBuy);
  }
  // Kauf (best effort)
  {
    const buys = buildMoneyBuyCandidates(
      { me, market: options.state.market },
      buyInvestmentCap(me)
    );
    candidates.push(...buys);
  }

  // Amt (klein)
  {
    const smallCount = me.holdings.offices.filter((o) => o.tier === 'small')
      .length;
    const mediumCount = me.holdings.offices.filter((o) => o.tier === 'medium')
      .length;
    const largeCount = me.holdings.offices.filter((o) => o.tier === 'large')
      .length;
    const smallCap = 8 + mediumCount * 2 + largeCount * 4;
    const underCap = smallCount < smallCap;
    const goldFirst = { gold: 8, influence: 2 };
    const goldMax = worstCaseCost(goldFirst.gold, bufferFactor);
    const influenceMax = worstCaseCost(goldFirst.influence, bufferFactor);
    const goldFirstNow =
      me.economy.gold >= goldMax &&
      me.turn.influenceAvailable >= influenceMax &&
      underCap;
    candidates.push({
      id: 'action.office.small.payGoldFirst',
      kind: 'action',
      command: {
        type: 'AcquireOffice',
        campaignId: '',
        tier: 'small',
        payment: 'goldFirst',
      },
      actionKey: 'acquire.office',
      possibleNow: goldFirstNow,
      summary: `Kleines Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; Max: ${goldMax} Gold, ${influenceMax} Einfluss; Cap ${smallCount}/${smallCap}).`,
    });
  }
  {
    const smallCount = me.holdings.offices.filter((o) => o.tier === 'small')
      .length;
    const mediumCount = me.holdings.offices.filter((o) => o.tier === 'medium')
      .length;
    const largeCount = me.holdings.offices.filter((o) => o.tier === 'large')
      .length;
    const smallCap = 8 + mediumCount * 2 + largeCount * 4;
    const underCap = smallCount < smallCap;
    const infFirst = { gold: 4, influence: 8 };
    const goldMax = worstCaseCost(infFirst.gold, bufferFactor);
    const influenceMax = worstCaseCost(infFirst.influence, bufferFactor);
    const infFirstNow =
      me.economy.gold >= goldMax &&
      me.turn.influenceAvailable >= influenceMax &&
      underCap;
    candidates.push({
      id: 'action.office.small.payInfluenceFirst',
      kind: 'action',
      command: {
        type: 'AcquireOffice',
        campaignId: '',
        tier: 'small',
        payment: 'influenceFirst',
      },
      actionKey: 'acquire.office',
      possibleNow: infFirstNow,
      summary: `Kleines Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; Max: ${goldMax} Gold, ${influenceMax} Einfluss; Cap ${smallCount}/${smallCap}).`,
    });
  }

  // Amt (mittel)
  {
    const smallCount = me.holdings.offices.filter(
      (o) => o.tier === 'small'
    ).length;
    if (smallCount >= 2) {
      const goldFirst = { gold: 18, influence: 8 };
      const goldMax = worstCaseCost(goldFirst.gold, bufferFactor);
      const influenceMax = worstCaseCost(goldFirst.influence, bufferFactor);
      const goldFirstNow =
        me.economy.gold >= goldMax &&
        me.turn.influenceAvailable >= influenceMax;
      candidates.push({
        id: 'action.office.medium.payGoldFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'medium',
          payment: 'goldFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: goldFirstNow,
        summary: `Mittleres Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; Max: ${goldMax} Gold, ${influenceMax} Einfluss).`,
      });
      const infFirst = { gold: 10, influence: 18 };
      const goldMaxB = worstCaseCost(infFirst.gold, bufferFactor);
      const influenceMaxB = worstCaseCost(infFirst.influence, bufferFactor);
      const infFirstNow =
        me.economy.gold >= goldMaxB &&
        me.turn.influenceAvailable >= influenceMaxB;
      candidates.push({
        id: 'action.office.medium.payInfluenceFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'medium',
          payment: 'influenceFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: infFirstNow,
        summary: `Mittleres Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; Max: ${goldMaxB} Gold, ${influenceMaxB} Einfluss).`,
      });
    }
  }

  // Amt (gross)
  {
    const mediumCount = me.holdings.offices.filter(
      (o) => o.tier === 'medium'
    ).length;
    if (mediumCount >= 2) {
      const goldFirst = { gold: 70, influence: 20 };
      const goldMax = worstCaseCost(goldFirst.gold, bufferFactor);
      const influenceMax = worstCaseCost(goldFirst.influence, bufferFactor);
      const goldFirstNow =
        me.economy.gold >= goldMax &&
        me.turn.influenceAvailable >= influenceMax;
      candidates.push({
        id: 'action.office.large.payGoldFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'large',
          payment: 'goldFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: goldFirstNow,
        summary: `Grosses Amt erlangen (Basis: ${goldFirst.gold} Gold, ${goldFirst.influence} Einfluss; Max: ${goldMax} Gold, ${influenceMax} Einfluss).`,
      });
      const infFirst = { gold: 24, influence: 70 };
      const goldMaxB = worstCaseCost(infFirst.gold, bufferFactor);
      const influenceMaxB = worstCaseCost(infFirst.influence, bufferFactor);
      const infFirstNow =
        me.economy.gold >= goldMaxB &&
        me.turn.influenceAvailable >= influenceMaxB;
      candidates.push({
        id: 'action.office.large.payInfluenceFirst',
        kind: 'action',
        command: {
          type: 'AcquireOffice',
          campaignId: '',
          tier: 'large',
          payment: 'influenceFirst',
        },
        actionKey: 'acquire.office',
        possibleNow: infFirstNow,
        summary: `Grosses Amt erlangen (Basis: ${infFirst.gold} Gold, ${infFirst.influence} Einfluss; Max: ${goldMaxB} Gold, ${influenceMaxB} Einfluss).`,
      });
    }
  }

  // Handelsunternehmung (klein)
  const tradeSmallMax = worstCaseCost(20, bufferFactor);
  candidates.push({
    id: 'action.tradeEnterprise.small',
    kind: 'action',
    command: { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'small' },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= tradeSmallMax,
    summary:
      `Handelsunternehmung (klein) erwerben (Basis: 20 Gold; Max: ${tradeSmallMax} Gold).`,
  });
  const tradeMediumMax = worstCaseCost(40, bufferFactor);
  candidates.push({
    id: 'action.tradeEnterprise.medium',
    kind: 'action',
    command: {
      type: 'AcquireTradeEnterprise',
      campaignId: '',
      tier: 'medium',
    },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= tradeMediumMax,
    summary:
      `Handelsunternehmung (mittel) erwerben (Basis: 40 Gold; Max: ${tradeMediumMax} Gold).`,
  });
  const tradeLargeMax = worstCaseCost(80, bufferFactor);
  candidates.push({
    id: 'action.tradeEnterprise.large',
    kind: 'action',
    command: { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'large' },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= tradeLargeMax,
    summary:
      `Handelsunternehmung (gross) erwerben (Basis: 80 Gold; Max: ${tradeLargeMax} Gold).`,
  });

  // Stadtbesitz (alle Stufen)
  const citySmallMax = worstCaseCost(15, bufferFactor);
  candidates.push({
    id: 'action.cityProperty.small',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'small' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= citySmallMax,
    summary:
      `Stadtbesitz (klein) erwerben (Basis: 15 Gold; Max: ${citySmallMax} Gold).`,
  });
  const cityMediumMax = worstCaseCost(25, bufferFactor);
  candidates.push({
    id: 'action.cityProperty.medium',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'medium' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= cityMediumMax,
    summary: `Stadtbesitz (mittel) erwerben (Basis: 25 Gold; Max: ${cityMediumMax} Gold).`,
  });
  const cityLargeMax = worstCaseCost(50, bufferFactor);
  candidates.push({
    id: 'action.cityProperty.large',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'large' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= cityLargeMax,
    summary:
      `Stadtbesitz (gross) erwerben (Basis: 50 Gold; Max: ${cityLargeMax} Gold).`,
  });

  // Domäne (alle Stufen)
  const domainSmallMax = worstCaseCost(35, bufferFactor);
  candidates.push({
    id: 'action.domain.small',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'small' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= domainSmallMax,
    summary: `Domäne (klein) erwerben (Basis: 35 Gold; Max: ${domainSmallMax} Gold).`,
  });
  const domainMediumMax = worstCaseCost(80, bufferFactor);
  candidates.push({
    id: 'action.domain.medium',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'medium' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= domainMediumMax,
    summary:
      `Domäne (mittel) erwerben (Basis: 80 Gold; Max: ${domainMediumMax} Gold).`,
  });
  const domainLargeMax = worstCaseCost(120, bufferFactor);
  candidates.push({
    id: 'action.domain.large',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'large' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= domainLargeMax,
    summary:
      `Domäne (gross) erwerben (Basis: 120 Gold; Max: ${domainLargeMax} Gold).`,
  });

  // Organisationen (Unterwelt / Collegien)
  {
    const maxCityTier = Math.max(
      0,
      ...me.holdings.cityProperties.map((c) => postTierRank(c.tier))
    );
    const orgKinds: Array<
      'underworld' | 'collegiumTrade' | 'collegiumCraft' | 'cult' | 'spy'
    > = ['underworld', 'collegiumTrade', 'collegiumCraft', 'cult', 'spy'];

    for (const kind of orgKinds) {
      const existing = me.holdings.organizations.find((o) => o.kind === kind);
      if (existing && existing.tier === 'large') continue;
      const nextTier = !existing
        ? 'small'
        : existing.tier === 'small'
          ? 'medium'
          : 'large';
      const rank = postTierRank(nextTier);
      const base =
        kind === 'cult'
          ? { gold: 10, influence: 6 }
          : kind.startsWith('collegium')
            ? { gold: 20, influence: 2 }
            : { gold: 16, influence: 6 };
      const goldBase = base.gold * rank;
      const influenceBase = base.influence * rank;
      const goldNeeded = worstCaseCost(goldBase, bufferFactor);
      const influenceNeeded = worstCaseCost(influenceBase, bufferFactor);
      const hqOk = maxCityTier >= rank;
      const possibleNow =
        me.economy.gold >= goldNeeded &&
        me.turn.influenceAvailable >= influenceNeeded &&
        hqOk;

      candidates.push({
        id: `action.org.${kind}`,
        kind: 'action',
        command: { type: 'AcquireOrganization', campaignId: '', kind },
        actionKey: `acquire.org.${kind}`,
        possibleNow,
        summary: `${kind} ausbauen (Stufe ${nextTier}; Basis: ${goldBase} Gold, ${influenceBase} Einfluss; Max: ${goldNeeded} Gold, ${influenceNeeded} Einfluss; HQ Stadtbesitz ≥ ${nextTier}).`,
      });
    }
  }

  // Pächter/Anhänger (1/mid/max)
  {
    const pushTenants = (options: {
      idPrefix: string;
      location: { kind: 'domain' | 'cityProperty' | 'organization'; id: string };
      current: number;
      max: number;
      goldPerLevel: number;
      influencePerLevel: number;
      label: string;
    }) => {
      const remaining = options.max - options.current;
      if (remaining <= 0) return;
      for (const levels of pickBudgetOptions(remaining)) {
        const goldBase = levels * options.goldPerLevel;
        const influenceBase = levels * options.influencePerLevel;
        const goldNeeded = worstCaseCost(goldBase, bufferFactor);
        const influenceNeeded = worstCaseCost(influenceBase, bufferFactor);
        const possibleNow =
          me.economy.gold >= goldNeeded &&
          me.turn.influenceAvailable >= influenceNeeded;
        candidates.push({
          id: `${options.idPrefix}.${options.location.id}.+${levels}`,
          kind: 'action',
          command: {
            type: 'AcquireTenants',
            campaignId: '',
            location: options.location,
            levels,
          },
          actionKey: 'acquire.tenants',
          possibleNow,
          summary: `${options.label} +${levels} (Basis: ${goldBase} Gold, ${influenceBase} Einfluss; Max: ${goldNeeded} Gold, ${influenceNeeded} Einfluss).`,
        });
      }
    };

    const city = citiesByTier.find((c) => {
      const cap = c.tier === 'small' ? 2 : c.tier === 'medium' ? 3 : 4;
      return c.tenants.levels < cap;
    });
    if (city) {
      const cap = city.tier === 'small' ? 2 : city.tier === 'medium' ? 3 : 4;
      pushTenants({
        idPrefix: 'action.tenants.city',
        location: { kind: 'cityProperty', id: city.id },
        current: city.tenants.levels,
        max: cap,
        goldPerLevel: 12,
        influencePerLevel: 4,
        label: `Pächter Stadtbesitz ${city.id}`,
      });
    }

    const domain = domainsByTier.find((d) => {
      if (d.tier === 'starter') return false;
      const cap = d.tier === 'small' ? 2 : d.tier === 'medium' ? 4 : 8;
      return d.tenants.levels < cap;
    });
    if (domain) {
      const cap = domain.tier === 'small' ? 2 : domain.tier === 'medium' ? 4 : 8;
      pushTenants({
        idPrefix: 'action.tenants.domain',
        location: { kind: 'domain', id: domain.id },
        current: domain.tenants.levels,
        max: cap,
        goldPerLevel: 12,
        influencePerLevel: 4,
        label: `Pächter Domäne ${domain.id}`,
      });
    }

    const org = me.holdings.organizations.find(
      (o) => o.kind !== 'spy' && o.followers.levels >= 0
    );
    if (org) {
      const rank = postTierRank(org.tier);
      let max = rank;
      let goldPerLevel = 12;
      let influencePerLevel = 4;
      if (org.kind === 'underworld') {
        max = 2 * rank;
        goldPerLevel = 12;
        influencePerLevel = 10;
      } else if (org.kind === 'cult') {
        max = rank === 1 ? 2 : rank === 2 ? 4 : 8;
        goldPerLevel = 8;
        influencePerLevel = 8;
      }
      if (org.followers.levels < max) {
        pushTenants({
          idPrefix: `action.followers.${org.kind}`,
          location: { kind: 'organization', id: org.id },
          current: org.followers.levels,
          max,
          goldPerLevel,
          influencePerLevel,
          label: `Anhaenger ${org.kind} ${org.id}`,
        });
      }
    }
  }

  return dedupeCandidates(candidates);
}

function ruleCheatSheet(): string {
  return [
    'Regelhinweise (v1, stark verkürzt):',
    '- Zielwertung (GoldEq): Gold + Inventarwert + Assets (Preis + erwarteter ROI) + Einfluss (GoldEq).',
    '- Pro Runde: 2 Aktionen + 1 freie Einrichtungs-/Ausbauaktion (Sonderaktion).',
    '- Einrichtungen an Aemtern/Orgs/Werkstaetten/Handel geben Einfluss pro Runde (general: +1/+2/+3; special: +2/+3/+4).',
    '- Aemter koennen auf Einfluss, Gold oder Split (50/50) gestellt werden.',
    '- Pro Runde je ActionKey nur 1x (Ausnahme: Einfluss-Bonusaktionen, falls verfügbar).',
    '- Verkauf kann optional einen Kauf im selben Zug enthalten (belegt money.sell und money.buy).',
    '- MoneyBuy ermoeglicht reinen Einkauf (5 RM oder 1 SM pro Invest).',
    '- Kleine Aemter haben ein Cap: 8 + 2 pro mittlerem Amt + 4 pro grossem Amt.',
    '- Domänen haben 4 RM-Picks; Ertrag und Domänenverwaltung werden darauf verteilt.',
    '- Werkstätten verarbeiten nur ihr inputMaterial und erzeugen ihr outputMaterial.',
    '- Veredelungs-Einrichtungen werten Werkstatt-Output pro Stufe um 1 Kategorie auf.',
    '- Rohmaterial/Sondermaterial wird am Rundenende auto-konvertiert (RM 4:1, SM 1:2), außer gelagert.',
    '- Verkauf: je 6 RM oder 1 SM = 1 Investment; Marktsystem kann Wert pro Investment verändern.',
    '- Einkauf: je 5 RM oder 1 SM = 1 Investment; Markt-Modifier wirken invers (hoher Mod = guenstiger).',
    '- Handelsmärkte (TradeEnterprises) sind in Stürmen/Piraterie/Konflikt riskant: beim Verkauf kann Frachtverlust Gold reduzieren.',
    '- Unterwelt-Organisationen liefern Gold und Einfluss (skaliert mit Staedtischem Besitz).',
    '- Fehlschlag bei Erwerb-Posten (Domäne/Stadt/Ämter/Circel/Truppen/Pächter): Aktion verbraucht, Ressourcen bleiben erhalten.',
    '- Checks: Startwert (Modifikator) = +3; steigt um +1 ab Runde 10/20/30 (effektiv = base + floor(Runde/10)).',
  ].join('\n');
}

function summarizeIds(ids: string[], limit = 20): string {
  const shown = ids.slice(0, limit);
  return ids.length <= limit
    ? shown.join(', ')
    : `${shown.join(', ')}, … (+${ids.length - limit})`;
}

function normalizeNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function planFacilityWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  userId: string;
  state: CampaignState;
  me: PlayerState;
  round: number;
  publicLog: string[];
  systemPreamble?: string;
  strategyCard?: StrategyCard;
  recentSummaries?: string[];
  market: CampaignMarketLike;
}): Promise<LlmFacilityPlan> {
  const bufferFactor = bufferFactorForStrategy(
    options.strategyCard,
    options.systemPreamble
  );
  const facilityCandidates = buildFacilityCandidates(options.me, bufferFactor);
  const possibleFacilities = facilityCandidates.filter((c) => c.possibleNow);
  if (possibleFacilities.length === 0) {
    return { facility: null, note: 'keine Facility verfuegbar' };
  }

  const mcCandidates: McCandidate[] = [
    {
      id: 'null',
      kind: 'facility',
      command: null,
      summary: 'keine Facility',
      possibleNow: true,
    },
    ...possibleFacilities.map((c) => ({
      id: c.id,
      kind: c.kind,
      command: c.command,
      summary: c.summary,
      possibleNow: c.possibleNow,
    })),
  ];
  const mcContext: McContext = {
    userId: options.userId,
    weights: weightsForStrategy(options.strategyCard),
    seedSalt: `${options.state.id}|${options.userId}|r${options.round}|facility`,
    rollouts: MC_ROLLOUTS,
    depth: MC_DEPTH,
    bufferFactor,
    maxActionCandidates: MC_MAX_ACTION_CANDIDATES,
  };
  const mcRanked = scoreCandidatesWithMc(options.state, mcCandidates, mcContext);
  const mcRankedSafe =
    mcRanked.length > 0
      ? mcRanked
      : scoreCandidatesFallback(
          options.state,
          mcCandidates,
          mcContext,
          `facility|r${options.round}`
        );
  if (mcRankedSafe.length === 0) {
    return { facility: null, note: 'keine Facility verfuegbar' };
  }
  const mcTopBase = mcRankedSafe.slice(0, MC_TOP_N_FACILITY);
  const nullScore = mcRankedSafe.find((c) => c.candidate.command == null);
  const mcTop = [...mcTopBase];
  if (nullScore && !mcTop.some((c) => c.candidate.command == null)) {
    mcTop.push(nullScore);
  }
  const shouldPreferOfficeSplit =
    strategyWantsOffices(options.strategyCard, options.systemPreamble) &&
    options.round >= 2;
  if (shouldPreferOfficeSplit) {
    const splitCandidate = facilityCandidates.find(
      (c) =>
        c.command?.type === 'SetOfficeYieldMode' &&
        c.command.mode === 'split' &&
        c.possibleNow
    );
    if (
      splitCandidate &&
      !mcTop.some((c) => c.candidate.id === splitCandidate.id)
    ) {
      const scored = mcRankedSafe.find(
        (c) => c.candidate.id === splitCandidate.id
      );
      if (scored) mcTop.push(scored);
    }
  }
  const allowNullFacility = true;
  const allowedFacilityCandidates = mcTop
    .filter((c) => c.candidate.command != null)
    .map((c) => c.candidate);
  const allowedFacilityIds = new Set(
    allowedFacilityCandidates.map((c) => c.id)
  );
  const allowedFacilityCandidatesTop = facilityCandidates.filter((c) =>
    allowedFacilityIds.has(c.id)
  );

  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere deinen Gesamt-Score (GoldEq).',
    'Wähle genau eine Facility-Candidate-ID oder null (Sonderaktion).',
    'Diese Sonderaktion wird nur einmal pro Runde abgefragt.',
    `Du siehst die MC Top-${MC_TOP_N_FACILITY} Optionen (plus ggf. "null" zum Aussetzen).`,
    'Wähle ausschließlich aus dieser Liste; wenn du einen niedrigeren MC-Score nimmst, begründe es klar mit der Strategie.',
    'Wähle ausschließlich IDs aus dieser Liste; kopiere sie exakt (keine eigenen Zahlen/Varianten).',
    'Bevorzuge Kandidaten mit [now]; wähle [later?] nur wenn keine [now] existieren.',
    'Gib im Feld "note" eine kurze Begründung (1 Satz) für deine Entscheidung an.',
    'Antworte auf Deutsch, im JSON Format.',
    ruleCheatSheet(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptLines: string[] = [];
  promptLines.push(`Spieler: ${options.agentName}`);
  promptLines.push(`Runde: ${options.round} (Phase: actions, Sonderaktion)`);
  if (options.systemPreamble) {
    promptLines.push(`Strategie: ${options.systemPreamble}`);
  }
  promptLines.push('Ziel: Maximiere Gesamt-Score (Strategie beachten).');
  promptLines.push('');

  if (options.strategyCard) {
    promptLines.push('Strategie-Card:');
    for (const line of formatStrategyCard(options.strategyCard)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.recentSummaries && options.recentSummaries.length > 0) {
    promptLines.push('Letzte Runden (Kurz):');
    for (const line of options.recentSummaries) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }
  promptLines.push('Dein Zustand:');
  promptLines.push(formatPlayerState({ me: options.me, round: options.round }));
  promptLines.push('');

  const marketLines = formatMarketSnapshot(options.me, options.market);
  promptLines.push('Markt (deine Optionen):');
  for (const line of marketLines) {
    promptLines.push(`- ${line}`);
  }
  promptLines.push('');

  if (options.publicLog.length > 0) {
    promptLines.push('Öffentliches Log (neu):');
    for (const line of options.publicLog.slice(-12)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  promptLines.push(
    `Facility-Candidates (MC Top ${mcTop.length}, depth=${MC_DEPTH}, rollouts=${MC_ROLLOUTS}):`
  );
  for (const scored of mcTop) {
    const c = scored.candidate;
    const label = c.command ? c.id : 'null';
    const possible = c.possibleNow ? 'now' : 'later?';
    promptLines.push(
      `- ${label} [${possible}]: ${c.summary} | ${formatMcScore(scored)}`
    );
  }

  const maxPlanAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxPlanAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      llmEnv.MYRANOR_LLM_TIMEOUT_MS
    );
    let raw: z.infer<typeof facilityDecisionSchema>;
    try {
      const attemptPrompt = [
        ...promptLines,
        attempt > 1 && lastError
          ? `\nACHTUNG: Deine letzte Antwort war ungültig: ${lastError.message}\nAntworte erneut mit korrekter Facility-ID (nur [now]) oder null und einer kurzen note.`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await generateText({
        model: options.model,
        output: Output.object({ schema: facilityDecisionSchema }),
        system,
        prompt: attemptPrompt,
        providerOptions: {
          google: {
            thinkingConfig: {
              // thinkingLevel: 'high',
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
        maxRetries: 2,
        abortSignal: controller.signal,
      });

      raw = res.output as z.infer<typeof facilityDecisionSchema>;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} facility: ${err.message}`
        );
      }
      continue;
    } finally {
      clearTimeout(timeout);
    }

    try {
      const facilityIdRaw = raw.facilityCandidateId;
      const normalized =
        typeof facilityIdRaw === 'string'
          ? facilityIdRaw.trim().toLowerCase()
          : null;
      const facilityId =
        normalized === 'null' || normalized === 'none' ? null : facilityIdRaw;
      const note = normalizeNote(raw.note);
      if (!note) throw new Error('note missing or empty');
      if (facilityId == null) {
        if (!allowNullFacility) {
          throw new Error('null facility ist nicht in der MC Top-Liste');
        }
      } else {
        const allowed = allowedFacilityCandidatesTop.find(
          (c) => c.id === facilityId
        );
        if (!allowed) {
          throw new Error(
            `unknown facilityCandidateId "${facilityId}". Valid: ${summarizeIds(
              allowedFacilityCandidatesTop.map((c) => c.id)
            )}`
          );
        }
        if (!allowed.possibleNow) {
          throw new Error(`facilityCandidateId "${facilityId}" is not [now]`);
        }
      }

      const facility =
        facilityId == null
          ? null
          : (allowedFacilityCandidatesTop.find((c) => c.id === facilityId)
              ?.command ?? null);

      return {
        facility,
        note,
        debug: llmEnv.MYRANOR_LLM_DEBUG
          ? {
              facilityCandidates: allowedFacilityCandidatesTop,
              rawModelOutput: raw,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} facility: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(
    `[LLM] ${options.agentName} R${options.round} facility: unable to produce a valid plan.`
  );
}

export async function planActionWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  userId: string;
  state: CampaignState;
  me: PlayerState;
  round: number;
  actionSlot: number;
  actionsPerRound: number;
  publicLog: string[];
  systemPreamble?: string;
  strategyCard?: StrategyCard;
  recentSummaries?: string[];
  market: CampaignMarketLike;
  roundActionLog: string[];
  facilityLog?: string | null;
}): Promise<LlmActionPlan> {
  const bufferFactor = bufferFactorForStrategy(
    options.strategyCard,
    options.systemPreamble
  );
  const actionCandidates = buildActionCandidates({
    round: options.round,
    me: options.me,
    state: { market: options.market },
    bufferFactor,
  });
  let allowedCandidates = filterActionCandidates(
    options.me,
    actionCandidates,
    options.actionsPerRound
  );
  if (
    strategyWantsUnderworld(options.strategyCard, options.systemPreamble) &&
    underworldTier(options.me) < 2
  ) {
    const filtered = allowedCandidates.filter((c) => {
      const cmd = c.command;
      if (!cmd) return true;
      if (cmd.type === 'AcquireOffice') return false;
      if (cmd.type === 'AcquireTradeEnterprise') return false;
      if (
        cmd.type === 'AcquireOrganization' &&
        cmd.kind !== 'underworld' &&
        cmd.kind !== 'spy'
      ) {
        return false;
      }
      return true;
    });
    if (filtered.length > 0) allowedCandidates = filtered;
  }

  const tempUnlockCandidate =
    strategyWantsOffices(options.strategyCard, options.systemPreamble)
      ? findTempInfluenceUnlockCandidate({
          state: options.state,
          me: options.me,
          userId: options.userId,
          round: options.round,
          actionSlot: options.actionSlot,
          actionsPerRound: options.actionsPerRound,
          actionCandidates,
          allowedCandidates,
        })
      : null;

  if (tempUnlockCandidate) {
    allowedCandidates = allowedCandidates.filter((c) => {
      if (c.command?.type !== 'GainInfluence') return true;
      return c.command.kind !== 'permanent';
    });
  }
  if (allowedCandidates.length === 0) {
    return { action: null, note: 'keine Aktionen verfuegbar' };
  }
  const mcCandidates: McCandidate[] = allowedCandidates.map((c) => ({
    id: c.id,
    kind: c.kind,
    command: c.command,
    summary: c.summary,
    possibleNow: c.possibleNow,
  }));
  const mcContext: McContext = {
    userId: options.userId,
    weights: weightsForStrategy(options.strategyCard),
    seedSalt: `${options.state.id}|${options.userId}|r${options.round}|slot${options.actionSlot}`,
    rollouts: MC_ROLLOUTS,
    depth: MC_DEPTH,
    bufferFactor,
    maxActionCandidates: MC_MAX_ACTION_CANDIDATES,
  };
  const mcRanked = scoreCandidatesWithMc(options.state, mcCandidates, mcContext);
  const mcRankedSafe =
    mcRanked.length > 0
      ? mcRanked
      : scoreCandidatesFallback(
          options.state,
          mcCandidates,
          mcContext,
          `action|r${options.round}|s${options.actionSlot}`
        );
  if (mcRankedSafe.length === 0) {
    return { action: null, note: 'keine Aktionen verfuegbar' };
  }
  const mcTopBase = mcRankedSafe.slice(0, MC_TOP_N_ACTION);
  const mcTop = [...mcTopBase];
  const shouldPreferMoneyLend =
    strategyWantsMoney(options.strategyCard, options.systemPreamble) &&
    options.round <= 4;
  if (shouldPreferMoneyLend) {
    const moneyLendCandidates = allowedCandidates.filter(
      (c) => c.command?.type === 'MoneyLend'
    );
    const bestMoneyLend = moneyLendCandidates.sort((a, b) => {
      const invA =
        a.command?.type === 'MoneyLend' ? a.command.investments : 0;
      const invB =
        b.command?.type === 'MoneyLend' ? b.command.investments : 0;
      return invB - invA;
    })[0];
    if (bestMoneyLend && !mcTop.some((c) => c.candidate.id === bestMoneyLend.id)) {
      const scored = mcRankedSafe.find(
        (c) => c.candidate.id === bestMoneyLend.id
      );
      if (scored) mcTop.push(scored);
    }
  }
  const shouldPreferTradeEnterprise =
    strategyWantsMoney(options.strategyCard, options.systemPreamble) &&
    options.me.holdings.tradeEnterprises.length === 0;
  if (shouldPreferTradeEnterprise) {
    const tradeCandidates = allowedCandidates.filter(
      (c) => c.command?.type === 'AcquireTradeEnterprise'
    );
    const bestTrade =
      tradeCandidates.find(
        (c) =>
          c.command?.type === 'AcquireTradeEnterprise' &&
          c.command.tier === 'small' &&
          c.possibleNow
      ) ??
      tradeCandidates.find((c) => c.possibleNow) ??
      tradeCandidates[0];
    if (bestTrade && !mcTop.some((c) => c.candidate.id === bestTrade.id)) {
      const scored = mcRankedSafe.find((c) => c.candidate.id === bestTrade.id);
      if (scored) mcTop.push(scored);
    }
  }
  const shouldPreferOffices =
    strategyWantsOffices(options.strategyCard, options.systemPreamble) &&
    options.round >= 2;
  if (shouldPreferOffices) {
    const officeCandidates = allowedCandidates.filter(
      (c) => c.command?.type === 'AcquireOffice'
    );
    const bestOffice =
      officeCandidates.find((c) => c.possibleNow) ?? officeCandidates[0];
    if (bestOffice && !mcTop.some((c) => c.candidate.id === bestOffice.id)) {
      const scored = mcRankedSafe.find((c) => c.candidate.id === bestOffice.id);
      if (scored) mcTop.push(scored);
    }

    const tempInfluenceCandidate =
      tempUnlockCandidate ??
      pickTempInfluenceForOffice({
        me: options.me,
        actionsPerRound: options.actionsPerRound,
        candidates: allowedCandidates,
        strategyCard: options.strategyCard,
        systemPreamble: options.systemPreamble,
        bufferFactor,
      });
    const influenceCandidates = allowedCandidates.filter(
      (c) => c.command?.type === 'GainInfluence'
    );
    const bestInfluence =
      tempInfluenceCandidate ??
      influenceCandidates
        .sort((a, b) => {
          const cmdA = a.command?.type === 'GainInfluence' ? a.command : null;
          const cmdB = b.command?.type === 'GainInfluence' ? b.command : null;
          const kindScore = (cmd: typeof cmdA) =>
            cmd?.kind === 'permanent' ? 2 : 1;
          const scoreA =
            kindScore(cmdA) * 100 + (cmdA?.investments ?? 0);
          const scoreB =
            kindScore(cmdB) * 100 + (cmdB?.investments ?? 0);
          return scoreB - scoreA;
        })[0];
    if (
      bestInfluence &&
      !mcTop.some((c) => c.candidate.id === bestInfluence.id)
    ) {
      const scored = mcRankedSafe.find(
        (c) => c.candidate.id === bestInfluence.id
      );
      if (scored) mcTop.push(scored);
    }
  }
  if (tempUnlockCandidate) {
    const scored = mcRankedSafe.find(
      (c) => c.candidate.id === tempUnlockCandidate.id
    );
    if (scored && !mcTop.some((c) => c.candidate.id === scored.candidate.id)) {
      mcTop.push(scored);
    }
  }
  const shouldPreferUnderworld = strategyWantsUnderworld(
    options.strategyCard,
    options.systemPreamble
  );
  if (shouldPreferUnderworld) {
    const underworldCandidate = allowedCandidates.find(
      (c) =>
        c.command?.type === 'AcquireOrganization' &&
        c.command.kind === 'underworld'
    );
    const spyCandidate = allowedCandidates.find(
      (c) => c.command?.type === 'AcquireOrganization' && c.command.kind === 'spy'
    );
    if (
      underworldCandidate &&
      !mcTop.some((c) => c.candidate.id === underworldCandidate.id)
    ) {
      const scored = mcRankedSafe.find(
        (c) => c.candidate.id === underworldCandidate.id
      );
      if (scored) mcTop.push(scored);
    }
    if (
      !underworldCandidate &&
      spyCandidate &&
      !mcTop.some((c) => c.candidate.id === spyCandidate.id)
    ) {
      const scored = mcRankedSafe.find((c) => c.candidate.id === spyCandidate.id);
      if (scored) mcTop.push(scored);
    }

    const underworldOrg = [...options.me.holdings.organizations]
      .filter((o) => o.kind === 'underworld')
      .sort((a, b) => postTierRank(b.tier) - postTierRank(a.tier))[0];
    if (underworldOrg) {
      const followerCandidate = allowedCandidates
        .filter((c) => c.command?.type === 'AcquireTenants')
        .filter(
          (c) =>
            c.command?.type === 'AcquireTenants' &&
            c.command.location.kind === 'organization' &&
            c.command.location.id === underworldOrg.id
        )
        .sort((a, b) => {
          const aLevels =
            a.command?.type === 'AcquireTenants' ? a.command.levels : 0;
          const bLevels =
            b.command?.type === 'AcquireTenants' ? b.command.levels : 0;
          return bLevels - aLevels;
        })[0];
      if (
        followerCandidate &&
        !mcTop.some((c) => c.candidate.id === followerCandidate.id)
      ) {
        const scored = mcRankedSafe.find(
          (c) => c.candidate.id === followerCandidate.id
        );
        if (scored) mcTop.push(scored);
      }
    }
  }
  const allowedCandidateIds = new Set(mcTop.map((c) => c.candidate.id));
  const allowedCandidatesTop = allowedCandidates.filter((c) =>
    allowedCandidateIds.has(c.id)
  );

  const tempUnlockHint = tempUnlockCandidate
    ? 'Hinweis: Eine temp. Einfluss-Aktion ermoeglicht diese Runde einen Posten-Kauf. Priorisiere temp. Einfluss vor permanentem Einfluss.'
    : null;
  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere deinen Gesamt-Score (GoldEq).',
    'Wähle genau eine Action-Candidate-ID aus der Liste.',
    'Du planst sequentiell: Nach jeder Aktion wirst du erneut gefragt. Wähle nur die beste nächste Aktion.',
    `Du siehst die MC Top-${MC_TOP_N_ACTION} Optionen (ggf. plus MoneyLend-Bias in frühen Runden, Amtsfokus-Bias ab Runde 2, Unterwelt-Bias).`,
    'Wähle ausschließlich aus dieser Liste; wenn du einen niedrigeren MC-Score nimmst, begründe es klar mit der Strategie.',
    'Wähle ausschließlich IDs aus dieser Liste; kopiere sie exakt (keine eigenen Zahlen/Varianten).',
    'Gib im Feld "note" eine kurze Begründung (1 Satz) für deine Entscheidung an.',
    'Antworte auf Deutsch, im JSON Format.',
    tempUnlockHint,
    ruleCheatSheet(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptLines: string[] = [];
  promptLines.push(`Spieler: ${options.agentName}`);
  promptLines.push(`Runde: ${options.round} (Phase: actions)`);
  promptLines.push(`Action-Slot: ${options.actionSlot}`);
  if (options.systemPreamble) {
    promptLines.push(`Strategie: ${options.systemPreamble}`);
  }
  promptLines.push('Ziel: Maximiere Gesamt-Score (Strategie beachten).');
  promptLines.push('');
  if (options.strategyCard) {
    promptLines.push('Strategie-Card:');
    for (const line of formatStrategyCard(options.strategyCard)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.recentSummaries && options.recentSummaries.length > 0) {
    promptLines.push('Letzte Runden (Kurz):');
    for (const line of options.recentSummaries) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }
  promptLines.push('Dein Zustand:');
  promptLines.push(formatPlayerState({ me: options.me, round: options.round }));
  promptLines.push(formatActionCapacity(options.me, options.actionsPerRound));
  promptLines.push('');

  const marketLines = formatMarketSnapshot(options.me, options.market);
  promptLines.push('Markt (deine Optionen):');
  for (const line of marketLines) {
    promptLines.push(`- ${line}`);
  }
  promptLines.push('');

  if (options.facilityLog) {
    promptLines.push(`Sonderaktion diese Runde: ${options.facilityLog}`);
    promptLines.push('');
  }

  if (options.roundActionLog.length > 0) {
    promptLines.push('Deine Aktionen diese Runde (bisher):');
    for (const line of options.roundActionLog.slice(-6)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (options.publicLog.length > 0) {
    promptLines.push('Öffentliches Log (neu):');
    for (const line of options.publicLog.slice(-12)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  if (shouldPreferMoneyLend) {
    promptLines.push(
      'Hinweis: Fruehe Runden (<=4) priorisieren kurzfristiges Gold. MoneyLend ist bevorzugt, wenn es die beste Kurzfrist-Option ist.'
    );
    promptLines.push('');
  }

  promptLines.push(
    `Action-Candidates (MC Top ${mcTop.length}, depth=${MC_DEPTH}, rollouts=${MC_ROLLOUTS}):`
  );
  for (const scored of mcTop) {
    const c = scored.candidate;
    promptLines.push(`- ${c.id} [now]: ${c.summary} | ${formatMcScore(scored)}`);
  }

  const maxPlanAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxPlanAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      llmEnv.MYRANOR_LLM_TIMEOUT_MS
    );
    let raw: z.infer<typeof actionDecisionSchema>;
    try {
      const attemptPrompt = [
        ...promptLines,
        attempt > 1 && lastError
          ? `\nACHTUNG: Deine letzte Antwort war ungültig: ${lastError.message}\nAntworte erneut mit einer gültigen Action-ID (nur [now]) und einer kurzen note.`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await generateText({
        model: options.model,
        output: Output.object({ schema: actionDecisionSchema }),
        system,
        prompt: attemptPrompt,
        providerOptions: {
          google: {
            thinkingConfig: {
              // thinkingLevel: 'high',
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
        maxRetries: 2,
        abortSignal: controller.signal,
      });

      raw = res.output as z.infer<typeof actionDecisionSchema>;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: ${err.message}`
        );
      }
      continue;
    } finally {
      clearTimeout(timeout);
    }

    try {
      const actionId = raw.actionCandidateId;
      const note = normalizeNote(raw.note);
      if (!note) throw new Error('note missing or empty');
      const actionCandidate = allowedCandidatesTop.find(
        (c) => c.id === actionId
      );
      if (!actionCandidate) {
        throw new Error(
          `unknown actionCandidateId "${actionId}". Valid: ${summarizeIds(
            allowedCandidatesTop.map((c) => c.id)
          )}`
        );
      }

      return {
        action: actionCandidate.command,
        note,
        debug: llmEnv.MYRANOR_LLM_DEBUG
          ? {
              actionCandidates: allowedCandidatesTop,
              rawModelOutput: raw,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxPlanAttempts) {
        throw new Error(
          `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(
    `[LLM] ${options.agentName} R${options.round} A${options.actionSlot}: unable to produce a valid plan.`
  );
}

export function toGameCommand(command: AgentCommand, campaignId: string) {
  return { ...command, campaignId } as GameCommand;
}

export function actionKeyOf(command: AgentCommand): string | null {
  return expectedActionKey(command);
}

function expectedActionKey(command: AgentCommand): string | null {
  switch (command.type) {
    case 'GainMaterials':
      return command.mode === 'domainAdministration'
        ? 'materials.domain'
        : 'materials.workshop';
    case 'GainInfluence':
      return 'influence';
    case 'MoneyLend':
      return 'money.lend';
    case 'MoneySell':
      return 'money.sell';
    case 'MoneyBuy':
      return 'money.buy';
    case 'MoneySellBuy':
      return 'money.sell';
    case 'AcquireDomain':
      return 'acquire.domain';
    case 'AcquireCityProperty':
      return 'acquire.cityProperty';
    case 'AcquireOffice':
      return 'acquire.office';
    case 'AcquireOrganization':
      return `acquire.org.${command.kind}`;
    case 'AcquireTradeEnterprise':
      return 'acquire.trade';
    case 'AcquireTenants':
      return 'acquire.tenants';
    case 'RecruitTroops':
      return `troops.${command.troopKind}`;
    default:
      return null;
  }
}
