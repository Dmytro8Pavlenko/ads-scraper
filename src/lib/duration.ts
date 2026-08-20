export type Duration = {
  input: string;
  ms: number;
  pg: string;
};

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const UNIT_PG: Record<string, string> = {
  ms: "milliseconds",
  s: "seconds",
  m: "minutes",
  h: "hours",
  d: "days",
};

export function parseDuration(input: string): Duration {
  const m = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(input.trim());
  if (!m) {
    throw new Error(`bad duration: ${input} (use 60s, 10m, 24h, 7d)`);
  }
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return { input, ms: n * UNIT_MS[unit], pg: `${n} ${UNIT_PG[unit]}` };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function timeoutSec(d: Duration): number {
  return Math.max(1, Math.ceil(d.ms / 1000));
}
