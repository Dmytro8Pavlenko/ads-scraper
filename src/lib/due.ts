export type CadenceRow = {
  availableAt: Date | null;
  lastSuccessfullyFetched: Date | null;
};

/** Retry backoff still running — drop this queue item. */
export function isDue(row: CadenceRow, intervalMs: number, now = Date.now()): boolean {
  if (row.availableAt && row.availableAt.getTime() > now) return false;
  if (row.availableAt) return true;
  if (!row.lastSuccessfullyFetched) return true;
  return now >= row.lastSuccessfullyFetched.getTime() + intervalMs;
}
