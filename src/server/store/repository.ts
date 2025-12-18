import type { CampaignState, GameEvent } from '../../core';
import { reduceEvents } from '../../core';

import type { StoredEvent } from './types';
import { FileCampaignStore } from './fileCampaignStore';

export type CampaignLoaded = {
  seq: number;
  state: CampaignState | null;
  events: StoredEvent[];
};

export class CampaignRepository {
  constructor(private readonly store: FileCampaignStore) {}

  async load(campaignId: string): Promise<CampaignLoaded> {
    const snapshot = await this.store.readSnapshot(campaignId);
    const allEvents = await this.store.readAllEvents(campaignId);

    const snapshotSeq = snapshot?.seq ?? 0;
    const remainingEvents = allEvents.filter((e) => e.seq > snapshotSeq);
    const domainEvents = remainingEvents.map((e) => e.event);

    const state = reduceEvents(snapshot?.state ?? null, domainEvents);
    const seq = allEvents.at(-1)?.seq ?? snapshotSeq;

    return { seq, state, events: allEvents };
  }

  async append(
    campaignId: string,
    expectedSeq: number,
    newEvents: StoredEvent[],
  ): Promise<CampaignLoaded> {
    const current = await this.load(campaignId);
    if (current.seq !== expectedSeq) {
      throw new Error(`Expected seq ${expectedSeq}, got ${current.seq}`);
    }

    await this.store.appendEvents(campaignId, newEvents);
    const updated = await this.load(campaignId);

    const snapshot: { seq: number; state: CampaignState } | null =
      updated.state ? { seq: updated.seq, state: updated.state } : null;
    if (snapshot) {
      await this.store.writeSnapshot(campaignId, snapshot);
    }

    return updated;
  }

  static createFromDir(rootDir: string): CampaignRepository {
    return new CampaignRepository(new FileCampaignStore(rootDir));
  }
}

