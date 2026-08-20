import type { Db } from "../db/client.js";
import { sql } from "drizzle-orm";

type StoreClaim = { storeInterval: string; queueLease: string; limit: number };
type DomainClaim = { appAdsInterval: string; queueLease: string; limit: number };

export async function dueIos(db: Db, args: StoreClaim): Promise<number[]> {
  return dueApps(db, "ios", args);
}

export async function dueAndroid(db: Db, args: StoreClaim): Promise<number[]> {
  return dueApps(db, "android", args);
}

async function dueApps(db: Db, store: "ios" | "android", args: StoreClaim): Promise<number[]> {
  const rows = await db.execute<{ id: string }>(sql`
    WITH due AS (
      SELECT id FROM apps
      WHERE store = ${store}
        AND (last_successfully_fetched IS NULL
             OR last_successfully_fetched <= now() - ${args.storeInterval}::interval)
        AND (available_at IS NULL OR available_at <= now())
        AND (last_queue_pushed IS NULL
             OR last_queue_pushed <= now() - ${args.queueLease}::interval)
      FOR UPDATE SKIP LOCKED
      LIMIT ${args.limit}
    )
    UPDATE apps SET last_queue_pushed = now()
    FROM due
    WHERE apps.id = due.id
    RETURNING apps.id
  `);
  return rows.rows.map((r) => Number(r.id));
}

export async function dueAppAds(db: Db, args: DomainClaim): Promise<number[]> {
  const rows = await db.execute<{ id: string }>(sql`
    WITH due AS (
      SELECT id FROM domains
      WHERE (last_successfully_fetched IS NULL
             OR last_successfully_fetched <= now() - ${args.appAdsInterval}::interval)
        AND (available_at IS NULL OR available_at <= now())
        AND (last_queue_pushed IS NULL
             OR last_queue_pushed <= now() - ${args.queueLease}::interval)
      FOR UPDATE SKIP LOCKED
      LIMIT ${args.limit}
    )
    UPDATE domains SET last_queue_pushed = now()
    FROM due
    WHERE domains.id = due.id
    RETURNING domains.id
  `);
  return rows.rows.map((r) => Number(r.id));
}
