import { loadScheduler } from "./lib/config.js";
import { closeDb, getDb } from "./db/client.js";
import { sleep } from "./lib/duration.js";
import { closeRedis, getRedis, pushIds } from "./lib/queue.js";
import { dueAndroid, dueAppAds, dueIos } from "./lib/claim.js";
import { installShutdown } from "./lib/shutdown.js";

const config = loadScheduler();
const db = getDb(config.databaseUrl);
const redis = getRedis(config.redisUrl);
const { stopping } = installShutdown();

const claim = {
  ios: () =>
    dueIos(db, {
      storeInterval: config.storeInterval.pg,
      queueLease: config.queueLease.pg,
      limit: config.batchSize,
    }),
  android: () =>
    dueAndroid(db, {
      storeInterval: config.storeInterval.pg,
      queueLease: config.queueLease.pg,
      limit: config.batchSize,
    }),
  appads: () =>
    dueAppAds(db, {
      appAdsInterval: config.appAdsInterval.pg,
      queueLease: config.queueLease.pg,
      limit: config.batchSize,
    }),
}[config.contour];

console.log(`scheduler ${config.contour} queue=${config.queue} every ${config.interval.input}`);

while (!stopping()) {
  try {
    const ids = await claim();
    await pushIds(redis, config.queue, ids);
    if (ids.length > 0) console.log(`claimed ${ids.length}`);
  } catch (err) {
    console.error("claim failed", err);
  }
  await sleep(config.interval.ms);
}

await closeRedis();
await closeDb();
