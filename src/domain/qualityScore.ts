/**
 * Quality score from lint counts. 100 is clean; errors cost more than warnings.
 */
export function qualityScore(
  errors: number,
  warnings: number,
  infos: number
): number {
  const raw = 100 - errors * 10 - warnings * 3 - infos;
  return Math.max(0, Math.min(100, raw));
}
