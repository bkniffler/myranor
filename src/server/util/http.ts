export function json(
  data: unknown,
  init?: ResponseInit & { status?: number }
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}

export function errorJson(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return json(
    { error: { message, ...extra } },
    {
      status,
    }
  );
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
