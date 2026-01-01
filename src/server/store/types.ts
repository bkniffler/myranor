import type { GameEvent } from '../../core';

export type StoredEvent = {
  id: string;
  seq: number;
  ts: string;
  actor: {
    userId: string;
    role: 'gm' | 'player';
  };
  event: GameEvent;
};

export type CampaignSnapshot<TState> = {
  seq: number;
  state: TState;
};
