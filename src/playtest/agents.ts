import type { GameCommand, PlayerState } from '../core';

import type { Agent, RoundContext } from './types';

function canUpgradeDomain(me: PlayerState): boolean {
  return (
    me.infrastructure.domainTier === 'starter' &&
    me.economy.gold >= 10 &&
    me.turn.laborAvailable >= 4
  );
}

function canBuildStorage(me: PlayerState): boolean {
  return me.infrastructure.storageTier === 'none' && me.economy.gold >= 8;
}

function maxSellRawInvestments(me: PlayerState): number {
  return Math.min(3, Math.floor(me.economy.rawMaterials / 6));
}

function maxSellSpecialInvestments(me: PlayerState): number {
  return Math.min(3, me.economy.specialMaterials);
}

function canAcquireOfficeGold(me: PlayerState): boolean {
  return me.economy.gold >= 8 && me.turn.influenceAvailable >= 2;
}

function canAcquireOfficeInfluence(me: PlayerState): boolean {
  return me.economy.gold >= 4 && me.turn.influenceAvailable >= 8;
}

function gatherDomainCandidate(me: PlayerState): GameCommand | null {
  const cap = Math.min(4, me.turn.laborAvailable);
  if (cap <= 0) return null;
  return { type: 'GatherMaterials', campaignId: '', mode: 'domain', investments: cap };
}

function gatherWorkshopCandidate(me: PlayerState): GameCommand | null {
  const cap = Math.min(2, me.turn.laborAvailable);
  if (cap <= 0) return null;
  return { type: 'GatherMaterials', campaignId: '', mode: 'workshop', investments: cap };
}

export const builderAgent: Agent = {
  id: 'builder',
  name: 'Baumeister',
  decideFacility(ctx) {
    const me = ctx.me;
    if (!me.turn.facilityActionUsed && canUpgradeDomain(me)) {
      return {
        type: 'BuildFacility',
        campaignId: '',
        facility: 'upgradeStarterDomainToSmall',
      };
    }
    if (!me.turn.facilityActionUsed && canBuildStorage(me)) {
      return { type: 'BuildFacility', campaignId: '', facility: 'buildSmallStorage' };
    }
    return null;
  },
  decideActions(ctx) {
    const me = ctx.me;
    const candidates: GameCommand[] = [];

    if (canAcquireOfficeGold(me)) {
      candidates.push({ type: 'AcquireOffice', campaignId: '', payment: 'gold' });
    } else if (canAcquireOfficeInfluence(me)) {
      candidates.push({ type: 'AcquireOffice', campaignId: '', payment: 'influence' });
    } else if (me.economy.gold >= 1) {
      candidates.push({ type: 'GainInfluence', campaignId: '', investments: Math.min(4, me.economy.gold) });
    }

    const rawSell = maxSellRawInvestments(me);
    if (rawSell > 0) {
      candidates.push({ type: 'SellMaterials', campaignId: '', resource: 'raw', investments: rawSell });
    }

    const gatherDomain = gatherDomainCandidate(me);
    if (gatherDomain) candidates.push(gatherDomain);
    const gatherWorkshop = gatherWorkshopCandidate(me);
    if (gatherWorkshop) candidates.push(gatherWorkshop);

    return candidates;
  },
};

export const merchantAgent: Agent = {
  id: 'merchant',
  name: 'Händler',
  decideFacility(ctx) {
    const me = ctx.me;
    if (!me.turn.facilityActionUsed && canBuildStorage(me)) {
      return { type: 'BuildFacility', campaignId: '', facility: 'buildSmallStorage' };
    }
    return null;
  },
  decideActions(ctx) {
    const me = ctx.me;
    const candidates: GameCommand[] = [];

    const specialSell = maxSellSpecialInvestments(me);
    if (specialSell > 0) {
      candidates.push({
        type: 'SellMaterials',
        campaignId: '',
        resource: 'special',
        investments: specialSell,
      });
    } else {
      const rawSell = maxSellRawInvestments(me);
      if (rawSell > 0) {
        candidates.push({
          type: 'SellMaterials',
          campaignId: '',
          resource: 'raw',
          investments: rawSell,
        });
      }
    }

    if (me.economy.gold >= 2) {
      candidates.push({
        type: 'LendMoney',
        campaignId: '',
        investments: Math.min(2, Math.floor(me.economy.gold / 2)),
      });
    }

    const gatherDomain = gatherDomainCandidate(me);
    if (gatherDomain) candidates.push(gatherDomain);
    const gatherWorkshop = gatherWorkshopCandidate(me);
    if (gatherWorkshop) candidates.push(gatherWorkshop);

    return candidates;
  },
};

export const courtierAgent: Agent = {
  id: 'courtier',
  name: 'Höfling',
  decideFacility() {
    return null;
  },
  decideActions(ctx) {
    const me = ctx.me;
    const candidates: GameCommand[] = [];

    if (canAcquireOfficeGold(me)) candidates.push({ type: 'AcquireOffice', campaignId: '', payment: 'gold' });
    else if (canAcquireOfficeInfluence(me)) {
      candidates.push({ type: 'AcquireOffice', campaignId: '', payment: 'influence' });
    }

    if (me.economy.gold >= 2) {
      candidates.push({ type: 'GainInfluence', campaignId: '', investments: Math.min(4, me.economy.gold) });
    }

    const gatherDomain = gatherDomainCandidate(me);
    if (gatherDomain) candidates.push(gatherDomain);
    const gatherWorkshop = gatherWorkshopCandidate(me);
    if (gatherWorkshop) candidates.push(gatherWorkshop);

    return candidates;
  },
};

export const randomAgent: Agent = {
  id: 'random',
  name: 'Zufall',
  decideFacility(ctx) {
    const me = ctx.me;
    if (!me.turn.facilityActionUsed && canUpgradeDomain(me)) {
      return {
        type: 'BuildFacility',
        campaignId: '',
        facility: 'upgradeStarterDomainToSmall',
      };
    }
    return null;
  },
  decideActions(ctx) {
    const me = ctx.me;
    const candidates: GameCommand[] = [];
    if (me.economy.gold >= 2) candidates.push({ type: 'LendMoney', campaignId: '', investments: 1 });
    if (me.economy.gold >= 1) candidates.push({ type: 'GainInfluence', campaignId: '', investments: 1 });
    if (maxSellSpecialInvestments(me) > 0) {
      candidates.push({ type: 'SellMaterials', campaignId: '', resource: 'special', investments: 1 });
    } else if (maxSellRawInvestments(me) > 0) {
      candidates.push({ type: 'SellMaterials', campaignId: '', resource: 'raw', investments: 1 });
    }
    const gatherDomain = gatherDomainCandidate(me);
    if (gatherDomain) candidates.push(gatherDomain);
    const gatherWorkshop = gatherWorkshopCandidate(me);
    if (gatherWorkshop) candidates.push(gatherWorkshop);

    return candidates;
  },
};

export const speculatorAgent: Agent = {
  id: 'speculator',
  name: 'Spekulant',
  decideFacility(ctx) {
    const me = ctx.me;
    if (!me.turn.facilityActionUsed && canBuildStorage(me)) {
      return { type: 'BuildFacility', campaignId: '', facility: 'buildSmallStorage' };
    }
    if (!me.turn.facilityActionUsed && canUpgradeDomain(me)) {
      return { type: 'BuildFacility', campaignId: '', facility: 'upgradeStarterDomainToSmall' };
    }
    return null;
  },
  decideActions(ctx) {
    const me = ctx.me;
    const candidates: GameCommand[] = [];

    const rawMarket = ctx.state.market.raw.modifiers.basic;
    const specialMarket = ctx.state.market.special.modifiers.basic;
    const hasStorage = me.infrastructure.storageTier !== 'none';

    const rawSell = maxSellRawInvestments(me);
    const specialSell = maxSellSpecialInvestments(me);

    const rawThreshold = hasStorage ? 1 : -1;
    const specialThreshold = hasStorage ? 1 : 0;

    const canSellSpecial = specialSell > 0 && specialMarket >= specialThreshold;
    const canSellRaw = rawSell > 0 && rawMarket >= rawThreshold;

    if (canSellSpecial || canSellRaw) {
      const preferSpecial = canSellSpecial && (!canSellRaw || specialMarket >= rawMarket);
      candidates.push({
        type: 'SellMaterials',
        campaignId: '',
        resource: preferSpecial ? 'special' : 'raw',
        investments: preferSpecial ? specialSell : rawSell,
      });
    } else if (me.economy.gold >= 2) {
      candidates.push({
        type: 'LendMoney',
        campaignId: '',
        investments: Math.min(2, Math.floor(me.economy.gold / 2)),
      });
    }

    const preferWorkshop = specialMarket > rawMarket;
    const gatherPrimary = preferWorkshop ? gatherWorkshopCandidate(me) : gatherDomainCandidate(me);
    if (gatherPrimary) candidates.push(gatherPrimary);

    const gatherSecondary = preferWorkshop ? gatherDomainCandidate(me) : gatherWorkshopCandidate(me);
    if (gatherSecondary) candidates.push(gatherSecondary);

    if (me.economy.gold >= 1) {
      candidates.push({ type: 'GainInfluence', campaignId: '', investments: 1 });
    }

    return candidates;
  },
};
