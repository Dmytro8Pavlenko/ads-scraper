import { sql } from "drizzle-orm";

/**
 * Postgres timestamptz keeps microseconds; `Date` is milliseconds.
 * Exact `IS NOT DISTINCT FROM $seen` matches the first write (NULL) and then never again.
 */
export function fetchedAtUnchanged(seen: Date | null) {
  return sql`date_trunc('milliseconds', last_successfully_fetched) IS NOT DISTINCT FROM ${seen}`;
}
