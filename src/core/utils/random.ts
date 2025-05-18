/**
 * Roll a 20-sided die (d20)
 * @returns A random number between 1 and 20
 */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}
