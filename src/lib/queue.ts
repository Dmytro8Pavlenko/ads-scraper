import { Redis } from "ioredis";

let redis: Redis | undefined;

export function getRedis(url: string): Redis {
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}

export async function pushIds(redis: Redis, queue: string, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await redis.lpush(queue, ...ids.map(String));
}

export async function takeIds(
  redis: Redis,
  queue: string,
  count: number,
  waitIfEmpty: boolean,
  waitSeconds: number,
): Promise<number[] | null> {
  const first = waitIfEmpty
    ? await brpopId(redis, queue, waitSeconds)
    : await lpopId(redis, queue);
  if (first == null) return null;

  const ids = [first];
  for (let i = 1; i < count; i++) {
    const next = await lpopId(redis, queue);
    if (next == null) break;
    ids.push(next);
  }
  return ids;
}

async function brpopId(redis: Redis, queue: string, waitSeconds: number): Promise<number | null> {
  const res = await redis.brpop(queue, waitSeconds);
  if (!res) return null;
  const n = Number(res[1]);
  return Number.isFinite(n) ? n : null;
}

async function lpopId(redis: Redis, queue: string): Promise<number | null> {
  const raw = await redis.lpop(queue);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
