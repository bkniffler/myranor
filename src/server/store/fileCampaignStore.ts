import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { CampaignState } from '../../core';
import type { CampaignSnapshot, StoredEvent } from './types';
import { ensureDir } from '../util/fs';

export class FileCampaignStore {
  constructor(private readonly rootDir: string) {}

  private campaignDir(campaignId: string): string {
    return join(this.rootDir, campaignId);
  }

  private eventsPath(campaignId: string): string {
    return join(this.campaignDir(campaignId), 'events.jsonl');
  }

  private snapshotPath(campaignId: string): string {
    return join(this.campaignDir(campaignId), 'snapshot.json');
  }

  async readSnapshot(campaignId: string): Promise<CampaignSnapshot<CampaignState> | null> {
    const path = this.snapshotPath(campaignId);
    try {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as CampaignSnapshot<CampaignState>;
    } catch {
      return null;
    }
  }

  async writeSnapshot(
    campaignId: string,
    snapshot: CampaignSnapshot<CampaignState>,
  ): Promise<void> {
    const path = this.snapshotPath(campaignId);
    await ensureDir(dirname(path));
    await writeFile(path, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async readAllEvents(campaignId: string): Promise<StoredEvent[]> {
    const path = this.eventsPath(campaignId);
    try {
      const raw = await readFile(path, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as StoredEvent);
    } catch {
      return [];
    }
  }

  async appendEvents(campaignId: string, events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    const path = this.eventsPath(campaignId);
    await ensureDir(dirname(path));

    const existing = await this.readAllEvents(campaignId);
    const lastSeq = existing.at(-1)?.seq ?? 0;

    const expectedFirstSeq = lastSeq + 1;
    if (events[0].seq !== expectedFirstSeq) {
      throw new Error(
        `Seq mismatch: expected first=${expectedFirstSeq}, got=${events[0].seq}`,
      );
    }

    const content = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
    await appendFile(path, content, 'utf8');
  }
}
