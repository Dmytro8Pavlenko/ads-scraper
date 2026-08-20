import { httpGet, isRetryableHttp, pickProxy } from "../lib/http.js";
import type { StoreWorkerConfig } from "../lib/config.js";
import type { StoreAdapter, StoreResult } from "./types.js";
import { storeNotFound, storeRetry } from "./types.js";

type LookupRow = {
  trackId?: number;
  bundleId?: string;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  sellerUrl?: string;
};

type LookupBody = {
  resultCount?: number;
  results?: LookupRow[];
};

export function parseLookup(bundleIds: string[], json: LookupBody): StoreResult[] {
  const byNumeric = new Map<string, LookupRow>();
  const byBundle = new Map<string, LookupRow>();
  for (const row of json.results ?? []) {
    if (row.trackId != null) byNumeric.set(String(row.trackId), row);
    if (row.bundleId) byBundle.set(row.bundleId, row);
  }

  return bundleIds.map((id) => {
    const row = byNumeric.get(id) ?? byBundle.get(id);
    if (!row) return storeNotFound(id);
    return {
      bundleId: id,
      ok: true,
      status: "active",
      title: row.trackName ?? null,
      developerUrl: row.sellerUrl ?? null,
      publisherName: row.artistName ?? null,
      storeDeveloperId: row.artistId != null ? String(row.artistId) : null,
      httpStatus: 200,
    };
  });
}

export function appleAdapter(config: StoreWorkerConfig): StoreAdapter {
  return {
    async fetch(bundleIds: string[]): Promise<StoreResult[]> {
      const numeric = bundleIds.filter((id) => /^\d+$/.test(id));
      const named = bundleIds.filter((id) => !/^\d+$/.test(id));
      const out: StoreResult[] = [];
      if (numeric.length > 0) {
        const url = `https://itunes.apple.com/lookup?id=${numeric.join(",")}&country=${config.storeCountry}`;
        out.push(...(await lookup(config, url, numeric)));
      }
      for (const id of named) {
        const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(id)}&country=${config.storeCountry}`;
        out.push(...(await lookup(config, url, [id])));
      }
      return out;
    },
  };
}

async function lookup(config: StoreWorkerConfig, url: string, ids: string[]): Promise<StoreResult[]> {
  let res;
  try {
    res = await httpGet(url, {
      timeoutMs: config.httpTimeout.ms,
      userAgent: config.userAgent,
      proxyUrl: pickProxy(config.proxies),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "lookup failed";
    return ids.map((id) => storeRetry(id, null, message));
  }

  if (isRetryableHttp(res.status) || res.status >= 400) {
    return ids.map((id) => storeRetry(id, res.status, `lookup http ${res.status}`));
  }

  try {
    return parseLookup(ids, JSON.parse(res.body) as LookupBody);
  } catch {
    return ids.map((id) => storeRetry(id, res.status, "lookup json"));
  }
}
