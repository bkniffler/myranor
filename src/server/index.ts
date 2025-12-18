import { z } from 'zod';

import {
  asUserId,
  decide,
  type GameCommand,
  GameRuleError,
  cryptoRng,
} from '../core';
import type { CampaignState } from '../core';

import { getActorFromRequest } from './auth';
import { env } from './env';
import { CampaignRepository } from './store/repository';
import type { StoredEvent } from './store/types';
import { errorJson, json, readJsonBody } from './util/http';
import { logError, logInfo } from './util/log';

const repository = CampaignRepository.createFromDir(env.MYRANOR_STORE_DIR);

const createCampaignBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const joinCampaignBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

const playerCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('GatherMaterials'),
    mode: z.enum(['domain', 'workshop']),
    investments: z.number().int().positive().max(1_000),
  }),
  z.object({
    type: z.literal('AddPrivateNote'),
    note: z.string(),
  }),
]);

function newId(): string {
  return crypto.randomUUID();
}

function toStoredEvents(
  domainEvents: ReturnType<typeof decide>,
  actor: { userId: string; role: 'gm' | 'player' },
  startingSeq: number,
): StoredEvent[] {
  return domainEvents.map((event, index) => ({
    id: newId(),
    seq: startingSeq + index + 1,
    ts: new Date().toISOString(),
    actor,
    event,
  }));
}

function publicStateView(state: CampaignState) {
  return {
    id: state.id,
    name: state.name,
    round: state.round,
    phase: state.phase,
    players: Object.values(state.players).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    })),
  };
}

function privateStateView(
  state: CampaignState,
  actor: { role: 'gm' | 'player'; userId: string },
) {
  if (actor.role === 'gm') {
    return state;
  }

  const playerId = state.playerIdByUserId[asUserId(actor.userId)];
  const player = playerId ? state.players[playerId] : null;

  return {
    campaign: publicStateView(state),
    me: player,
  };
}

function filterEventsForPublic(events: StoredEvent[], fromSeq: number): StoredEvent[] {
  return events
    .filter((e) => e.seq >= fromSeq)
    .filter((e) => e.event.visibility.scope === 'public');
}

function filterEventsForActor(
  events: StoredEvent[],
  actor: { role: 'gm' | 'player'; userId: string },
  state: CampaignState | null,
  fromSeq: number,
): StoredEvent[] {
  if (actor.role === 'gm') {
    return events.filter((e) => e.seq >= fromSeq);
  }

  const playerId = state?.playerIdByUserId[asUserId(actor.userId)];
  return events
    .filter((e) => e.seq >= fromSeq)
    .filter((e) => {
      if (e.event.visibility.scope === 'public') return true;
      return e.event.visibility.playerId === playerId;
    });
}

function parseFromSeq(url: URL): number {
  const value = url.searchParams.get('from');
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

Bun.serve({
  port: env.MYRANOR_PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const requestId = newId();
    const startedAt = Date.now();

    try {
      const actor = getActorFromRequest(request);
      const rng = cryptoRng();

      if (request.method === 'POST' && path === '/api/campaigns') {
        if (actor.role !== 'gm') return errorJson(403, 'GM erforderlich.');

        const body = createCampaignBodySchema.parse(await readJsonBody(request));
        const campaignId = newId();

        const loaded = await repository.load(campaignId);
        const command: GameCommand = {
          type: 'CreateCampaign',
          campaignId,
          name: body.name,
        };

        const domainEvents = decide(loaded.state, command, { actor, rng });
        const stored = toStoredEvents(domainEvents, actor, loaded.seq);
        const updated = await repository.append(campaignId, loaded.seq, stored);

        logInfo({
          requestId,
          method: request.method,
          path,
          userId: actor.userId,
          role: actor.role,
          status: 200,
          durationMs: Date.now() - startedAt,
        });

        return json({
          campaignId,
          state: publicStateView(updated.state!),
        });
      }

      const matchCampaign = /^\/api\/campaigns\/([^/]+)(\/.*)?$/.exec(path);
      if (!matchCampaign) return errorJson(404, 'Not found');

      const campaignId = matchCampaign[1];
      const tail = matchCampaign[2] ?? '';

      if (request.method === 'POST' && tail === '/join') {
        const body = joinCampaignBodySchema.parse(await readJsonBody(request));
        const playerId = newId();

        const loaded = await repository.load(campaignId);
        if (!loaded.state) return errorJson(404, 'Kampagne nicht gefunden.');

        const command: GameCommand = {
          type: 'JoinCampaign',
          campaignId,
          playerId,
          displayName: body.displayName,
        };

        const domainEvents = decide(loaded.state, command, { actor, rng });
        const stored = toStoredEvents(domainEvents, actor, loaded.seq);
        const updated = await repository.append(campaignId, loaded.seq, stored);

        return json({
          campaignId,
          playerId,
          state: publicStateView(updated.state!),
        });
      }

      if (request.method === 'POST' && tail === '/advance') {
        if (actor.role !== 'gm') return errorJson(403, 'GM erforderlich.');

        const loaded = await repository.load(campaignId);
        if (!loaded.state) return errorJson(404, 'Kampagne nicht gefunden.');

        const command: GameCommand = { type: 'AdvancePhase', campaignId };
        const domainEvents = decide(loaded.state, command, { actor, rng });
        const stored = toStoredEvents(domainEvents, actor, loaded.seq);
        const updated = await repository.append(campaignId, loaded.seq, stored);

        return json({
          campaignId,
          round: updated.state!.round,
          phase: updated.state!.phase,
        });
      }

      if (request.method === 'POST' && tail === '/commands') {
        const loaded = await repository.load(campaignId);
        if (!loaded.state) return errorJson(404, 'Kampagne nicht gefunden.');

        const body = playerCommandSchema.parse(await readJsonBody(request));
        const command: GameCommand = { ...body, campaignId } as GameCommand;

        const domainEvents = decide(loaded.state, command, { actor, rng });
        const stored = toStoredEvents(domainEvents, actor, loaded.seq);
        const updated = await repository.append(campaignId, loaded.seq, stored);

        return json({
          campaignId,
          state: privateStateView(updated.state!, actor),
        });
      }

      if (request.method === 'GET' && tail === '/state/public') {
        const loaded = await repository.load(campaignId);
        if (!loaded.state) return errorJson(404, 'Kampagne nicht gefunden.');
        return json(publicStateView(loaded.state));
      }

      if (request.method === 'GET' && tail === '/state/private') {
        const loaded = await repository.load(campaignId);
        if (!loaded.state) return errorJson(404, 'Kampagne nicht gefunden.');
        return json(privateStateView(loaded.state, actor));
      }

      if (request.method === 'GET' && tail === '/events/public') {
        const loaded = await repository.load(campaignId);
        const fromSeq = parseFromSeq(url);
        return json(filterEventsForPublic(loaded.events, fromSeq));
      }

      if (request.method === 'GET' && tail === '/events/private') {
        const loaded = await repository.load(campaignId);
        const fromSeq = parseFromSeq(url);
        return json(filterEventsForActor(loaded.events, actor, loaded.state, fromSeq));
      }

      return errorJson(404, 'Not found');
    } catch (error) {
      const status =
        error instanceof GameRuleError ? 400 : error instanceof z.ZodError ? 400 : 500;
      const message =
        error instanceof GameRuleError
          ? error.message
          : error instanceof z.ZodError
            ? 'Ungültige Eingabe.'
            : error instanceof Error
              ? error.message
              : 'Unbekannter Fehler';

      logError({
        requestId,
        method: request.method,
        path,
        status,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
        durationMs: Date.now() - startedAt,
      });

      return errorJson(status, message, error instanceof GameRuleError ? { code: error.code } : undefined);
    }
  },
});

logInfo({ message: `API listening on :${env.MYRANOR_PORT}` });
