export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CampaignId = Brand<string, 'CampaignId'>;
export type PlayerId = Brand<string, 'PlayerId'>;
export type UserId = Brand<string, 'UserId'>;
export type EventId = Brand<string, 'EventId'>;

export function asCampaignId(value: string): CampaignId {
  return value as CampaignId;
}

export function asPlayerId(value: string): PlayerId {
  return value as PlayerId;
}

export function asUserId(value: string): UserId {
  return value as UserId;
}

export function asEventId(value: string): EventId {
  return value as EventId;
}

