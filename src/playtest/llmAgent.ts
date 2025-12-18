import { type LanguageModel, Output, generateText } from 'ai';
import { z } from 'zod';

import type { GameCommand, PlayerState } from '../core';
import { getMaterialOrThrow } from '../core/rules/materials_v1';

import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { llmEnv } from '../llm/env';

export type AgentCommand = GameCommand;

type Candidate = {
  id: string;
  kind: 'facility' | 'action';
  command: AgentCommand;
  actionKey: string | null;
  possibleNow: boolean;
  summary: string;
};

export type LlmTurnPlan = {
  facility: AgentCommand | null;
  actionPriority: AgentCommand[];
  note: string | null;
  debug?: {
    facilityCandidates: Candidate[];
    actionCandidates: Candidate[];
    rawModelOutput: unknown;
  };
};

const decisionSchema = z.object({
  facilityCandidateId: z.string().nullable(),
  actionCandidateIds: z.array(z.string()).min(1),
  note: z.string().optional(),
});

function sumStock(stock: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(stock)) sum += v;
  return sum;
}

function postTierRank(tier: 'small' | 'medium' | 'large'): number {
  return tier === 'small' ? 1 : tier === 'medium' ? 2 : 3;
}

function sellBuyInvestmentCap(me: PlayerState): number {
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

function localMarketInstanceId(): string {
  return 'local';
}

function buildFacilityCandidates(me: PlayerState): Candidate[] {
  const candidates: Candidate[] = [];

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

  const buildStorageDomain = me.holdings.domains.find(
    (d) => d.tier !== 'starter'
  );
  if (buildStorageDomain) {
    const hasStorage = me.holdings.storages.some(
      (s) =>
        s.location.kind === 'domain' && s.location.id === buildStorageDomain.id
    );
    if (!hasStorage) {
      const possibleNow = me.economy.gold >= 8;
      candidates.push({
        id: 'facility.storage.buildSmall',
        kind: 'facility',
        command: {
          type: 'BuildStorage',
          campaignId: '',
          location: { kind: 'domain', id: buildStorageDomain.id },
          tier: 'small',
        },
        actionKey: null,
        possibleNow,
        summary: `Lager (klein) bauen auf Domäne ${buildStorageDomain.id} (8 Gold).`,
      });
    }
  }

  return candidates;
}

function formatPlayerState(state: { me: PlayerState; round: number }): string {
  const me = state.me;
  const rawTotal = sumStock(me.economy.inventory.raw);
  const specialTotal = sumStock(me.economy.inventory.special);

  const domains = me.holdings.domains.map((d) => d.tier).join(', ') || '-';
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

  return [
    `Runde: ${state.round}`,
    `Gold: ${me.economy.gold} (pending: ${me.economy.pending.gold})`,
    `RM: ${rawTotal}, SM: ${specialTotal}, Zauberkraft: ${me.economy.inventory.magicPower}`,
    `AK verfügbar: ${me.turn.laborAvailable}, Einfluss verfügbar: ${me.turn.influenceAvailable}`,
    `Aktionen: used=${me.turn.actionsUsed}, keys=[${me.turn.actionKeysUsed.join(', ')}]`,
    `Domänen: ${domains}`,
    `Stadtbesitz: ${cities}`,
    `Ämter: ${offices}`,
    `Organisationen: ${orgs}`,
    `Handelsunternehmungen: ${trades}`,
    `Truppen: bodyguard=${me.holdings.troops.bodyguardLevels}, militia=${me.holdings.troops.militiaLevels}, merc=${me.holdings.troops.mercenaryLevels}, thug=${me.holdings.troops.thugLevels}`,
  ].join('\n');
}

function buildMoneySellCandidate(
  state: { me: PlayerState; market: CampaignMarketLike },
  maxInvestments?: number
): Candidate | null {
  const me = state.me;
  const cap = sellBuyInvestmentCap(me);
  const budget = Math.max(0, Math.min(cap, Math.trunc(maxInvestments ?? cap)));
  if (budget <= 0) return null;

  const inst =
    state.market.instances.find((i) => i.id === localMarketInstanceId()) ??
    state.market.instances[0];
  if (!inst) return null;

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

  let remaining = budget;
  const rawCounts: Record<string, number> = {};
  const specialCounts: Record<string, number> = {};

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.investments, remaining);
    remaining -= take;
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

  const possibleNow = true;
  return {
    id: `action.money.sell.best.${budget}`,
    kind: 'action',
    command: {
      type: 'MoneySell',
      campaignId: '',
      marketInstanceId: inst.id,
      items,
    },
    actionKey: 'money.sell',
    possibleNow,
    summary: `Verkauf (bestes Paket, ~${budget} Investments) auf ${inst.label}.`,
  };
}

type CampaignMarketLike = {
  instances: Array<{
    id: string;
    label: string;
    raw: { modifiersByGroup: Record<string, number> };
    special: { modifiersByGroup: Record<string, number> };
  }>;
};

function buildActionCandidates(options: {
  round: number;
  me: PlayerState;
  state: { market: CampaignMarketLike };
}): Candidate[] {
  const { me } = options;
  const candidates: Candidate[] = [];

  // Materialgewinn (Domain) – max.
  {
    const domain =
      me.holdings.domains.find((d) => d.tier !== 'starter') ??
      me.holdings.domains[0];
    if (domain) {
      const rank = domain.tier === 'starter' ? 1 : postTierRank(domain.tier);
      const cap = 4 * rank;
      const investments = Math.min(cap, me.turn.laborAvailable);
      if (investments > 0) {
        candidates.push({
          id: `action.materials.domain.max.${investments}`,
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
          summary: `Materialgewinn Domäne (${domain.id}) max=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Materialgewinn (Werkstatt) – max.
  {
    const workshop = me.holdings.workshops[0];
    if (workshop) {
      const cap = 2 * postTierRank(workshop.tier);
      const investments = Math.min(cap, me.turn.laborAvailable);
      if (investments > 0) {
        candidates.push({
          id: `action.materials.workshop.max.${investments}`,
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
          summary: `Materialgewinn Werkstatt (${workshop.id}) max=${investments}/${cap} (Kosten: ${investments} AK).`,
        });
      }
    }
  }

  // Einflussgewinn (temp) – 1..cap
  {
    const cap =
      me.holdings.offices.length || me.holdings.organizations.length ? 6 : 4;
    const max = Math.min(cap, me.economy.gold);
    for (let inv = 1; inv <= max; inv += 1) {
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
    const optionsToShow = Math.min(4, max);
    for (let inv = 1; inv <= optionsToShow; inv += 1) {
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
    const sell = buildMoneySellCandidate(
      { me, market: options.state.market },
      Math.min(6, sellBuyInvestmentCap(me))
    );
    if (sell) candidates.push(sell);
  }

  // Amt (klein)
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
    possibleNow: me.economy.gold >= 8 && me.turn.influenceAvailable >= 2,
    summary: 'Kleines Amt erlangen (8 Gold, 2 Einfluss).',
  });
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
    possibleNow: me.economy.gold >= 4 && me.turn.influenceAvailable >= 8,
    summary: 'Kleines Amt erlangen (4 Gold, 8 Einfluss).',
  });

  // Handelsunternehmung (klein)
  candidates.push({
    id: 'action.tradeEnterprise.small',
    kind: 'action',
    command: { type: 'AcquireTradeEnterprise', campaignId: '', tier: 'small' },
    actionKey: 'acquire.trade',
    possibleNow: me.economy.gold >= 20,
    summary: 'Handelsunternehmung (klein) erwerben (≈20 Gold).',
  });

  // Stadtbesitz (mittel) + Domäne (klein)
  candidates.push({
    id: 'action.cityProperty.medium',
    kind: 'action',
    command: { type: 'AcquireCityProperty', campaignId: '', tier: 'medium' },
    actionKey: 'acquire.cityProperty',
    possibleNow: me.economy.gold >= 25,
    summary: 'Stadtbesitz (mittel) erwerben (≈25 Gold).',
  });
  candidates.push({
    id: 'action.domain.small',
    kind: 'action',
    command: { type: 'AcquireDomain', campaignId: '', tier: 'small' },
    actionKey: 'acquire.domain',
    possibleNow: me.economy.gold >= 25,
    summary: 'Domäne (klein) erwerben (≈25 Gold).',
  });

  // Organisationen (Unterwelt / Collegien)
  candidates.push({
    id: 'action.org.underworld',
    kind: 'action',
    command: {
      type: 'AcquireOrganization',
      campaignId: '',
      kind: 'underworld',
    },
    actionKey: 'acquire.org.underworld',
    possibleNow: me.economy.gold >= 16,
    summary:
      'Unterweltcircel ausbauen (Kosten variieren nach Erfolg/Stufe; HQ nötig).',
  });
  candidates.push({
    id: 'action.org.collegiumTrade',
    kind: 'action',
    command: {
      type: 'AcquireOrganization',
      campaignId: '',
      kind: 'collegiumTrade',
    },
    actionKey: 'acquire.org.collegiumTrade',
    possibleNow: me.economy.gold >= 20,
    summary:
      'Handelscollegium ausbauen (Kosten variieren nach Erfolg/Stufe; HQ nötig).',
  });
  candidates.push({
    id: 'action.org.collegiumCraft',
    kind: 'action',
    command: {
      type: 'AcquireOrganization',
      campaignId: '',
      kind: 'collegiumCraft',
    },
    actionKey: 'acquire.org.collegiumCraft',
    possibleNow: me.economy.gold >= 20,
    summary:
      'Handwerkscollegium ausbauen (Kosten variieren nach Erfolg/Stufe; HQ nötig).',
  });

  // Pächter (1 Stufe auf erstem Stadtbesitz)
  {
    const city = me.holdings.cityProperties[0];
    if (city) {
      candidates.push({
        id: `action.tenants.city.${city.id}.+1`,
        kind: 'action',
        command: {
          type: 'AcquireTenants',
          campaignId: '',
          location: { kind: 'cityProperty', id: city.id },
          levels: 1,
        },
        actionKey: 'acquire.tenants',
        possibleNow: me.economy.gold >= 12 && me.turn.influenceAvailable >= 4,
        summary: `Pächter/Klienten anwerben (1 Stufe) für Stadtbesitz ${city.id}.`,
      });
    }
  }

  return candidates;
}

function ruleCheatSheet(): string {
  return [
    'Regelhinweise (v1, stark verkürzt):',
    '- Pro Runde: 2 Aktionen + 1 freie Einrichtungs-/Ausbauaktion (Sonderaktion).',
    '- Rohmaterial/Sondermaterial wird am Rundenende auto-konvertiert (RM 4:1, SM 1:2), außer gelagert.',
    '- Verkauf: je 6 RM oder 1 SM = 1 Investment; Marktsystem kann Wert pro Investment verändern.',
    '- Fehlschlag bei Erwerb-Posten (Domäne/Stadt/Ämter/Circel/Truppen/Pächter): Aktion verbraucht, Ressourcen bleiben erhalten.',
  ].join('\n');
}

export async function planTurnWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  me: PlayerState;
  round: number;
  publicLog: string[];
  systemPreamble?: string;
  market: CampaignMarketLike;
}): Promise<LlmTurnPlan> {
  const facilityCandidates = buildFacilityCandidates(options.me);
  const actionCandidates = buildActionCandidates({
    round: options.round,
    me: options.me,
    state: { market: options.market },
  });

  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere dein Final-Gold nach Ende der Simulation.',
    'Gib eine Facility (oder null) und eine priorisierte Liste von Action-Candidates zurück; der Runner probiert sie der Reihe nach, bis alle Aktionen für die Runde verbraucht sind.',
    'Antworte auf Deutsch, im JSON Format.',
    ruleCheatSheet(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptLines: string[] = [];
  promptLines.push(`Spieler: ${options.agentName}`);
  promptLines.push(`Runde: ${options.round} (Phase: actions)`);
  promptLines.push('');
  promptLines.push('Dein Zustand:');
  promptLines.push(formatPlayerState({ me: options.me, round: options.round }));
  promptLines.push('');

  if (options.publicLog.length > 0) {
    promptLines.push('Öffentliches Log (neu):');
    for (const line of options.publicLog.slice(-12)) {
      promptLines.push(`- ${line}`);
    }
    promptLines.push('');
  }

  promptLines.push('Facility-Candidates:');
  if (facilityCandidates.length === 0) {
    promptLines.push('- (keine)');
  } else {
    for (const c of facilityCandidates) {
      const possible = c.possibleNow ? 'now' : 'later?';
      promptLines.push(`- ${c.id} [${possible}]: ${c.summary}`);
    }
  }
  promptLines.push('');

  promptLines.push('Action-Candidates:');
  for (const c of actionCandidates) {
    const possible = c.possibleNow ? 'now' : 'later?';
    promptLines.push(`- ${c.id} [${possible}]: ${c.summary}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    llmEnv.MYRANOR_LLM_TIMEOUT_MS
  );
  let raw: z.infer<typeof decisionSchema>;
  try {
    const res = await generateText({
      model: options.model,
      output: Output.object({ schema: decisionSchema }),
      system,
      prompt: promptLines.join('\n'),
      providerOptions: {
        google: {
          thinkingConfig: {
            // thinkingLevel: 'high',
            thinkingBudget: 0,
            includeThoughts: false,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
      // temperature: llmEnv.MYRANOR_LLM_TEMPERATURE,
      // maxOutputTokens: llmEnv.MYRANOR_LLM_MAX_OUTPUT_TOKENS,
      maxRetries: 2,
      abortSignal: controller.signal,
    });

    raw = res.output as z.infer<typeof decisionSchema>;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: ${err.message}`
    );
  } finally {
    clearTimeout(timeout);
  }

  const summarizeIds = (ids: string[], limit = 20): string => {
    const shown = ids.slice(0, limit);
    return ids.length <= limit
      ? shown.join(', ')
      : `${shown.join(', ')}, … (+${ids.length - limit})`;
  };

  const facilityId = raw.facilityCandidateId;
  if (
    facilityId != null &&
    !facilityCandidates.some((c) => c.id === facilityId)
  ) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: unknown facilityCandidateId "${facilityId}". Valid: ${summarizeIds(
        facilityCandidates.map((c) => c.id)
      )}`
    );
  }

  const actionIds = raw.actionCandidateIds;
  if (actionIds.length === 0) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: actionCandidateIds is empty.`
    );
  }

  const uniqueActionIds = new Set(actionIds);
  if (uniqueActionIds.size !== actionIds.length) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: actionCandidateIds contains duplicates (${summarizeIds(
        actionIds
      )}).`
    );
  }

  const actionCandidateById = new Map(
    actionCandidates.map((c) => [c.id, c] as const)
  );
  const unknownActionIds = actionIds.filter(
    (id) => !actionCandidateById.has(id)
  );
  if (unknownActionIds.length > 0) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: unknown actionCandidateIds: ${summarizeIds(
        unknownActionIds
      )}.`
    );
  }

  const facility =
    facilityId == null
      ? null
      : (facilityCandidates.find((c) => c.id === facilityId)?.command ?? null);

  const actionPriority: AgentCommand[] = actionIds.map((id) => {
    const c = actionCandidateById.get(id);
    if (!c)
      throw new Error(
        `[LLM] ${options.agentName} R${options.round}: missing candidate "${id}".`
      );
    return c.command;
  });

  return {
    facility,
    actionPriority,
    note: raw.note?.trim() ? raw.note.trim() : null,
    debug: llmEnv.MYRANOR_LLM_DEBUG
      ? {
          facilityCandidates,
          actionCandidates,
          rawModelOutput: raw,
        }
      : undefined,
  };
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
