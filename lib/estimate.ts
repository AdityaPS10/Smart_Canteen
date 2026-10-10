// Shown to students as "Estimated ready in X to Y min" (about 0.85x to 1.2x of the prediction, rounded).
export function estimateRange(minutes: number): { low: number; high: number } {
  const low = Math.max(1, Math.round(minutes * 0.85));
  const high = Math.max(low + 1, Math.round(minutes * 1.2));
  return { low, high };
}
