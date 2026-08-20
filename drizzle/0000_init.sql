CREATE TABLE publishers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store text NOT NULL,
  store_developer_id text NOT NULL,
  name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publishers_store_developer_uidx UNIQUE (store, store_developer_id)
);
--> statement-breakpoint
CREATE TABLE domains (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host text NOT NULL,
  body text,
  content_hash char(64),
  etag text,
  last_modified text,
  last_http_status integer,
  last_error text,
  last_successfully_fetched timestamptz,
  available_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_queue_pushed timestamptz,
  last_changed_at timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX domains_host_uidx ON domains (host);
--> statement-breakpoint
CREATE INDEX domains_last_successfully_fetched_idx ON domains (last_successfully_fetched);
--> statement-breakpoint
CREATE INDEX domains_last_queue_pushed_idx ON domains (last_queue_pushed);
--> statement-breakpoint
CREATE TABLE apps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store text NOT NULL,
  bundle_id text NOT NULL,
  publisher_id bigint REFERENCES publishers (id),
  domain_id bigint REFERENCES domains (id),
  title text,
  developer_url text,
  status text NOT NULL DEFAULT 'active',
  last_http_status integer,
  last_error text,
  last_successfully_fetched timestamptz,
  available_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_queue_pushed timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT apps_store_bundle_uidx UNIQUE (store, bundle_id)
);
--> statement-breakpoint
CREATE INDEX apps_last_successfully_fetched_idx ON apps (last_successfully_fetched);
--> statement-breakpoint
CREATE INDEX apps_last_queue_pushed_idx ON apps (last_queue_pushed);
--> statement-breakpoint
CREATE INDEX apps_domain_id_idx ON apps (domain_id);
--> statement-breakpoint
CREATE INDEX apps_publisher_id_idx ON apps (publisher_id);
--> statement-breakpoint
CREATE INDEX apps_store_idx ON apps (store);
--> statement-breakpoint
CREATE TABLE app_ads_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain_id bigint NOT NULL REFERENCES domains (id),
  content_hash char(64) NOT NULL,
  body text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_ads_revisions_domain_hash_uidx UNIQUE (domain_id, content_hash)
);
--> statement-breakpoint
CREATE TABLE app_change_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id bigint NOT NULL REFERENCES apps (id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX app_change_events_app_detected_idx ON app_change_events (app_id, detected_at);
