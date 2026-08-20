import {
  bigint,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const publishers = pgTable(
  "publishers",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    store: text("store").notNull(),
    storeDeveloperId: text("store_developer_id").notNull(),
    name: text("name"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("publishers_store_developer_uidx").on(t.store, t.storeDeveloperId),
  ],
);

export const domains = pgTable(
  "domains",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    host: text("host").notNull(),
    body: text("body"),
    contentHash: char("content_hash", { length: 64 }),
    etag: text("etag"),
    lastModified: text("last_modified"),
    lastHttpStatus: integer("last_http_status"),
    lastError: text("last_error"),
    lastSuccessfullyFetched: ts("last_successfully_fetched"),
    availableAt: ts("available_at"),
    retryCount: integer("retry_count").notNull().default(0),
    lastQueuePushed: ts("last_queue_pushed"),
    lastChangedAt: ts("last_changed_at"),
  },
  (t) => [
    uniqueIndex("domains_host_uidx").on(t.host),
    index("domains_last_successfully_fetched_idx").on(t.lastSuccessfullyFetched),
    index("domains_last_queue_pushed_idx").on(t.lastQueuePushed),
  ],
);

export const apps = pgTable(
  "apps",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    store: text("store").notNull(),
    bundleId: text("bundle_id").notNull(),
    publisherId: bigint("publisher_id", { mode: "number" }).references(() => publishers.id),
    domainId: bigint("domain_id", { mode: "number" }).references(() => domains.id),
    title: text("title"),
    developerUrl: text("developer_url"),
    status: text("status").notNull().default("active"),
    lastHttpStatus: integer("last_http_status"),
    lastError: text("last_error"),
    lastSuccessfullyFetched: ts("last_successfully_fetched"),
    availableAt: ts("available_at"),
    retryCount: integer("retry_count").notNull().default(0),
    lastQueuePushed: ts("last_queue_pushed"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("apps_store_bundle_uidx").on(t.store, t.bundleId),
    index("apps_last_successfully_fetched_idx").on(t.lastSuccessfullyFetched),
    index("apps_last_queue_pushed_idx").on(t.lastQueuePushed),
    index("apps_domain_id_idx").on(t.domainId),
    index("apps_publisher_id_idx").on(t.publisherId),
    index("apps_store_idx").on(t.store),
  ],
);

export const appAdsRevisions = pgTable(
  "app_ads_revisions",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    domainId: bigint("domain_id", { mode: "number" })
      .notNull()
      .references(() => domains.id),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    body: text("body").notNull(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [unique("app_ads_revisions_domain_hash_uidx").on(t.domainId, t.contentHash)],
);

export const appChangeEvents = pgTable(
  "app_change_events",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    appId: bigint("app_id", { mode: "number" })
      .notNull()
      .references(() => apps.id),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    detectedAt: ts("detected_at").notNull().defaultNow(),
  },
  (t) => [index("app_change_events_app_detected_idx").on(t.appId, t.detectedAt)],
);
