/** min(60m, 1m × 2^retryCount) using the count before increment. */
export function backoffMs(retryCount: number): number {
  const minutes = Math.min(60, 1 * 2 ** Math.max(0, retryCount));
  return minutes * 60 * 1000;
}

export function backoffPg(retryCount: number): string {
  const minutes = Math.min(60, 1 * 2 ** Math.max(0, retryCount));
  return `${minutes} minutes`;
}
