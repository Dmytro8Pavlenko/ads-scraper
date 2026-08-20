import { inArray, sql } from "drizzle-orm";
import { loadStoreWorker } from "../lib/config.js";
import { closeDb, getDb, type Db } from "../db/client.js";
import { appChangeEvents, apps } from "../db/schema.js";
import { hostFromUrl } from "../lib/domain.js";
import { isDue } from "../lib/due.js";
import { timeoutSec } from "../lib/duration.js";
import { backoffPg } from "../lib/outcome.js";
import { runSlots } from "../lib/pool.js";
import { fetchedAtUnchanged } from "../lib/seen.js";
import { closeRedis, getRedis, takeIds } from "../lib/queue.js";
import { installShutdown } from "../lib/shutdown.js";
import { appleAdapter } from "../stores/apple.js";
import { playAdapter } from "../stores/play.js";
import type { StoreFail, StoreOk, StoreResult } from "../stores/types.js";

const config = loadStoreWorker();
const db = getDb(config.databaseUrl);
const redis = getRedis(config.redisUrl);
const adapter = config.store === "ios" ? appleAdapter(config) : playAdapter(config);

type AppRow = typeof apps.$inferSelect;
type ChangeEvent = { type: string; payload: Record<string, unknown> };

async function processBatch(ids: number[]): Promise<void> {
  console.log(`got ${ids.length} id(s)`);
  const rows = await db.select().from(apps).where(inArray(apps.id, ids));
  const due = rows.filter((app) => app.store === config.store && isDue(app, config.storeInterval.ms));
  const skipped = ids.length - due.length;
  if (skipped > 0) console.log(`skip ${skipped} not due`);
  if (due.length === 0) return;

  console.log(`fetch ${due.length} (${due.map((app) => app.bundleId).join(", ")})`);
  const results = await adapter.fetch(due.map((app) => app.bundleId));
  const byBundle = new Map(results.map((row) => [row.bundleId, row]));

  for (const app of due) {
    const result = byBundle.get(app.bundleId);
    if (!result) {
      console.log(`miss ${app.bundleId}`);
      continue;
    }
    try {
      await saveResult(app, result);
      if (result.ok) {
        console.log(
          `ok ${app.bundleId} ${result.status} ${result.developerUrl ?? "no-url"} ${result.title ?? ""}`.trim(),
        );
      } else {
        console.log(`retry ${app.bundleId} ${result.httpStatus ?? "-"} ${result.error}`);
      }
    } catch (err) {
      console.error(`app ${app.id} persist failed`, err);
    }
  }
}

async function saveResult(app: AppRow, result: StoreResult): Promise<void> {
  if (result.ok) await saveSuccess(app, result);
  else await saveRetry(app, result);
}

async function saveRetry(app: AppRow, result: StoreFail): Promise<void> {
  await db.execute(sql`
    UPDATE apps SET
      retry_count = retry_count + 1,
      available_at = now() + ${backoffPg(app.retryCount)}::interval,
      last_http_status = ${result.httpStatus},
      last_error = ${result.error},
      updated_at = now()
    WHERE id = ${app.id}
  `);
}

async function saveSuccess(app: AppRow, result: StoreOk): Promise<void> {
  await db.transaction(async (tx) => {
    const publisherId = (await upsertPublisher(tx, result)) ?? app.publisherId;
    const domainId = (await upsertDomain(tx, result)) ?? app.domainId;
    const events = listingChanges(app, result, publisherId, domainId);

    const updated = await tx.execute<{ id: string }>(sql`
      UPDATE apps SET
        publisher_id = ${publisherId},
        domain_id = ${domainId},
        title = ${result.title ?? app.title},
        developer_url = ${result.developerUrl},
        status = ${result.status},
        last_http_status = ${result.httpStatus},
        last_error = NULL,
        last_successfully_fetched = now(),
        available_at = NULL,
        retry_count = 0,
        updated_at = now()
      WHERE id = ${app.id}
        AND ${fetchedAtUnchanged(app.lastSuccessfullyFetched)}
      RETURNING id
    `);

    if (updated.rows.length === 0) {
      console.log(`stale ${app.bundleId}`);
      return;
    }

    for (const event of events) {
      await tx.insert(appChangeEvents).values({
        appId: app.id,
        eventType: event.type,
        payload: event.payload,
      });
    }
  });
}

type Queryable = { execute: Db["execute"] };

async function upsertPublisher(tx: Queryable, result: StoreOk): Promise<number | null> {
  if (result.status !== "active" || !result.storeDeveloperId) return null;
  const inserted = await tx.execute<{ id: string }>(sql`
    INSERT INTO publishers (store, store_developer_id, name, updated_at)
    VALUES (${config.store}, ${result.storeDeveloperId}, ${result.publisherName}, now())
    ON CONFLICT (store, store_developer_id)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, publishers.name),
      updated_at = now()
    RETURNING id
  `);
  return Number(inserted.rows[0].id);
}

async function upsertDomain(tx: Queryable, result: StoreOk): Promise<number | null> {
  const host = result.developerUrl ? hostFromUrl(result.developerUrl) : null;
  if (result.status !== "active" || !host) return null;
  const inserted = await tx.execute<{ id: string }>(sql`
    INSERT INTO domains (host)
    VALUES (${host})
    ON CONFLICT (host) DO UPDATE SET host = domains.host
    RETURNING id
  `);
  return Number(inserted.rows[0].id);
}

function listingChanges(
  app: AppRow,
  result: StoreOk,
  publisherId: number | null,
  domainId: number | null,
): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  const gone = result.status === "not_found" || result.status === "removed";

  if (app.status === "active" && gone) {
    events.push({ type: "removed", payload: { old: app.status, new: result.status } });
  } else if ((app.status === "removed" || app.status === "not_found") && result.status === "active") {
    events.push({ type: "reappeared", payload: { old: app.status, new: result.status } });
  }

  if (app.publisherId != null && publisherId !== app.publisherId) {
    events.push({ type: "publisher_changed", payload: { old: app.publisherId, new: publisherId } });
  }
  if (result.title && app.title && result.title !== app.title) {
    events.push({ type: "renamed", payload: { old: app.title, new: result.title } });
  }
  if (app.developerUrl != null && (result.developerUrl ?? null) !== app.developerUrl) {
    events.push({ type: "url_changed", payload: { old: app.developerUrl, new: result.developerUrl } });
  }
  if (app.domainId != null && domainId !== app.domainId) {
    events.push({ type: "domain_changed", payload: { old: app.domainId, new: domainId } });
  }

  return events;
}

const { stopping } = installShutdown();
const idConcurrency = config.concurrency * config.idsPerSlot;
console.log(
  `store worker ${config.store} queue=${config.queue} slots=${config.concurrency} idsPerSlot=${config.idsPerSlot} ids=${idConcurrency} (env ${config.wantedIdConcurrency})`,
);

await runSlots({
  concurrency: config.concurrency,
  stopping,
  take: async (waitIfEmpty) => {
    const ids = await takeIds(
      redis,
      config.queue,
      config.idsPerSlot,
      waitIfEmpty,
      timeoutSec(config.brpopTimeout),
    );
    if (!ids && waitIfEmpty) console.log("queue empty, waiting");
    return ids;
  },
  run: processBatch,
});
await closeRedis();
await closeDb();
