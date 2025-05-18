/**
 * Generate a unique ID for entities
 * @returns A unique string ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
