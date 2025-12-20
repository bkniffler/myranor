import type { PlayerState } from '../core';

export function canonicalActionKey(actionKey: string): string {
  const idx = actionKey.indexOf('@');
  return idx === -1 ? actionKey : actionKey.slice(0, idx);
}

export function hasUsedCanonicalAction(
  me: PlayerState,
  canonical: string
): boolean {
  return me.turn.actionKeysUsed.some(
    (k) => canonicalActionKey(k) === canonical
  );
}

export function hasUsedMarker(me: PlayerState, marker: string): boolean {
  const needle = `@${marker}`;
  return me.turn.actionKeysUsed.some((k) => k.includes(needle));
}

export function bonusInfluenceSlots(me: PlayerState): number {
  const largeOffices = me.holdings.offices.filter(
    (o) => o.tier === 'large'
  ).length;
  const hasLargeCult = me.holdings.organizations.some(
    (o) => o.kind === 'cult' && o.tier === 'large' && !o.followers.inUnrest
  );
  return largeOffices + (hasLargeCult ? 1 : 0);
}

export function bonusMoneySlots(me: PlayerState): number {
  const hasLargeTradeCollegium = me.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumTrade' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeTradeCollegium ? 1 : 0;
}

export function bonusMaterialsSlots(me: PlayerState): number {
  const hasLargeCraftCollegium = me.holdings.organizations.some(
    (o) =>
      o.kind === 'collegiumCraft' && o.tier === 'large' && !o.followers.inUnrest
  );
  return hasLargeCraftCollegium ? 1 : 0;
}

export function remainingInfluenceBonusSlots(me: PlayerState): number {
  const slots = bonusInfluenceSlots(me);
  let remaining = 0;
  for (let i = 1; i <= slots; i += 1) {
    const canonical = `influence.bonus.${i}`;
    if (!hasUsedCanonicalAction(me, canonical)) remaining += 1;
  }
  return remaining;
}

export function hasRemainingInfluenceBonus(me: PlayerState): boolean {
  return remainingInfluenceBonusSlots(me) > 0;
}

export function hasAnyActionCapacity(
  me: PlayerState,
  actionsPerRound: number
): boolean {
  if (me.turn.actionsUsed < actionsPerRound) return true;
  if (bonusMoneySlots(me) > 0 && !hasUsedMarker(me, 'bonus.money.1'))
    return true;
  if (bonusMaterialsSlots(me) > 0 && !hasUsedMarker(me, 'bonus.materials.1'))
    return true;
  if (hasRemainingInfluenceBonus(me)) return true;
  return false;
}
