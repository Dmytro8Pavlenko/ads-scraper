import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { loadAppAdsWorker } from "../lib/config.js";
import { closeDb, getDb } from "../db/client.js";
import { domains } from "../db/schema.js";
import { fallbackHosts } from "../lib/domain.js";
import { isDue } from "../lib/due.js";
import { timeoutSec } from "../lib/duration.js";
import { classifyAppAdsBody, looksLikeAppAds } from "../lib/appads.js";
import { httpGet, isRetryableHttp, pickProxy, type HttpGetResult } from "../lib/http.js";
import { backoffPg } from "../lib/outcome.js";
import { runSlots } from "../lib/pool.js";
import { fetchedAtUnchanged } from "../lib/seen.js";
import { closeRedis, getRedis, takeIds } from "../lib/queue.js";
import { installShutdown } from "../lib/shutdown.js";

const config = loadAppAdsWorker();
const db = getDb(config.databaseUrl);
const redis = getRedis(config.redisUrl);

type DomainRow = typeof domains.$inferSelect;

function sha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

async function processOne(id: number): Promise<void> {
  console.log(`got ${id}`);
  const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  if (!row || !isDue(row, config.appAdsInterval.ms)) {
    console.log(`skip ${id} not due`);
    return;
  }

  const hosts = fallbackHosts(row.host);
  let lastStatus: number | null = null;
  let lastError = "no response";
  let sawMissing = false;

  for (const host of hosts) {
    console.log(`fetch ${row.host} https://${host}/app-ads.txt`);
    let res: HttpGetResult;
    try {
      res = await fetchTxt(host, row);
    } catch (err) {
      lastStatus = 0;
      lastError = err instanceof Error ? err.message : "network";
      console.log(`retry ${row.host} ${host} ${lastError}`);
      continue;
    }

    lastStatus = res.status;

    if (res.status === 304) {
      if (row.body && looksLikeAppAds(row.body)) {
        await markChecked(row, 304);
        console.log(`ok ${row.host} 304`);
      } else {
        await markNotFile(row, 304);
        console.log(`ok ${row.host} 304 not-file`);
      }
      return;
    }
    if (res.status === 404) {
      sawMissing = true;
      continue;
    }
    if (isRetryableHttp(res.status) || res.status >= 400) {
      await markRetry(row, res.status, `http ${res.status}`);
      console.log(`retry ${row.host} ${res.status}`);
      return;
    }

    const kind = classifyAppAdsBody(res.body, res.headers.get("content-type"), res.finalUrl);
    if (kind === "captcha") {
      await markRetry(row, res.status, "captcha");
      console.log(`retry ${row.host} captcha`);
      return;
    }
    if (kind === "not_file") {
      sawMissing = true;
      continue;
    }

    const changed = sha256(res.body) !== row.contentHash;
    await saveFile(row, res);
    console.log(`ok ${row.host} ${res.status} ${changed ? "changed" : "same"} ${res.body.length}b`);
    return;
  }

  if (sawMissing) {
    if (row.body && looksLikeAppAds(row.body)) {
      await markChecked(row, lastStatus ?? 404);
      console.log(`ok ${row.host} ${lastStatus ?? 404} kept`);
    } else if ((lastStatus ?? 404) === 404 && !row.body) {
      await markChecked(row, 404);
      console.log(`ok ${row.host} 404`);
    } else {
      await markNotFile(row, lastStatus ?? 404);
      console.log(`ok ${row.host} ${lastStatus ?? 404} not-file`);
    }
  } else {
    await markRetry(row, lastStatus, lastError);
    console.log(`retry ${row.host} ${lastStatus ?? "-"} ${lastError}`);
  }
}

async function fetchTxt(host: string, row: DomainRow) {
  const headers: Record<string, string> = {};
  if (row.etag) headers["if-none-match"] = row.etag;
  if (row.lastModified) headers["if-modified-since"] = row.lastModified;
  return httpGet(`https://${host}/app-ads.txt`, {
    timeoutMs: config.httpTimeout.ms,
    userAgent: config.userAgent,
    proxyUrl: pickProxy(config.proxies),
    headers,
  });
}

async function markRetry(row: DomainRow, status: number | null, error: string): Promise<void> {
  await db.execute(sql`
    UPDATE domains SET
      retry_count = retry_count + 1,
      available_at = now() + ${backoffPg(row.retryCount)}::interval,
      last_http_status = ${status},
      last_error = ${error}
    WHERE id = ${row.id}
  `);
}

/** 304 / 404: the check itself succeeded, previously stored file is left as-is. */
async function markChecked(row: DomainRow, status: number): Promise<void> {
  await db.execute(sql`
    UPDATE domains SET
      last_http_status = ${status},
      last_error = NULL,
      last_successfully_fetched = now(),
      available_at = NULL,
      retry_count = 0
    WHERE id = ${row.id}
      AND ${fetchedAtUnchanged(row.lastSuccessfullyFetched)}
  `);
}

/** Homepage / empty / junk 200: not a file. Wipe HTML so it is not stored as app-ads.txt. */
async function markNotFile(row: DomainRow, status: number): Promise<void> {
  await db.execute(sql`
    UPDATE domains SET
      body = NULL,
      content_hash = NULL,
      etag = NULL,
      last_modified = NULL,
      last_http_status = ${status},
      last_error = 'not app-ads.txt',
      last_successfully_fetched = now(),
      available_at = NULL,
      retry_count = 0,
      last_changed_at = CASE WHEN body IS NOT NULL THEN now() ELSE last_changed_at END
    WHERE id = ${row.id}
      AND ${fetchedAtUnchanged(row.lastSuccessfullyFetched)}
  `);
}

async function saveFile(row: DomainRow, res: HttpGetResult): Promise<void> {
  const hash = sha256(res.body);
  const changed = hash !== row.contentHash;

  await db.transaction(async (tx) => {
    if (changed && row.body != null && row.contentHash && looksLikeAppAds(row.body)) {
      await tx.execute(sql`
        INSERT INTO app_ads_revisions (domain_id, content_hash, body, fetched_at)
        VALUES (${row.id}, ${row.contentHash}, ${row.body}, now())
        ON CONFLICT (domain_id, content_hash) DO NOTHING
      `);
    }

    await tx.execute(sql`
      UPDATE domains SET
        body = ${res.body},
        content_hash = ${hash},
        etag = ${res.headers.get("etag")},
        last_modified = ${res.headers.get("last-modified")},
        last_http_status = ${res.status},
        last_error = NULL,
        last_successfully_fetched = now(),
        available_at = NULL,
        retry_count = 0,
        last_changed_at = CASE WHEN ${changed} THEN now() ELSE last_changed_at END
      WHERE id = ${row.id}
        AND ${fetchedAtUnchanged(row.lastSuccessfullyFetched)}
    `);
  });
}

const { stopping } = installShutdown();
console.log(`appads worker queue=${config.queue} concurrency=${config.concurrency}`);

await runSlots({
  concurrency: config.concurrency,
  stopping,
  take: async (waitIfEmpty) => {
    const ids = await takeIds(redis, config.queue, 1, waitIfEmpty, timeoutSec(config.brpopTimeout));
    if (!ids && waitIfEmpty) console.log("queue empty, waiting");
    return ids;
  },
  run: async ([id]) => {
    try {
      await processOne(id);
    } catch (err) {
      console.error(`domain ${id} failed`, err);
    }
  },
});
await closeRedis();
await closeDb();
