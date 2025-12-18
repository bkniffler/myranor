import type { ActorContext } from '../core';

export function getActorFromRequest(request: Request): ActorContext {
  const userId = request.headers.get('x-user-id')?.trim();
  const roleRaw = request.headers.get('x-user-role')?.trim();

  if (!userId) {
    throw new Error('Missing header: X-User-Id');
  }
  if (roleRaw !== 'gm' && roleRaw !== 'player') {
    throw new Error('Missing/invalid header: X-User-Role (gm|player)');
  }

  return { role: roleRaw, userId };
}

