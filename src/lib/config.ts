import "dotenv/config";
import { parseDuration, type Duration } from "./duration.js";

export type Contour = "ios" | "android" | "appads";
export type Store = "ios" | "android";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`missing env ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return undefined;
  return v;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`bad int env ${name}: ${raw}`);
  return n;
}

export function parseContour(raw: string): Contour {
  if (raw === "ios" || raw === "android" || raw === "appads") return raw;
  throw new Error(`CONTOUR must be ios|android|appads, got ${raw}`);
}

export function parseStore(raw: string): Store {
  if (raw === "ios" || raw === "android") return raw;
  throw new Error(`store contour must be ios|android, got ${raw}`);
}

export function defaultQueue(contour: Contour): string {
  const override = optional("REDIS_QUEUE");
  if (override) return override;
  if (contour === "appads") return "queue:appads";
  return `queue:store:${contour}`;
}

function proxyList(): string[] {
  const raw = optional("PROXY_URL");
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type BaseConfig = {
  databaseUrl: string;
  redisUrl: string;
  userAgent: string;
  httpTimeout: Duration;
  proxies: string[];
};

export function loadBase(): BaseConfig {
  return {
    databaseUrl: env("DATABASE_URL", "postgres://ads:ads@localhost:5432/ads"),
    redisUrl: env("REDIS_URL", "redis://localhost:6379"),
    userAgent: env("USER_AGENT", "ads-scraper/0.1 (+https://localhost)"),
    httpTimeout: parseDuration(env("HTTP_TIMEOUT", "20s")),
    proxies: proxyList(),
  };
}

export type SchedulerConfig = BaseConfig & {
  contour: Contour;
  queue: string;
  batchSize: number;
  interval: Duration;
  queueLease: Duration;
  storeInterval: Duration;
  appAdsInterval: Duration;
};

export function loadScheduler(): SchedulerConfig {
  const base = loadBase();
  const contour = parseContour(env("CONTOUR"));
  return {
    ...base,
    contour,
    queue: defaultQueue(contour),
    batchSize: intEnv("SCHEDULER_BATCH_SIZE", 200),
    interval: parseDuration(env("SCHEDULER_INTERVAL", "60s")),
    queueLease: parseDuration(env("QUEUE_LEASE", "10m")),
    storeInterval: parseDuration(env("STORE_INTERVAL", "7d")),
    appAdsInterval: parseDuration(env("APP_ADS_INTERVAL", "24h")),
  };
}

export function roundUpToMultiple(n: number, size: number): number {
  if (size <= 1) return n;
  return Math.ceil(n / size) * size;
}

export type StoreWorkerConfig = BaseConfig & {
  store: Store;
  queue: string;
  /** Parallel slots. iOS: one slot = one Lookup batch. */
  concurrency: number;
  /** Ids taken per slot. iOS = LOOKUP_BATCH_SIZE, Play = 1. */
  idsPerSlot: number;
  /** Wanted concurrent ids before rounding (env as written). */
  wantedIdConcurrency: number;
  lookupBatchSize: number;
  storeCountry: string;
  storeInterval: Duration;
  brpopTimeout: Duration;
};

export function loadStoreWorker(): StoreWorkerConfig {
  const base = loadBase();
  const store = parseStore(env("CONTOUR"));
  const lookupBatchSize = intEnv("LOOKUP_BATCH_SIZE", store === "ios" ? 50 : 1);
  const wantedIdConcurrency = intEnv("WORKER_CONCURRENCY", store === "ios" ? 50 : 4);
  const idsPerSlot = store === "ios" ? lookupBatchSize : 1;
  const idConcurrency =
    store === "ios" ? roundUpToMultiple(wantedIdConcurrency, idsPerSlot) : wantedIdConcurrency;
  return {
    ...base,
    store,
    queue: defaultQueue(store),
    concurrency: idConcurrency / idsPerSlot,
    idsPerSlot,
    wantedIdConcurrency,
    lookupBatchSize,
    storeCountry: env("STORE_COUNTRY", "us"),
    storeInterval: parseDuration(env("STORE_INTERVAL", "7d")),
    brpopTimeout: parseDuration(env("BRPOP_TIMEOUT", "15s")),
  };
}

export type AppAdsWorkerConfig = BaseConfig & {
  queue: string;
  concurrency: number;
  appAdsInterval: Duration;
  brpopTimeout: Duration;
};

export function loadAppAdsWorker(): AppAdsWorkerConfig {
  const base = loadBase();
  return {
    ...base,
    queue: defaultQueue("appads"),
    concurrency: intEnv("WORKER_CONCURRENCY", 8),
    appAdsInterval: parseDuration(env("APP_ADS_INTERVAL", "24h")),
    brpopTimeout: parseDuration(env("BRPOP_TIMEOUT", "15s")),
  };
}
