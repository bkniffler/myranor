import { type LanguageModel, Output, generateText } from 'ai';
import { z } from 'zod';

import type { GameCommand, PlayerState } from '../core';
import { llmEnv } from '../llm/env';

export type AgentCommand =
  | {
      type: 'GatherMaterials';
      mode: 'domain' | 'workshop';
      investments: number;
    }
  | { type: 'GainInfluence'; investments: number }
  | { type: 'LendMoney'; investments: number }
  | { type: 'SellMaterials'; resource: 'raw' | 'special'; investments: number }
  | { type: 'AcquireOffice'; payment: 'gold' | 'influence' }
  | {
      type: 'BuildFacility';
      facility: 'upgradeStarterDomainToSmall' | 'buildSmallStorage';
    };

export type Candidate = {
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
  actionCandidateIds: z.array(z.string()),
  note: z.string().optional(),
});

function domainTierRank(
  tier: PlayerState['infrastructure']['domainTier']
): number {
  switch (tier) {
    case 'starter':
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}

function workshopTierRank(
  tier: PlayerState['infrastructure']['workshopTier']
): number {
  switch (tier) {
    case 'none':
      return 0;
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
  }
}

function expectedActionKey(command: AgentCommand): string | null {
  switch (command.type) {
    case 'GatherMaterials':
      return command.mode === 'domain'
        ? 'material.domain'
        : 'material.workshop';
    case 'GainInfluence':
      return 'influence';
    case 'LendMoney':
      return 'money.lend';
    case 'SellMaterials':
      return 'money.sell';
    case 'AcquireOffice':
      return 'acquire.office';
    case 'BuildFacility':
      return null;
  }
}

function buildFacilityCandidates(me: PlayerState): Candidate[] {
  const candidates: Candidate[] = [];

  const canUpgradeDomain =
    !me.turn.facilityActionUsed &&
    me.infrastructure.domainTier === 'starter' &&
    me.economy.gold >= 10 &&
    me.turn.laborAvailable >= 4;
  if (canUpgradeDomain) {
    candidates.push({
      id: 'facility.upgradeStarterDomainToSmall',
      kind: 'facility',
      command: {
        type: 'BuildFacility',
        facility: 'upgradeStarterDomainToSmall',
      },
      actionKey: null,
      possibleNow: true,
      summary: 'Domäne ausbauen: starter → small (Kosten: 10 Gold, 4 AK).',
    });
  }

  const canBuildStorage =
    !me.turn.facilityActionUsed &&
    me.infrastructure.storageTier === 'none' &&
    me.economy.gold >= 8;
  if (canBuildStorage) {
    candidates.push({
      id: 'facility.buildSmallStorage',
      kind: 'facility',
      command: { type: 'BuildFacility', facility: 'buildSmallStorage' },
      actionKey: null,
      possibleNow: true,
      summary: 'Lager errichten: small (Kosten: 8 Gold).',
    });
  }

  return candidates;
}

function buildActionCandidates(me: PlayerState): Candidate[] {
  const candidates: Candidate[] = [];

  // Gather: domain
  {
    const investCap = 4 * domainTierRank(me.infrastructure.domainTier);
    const max = Math.max(0, investCap);
    for (let investments = 1; investments <= max; investments += 1) {
      const possibleNow = investments <= me.turn.laborAvailable;
      candidates.push({
        id: `action.gather.domain.${investments}`,
        kind: 'action',
        command: { type: 'GatherMaterials', mode: 'domain', investments },
        actionKey: 'material.domain',
        possibleNow,
        summary: `Materialgewinn (Domäne), Investitionen=${investments} (Kosten: ${investments} AK; Cap: ${investCap}).`,
      });
    }
  }

  // Gather: workshop
  {
    const investCap = 2 * workshopTierRank(me.infrastructure.workshopTier);
    const max = Math.max(0, investCap);
    for (let investments = 1; investments <= max; investments += 1) {
      const possibleNow = investments <= me.turn.laborAvailable;
      candidates.push({
        id: `action.gather.workshop.${investments}`,
        kind: 'action',
        command: { type: 'GatherMaterials', mode: 'workshop', investments },
        actionKey: 'material.workshop',
        possibleNow,
        summary: `Materialgewinn (Werkstatt), Investitionen=${investments} (Kosten: ${investments} AK; Cap: ${investCap}).`,
      });
    }
  }

  // Gain influence
  for (let investments = 1; investments <= 4; investments += 1) {
    const possibleNow = investments <= me.economy.gold;
    candidates.push({
      id: `action.influence.${investments}`,
      kind: 'action',
      command: { type: 'GainInfluence', investments },
      actionKey: 'influence',
      possibleNow,
      summary: `Einflussgewinn, Investitionen=${investments} (Kosten: ${investments} Gold).`,
    });
  }

  // Lend money
  for (let investments = 1; investments <= 2; investments += 1) {
    const goldCost = investments * 2;
    const possibleNow = goldCost <= me.economy.gold;
    candidates.push({
      id: `action.lend.${investments}`,
      kind: 'action',
      command: { type: 'LendMoney', investments },
      actionKey: 'money.lend',
      possibleNow,
      summary: `Geldverleih, Investitionen=${investments} (Kosten: ${goldCost} Gold; Auszahlung als pendingGold in der nächsten Runde).`,
    });
  }

  // Sell materials (raw)
  for (let investments = 1; investments <= 3; investments += 1) {
    const rmCost = investments * 6;
    const possibleNow = rmCost <= me.economy.rawMaterials;
    candidates.push({
      id: `action.sell.raw.${investments}`,
      kind: 'action',
      command: { type: 'SellMaterials', resource: 'raw', investments },
      actionKey: 'money.sell',
      possibleNow,
      summary: `Verkauf (Rohmaterial), Investitionen=${investments} (Kosten: ${rmCost} RM).`,
    });
  }

  // Sell materials (special)
  for (let investments = 1; investments <= 3; investments += 1) {
    const smCost = investments;
    const possibleNow = smCost <= me.economy.specialMaterials;
    candidates.push({
      id: `action.sell.special.${investments}`,
      kind: 'action',
      command: { type: 'SellMaterials', resource: 'special', investments },
      actionKey: 'money.sell',
      possibleNow,
      summary: `Verkauf (Sondermaterial), Investitionen=${investments} (Kosten: ${smCost} SM).`,
    });
  }

  // Acquire office
  {
    const possibleGold =
      me.economy.gold >= 8 && me.turn.influenceAvailable >= 2;
    candidates.push({
      id: 'action.office.payGold',
      kind: 'action',
      command: { type: 'AcquireOffice', payment: 'gold' },
      actionKey: 'acquire.office',
      possibleNow: possibleGold,
      summary: 'Amt erlangen (Zahlung: 8 Gold + 2 Einfluss).',
    });
  }
  {
    const possibleInfluence =
      me.economy.gold >= 4 && me.turn.influenceAvailable >= 8;
    candidates.push({
      id: 'action.office.payInfluence',
      kind: 'action',
      command: { type: 'AcquireOffice', payment: 'influence' },
      actionKey: 'acquire.office',
      possibleNow: possibleInfluence,
      summary: 'Amt erlangen (Zahlung: 4 Gold + 8 Einfluss).',
    });
  }

  return candidates;
}

function formatPlayerState(me: PlayerState): string {
  const lines: string[] = [];
  lines.push(`Gold: ${me.economy.gold} (pending: ${me.economy.pendingGold})`);
  lines.push(
    `RM: ${me.economy.rawMaterials}, SM: ${me.economy.specialMaterials}`
  );
  lines.push(
    `AK verfügbar: ${me.turn.laborAvailable}, Einfluss verfügbar: ${me.turn.influenceAvailable}`
  );
  lines.push(
    `Infrastruktur: Domäne=${me.infrastructure.domainTier}, Werkstatt=${me.infrastructure.workshopTier}, Lager=${me.infrastructure.storageTier}`
  );
  lines.push(
    `Turn: actionsUsed=${me.turn.actionsUsed}, actionKeysUsed=[${me.turn.actionKeysUsed.join(', ')}], facilityActionUsed=${me.turn.facilityActionUsed}`
  );
  return lines.join('\n');
}

function ruleCheatSheet(): string {
  return [
    'Kurzregeln (v0):',
    '- Pro Runde: maintenance → actions → conversion → reset.',
    '- In actions: max 2 Aktionen; pro Action-Key nur 1×/Runde.',
    '- GatherMaterials(domain/workshop): kostet AK; gibt RM bzw. SM (Wurf).',
    '- GainInfluence: kostet Gold; erhöht Einfluss diese Runde (Reset am Rundenende).',
    '- LendMoney: kostet 2 Gold je Invest; Auszahlung als pendingGold nächste Runde.',
    '- SellMaterials: RM: 6 RM je Invest, SM: 1 SM je Invest; Wurf bestimmt Gold.',
    '- AcquireOffice: kostet Gold+Einfluss (variiert); bei Erfolg: +1 Amt. Amt gibt jede Runde +2 Gold (maintenance).',
    '- conversion: nicht gelagerte RM werden zu Gold (4 RM → 1 Gold, Rest verfällt), nicht gelagerte SM zu Gold (1 SM → 2 Gold).',
  ].join('\n');
}

export async function planTurnWithLlm(options: {
  model: LanguageModel;
  agentName: string;
  me: PlayerState;
  round: number;
  publicLog: string[];
  systemPreamble?: string;
}): Promise<LlmTurnPlan> {
  const facilityCandidates = buildFacilityCandidates(options.me);
  const actionCandidates = buildActionCandidates(options.me);

  const system = [
    options.systemPreamble?.trim(),
    'Du bist ein Spieler-Agent im Myranor Aufbausystem.',
    'Du darfst nur Candidate-IDs aus der Liste auswählen (keine eigenen Commands erfinden).',
    'Ziel: Maximiere dein Final-Gold nach Ende der Simulation.',
    'Gib eine Facility (oder null) und eine priorisierte Liste von Action-Candidates zurück; der Runner probiert sie der Reihe nach, bis 2 Aktionen ausgeführt wurden.',
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
  promptLines.push(formatPlayerState(options.me));
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
      promptLines.push(`- ${c.id}: ${c.summary}`);
    }
  }
  promptLines.push('');

  promptLines.push('Action-Candidates:');
  for (const c of actionCandidates) {
    const possible = c.possibleNow ? 'now' : 'later?';
    promptLines.push(`- ${c.id} [${possible}]: ${c.summary}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llmEnv.MYRANOR_LLM_TIMEOUT_MS);
  let raw: z.infer<typeof decisionSchema>;
  try {
    const res = await generateText({
      model: options.model,
      output: Output.object({ schema: decisionSchema }),
      system,
      prompt: promptLines.join('\n'),
      temperature: llmEnv.MYRANOR_LLM_TEMPERATURE,
      maxOutputTokens: llmEnv.MYRANOR_LLM_MAX_OUTPUT_TOKENS,
      maxRetries: 2,
      abortSignal: controller.signal,
    });

    raw = res.output as z.infer<typeof decisionSchema>;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new Error(`[LLM] ${options.agentName} R${options.round}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const summarizeIds = (ids: string[], limit = 20): string => {
    const shown = ids.slice(0, limit);
    return ids.length <= limit ? shown.join(', ') : `${shown.join(', ')}, … (+${ids.length - limit})`;
  };

  const facilityId = raw.facilityCandidateId;
  if (facilityId != null && !facilityCandidates.some((c) => c.id === facilityId)) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: unknown facilityCandidateId "${facilityId}". Valid: ${summarizeIds(
        facilityCandidates.map((c) => c.id),
      )}`,
    );
  }

  const actionIds = raw.actionCandidateIds;
  if (actionIds.length === 0) {
    throw new Error(`[LLM] ${options.agentName} R${options.round}: actionCandidateIds is empty.`);
  }

  const uniqueActionIds = new Set(actionIds);
  if (uniqueActionIds.size !== actionIds.length) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: actionCandidateIds contains duplicates (${summarizeIds(
        actionIds,
      )}).`,
    );
  }

  const actionCandidateById = new Map(actionCandidates.map((c) => [c.id, c] as const));
  const unknownActionIds = actionIds.filter((id) => !actionCandidateById.has(id));
  if (unknownActionIds.length > 0) {
    throw new Error(
      `[LLM] ${options.agentName} R${options.round}: unknown actionCandidateIds: ${summarizeIds(
        unknownActionIds,
      )}.`,
    );
  }

  const facility =
    facilityId == null ? null : (facilityCandidates.find((c) => c.id === facilityId)?.command ?? null);

  const actionPriority: AgentCommand[] = actionIds.map((id) => {
    const c = actionCandidateById.get(id);
    if (!c) {
      // Should be unreachable due to validation above.
      throw new Error(`[LLM] ${options.agentName} R${options.round}: missing candidate "${id}".`);
    }
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
