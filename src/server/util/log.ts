export function logInfo(data: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', ...data }));
}

export function logError(data: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', ...data }));
}
