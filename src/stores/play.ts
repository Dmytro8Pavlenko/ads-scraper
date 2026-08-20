import { httpGet, isRetryableHttp, pickProxy } from "../lib/http.js";
import type { StoreWorkerConfig } from "../lib/config.js";
import type { StoreAdapter, StoreResult } from "./types.js";
import { storeNotFound, storeRetry } from "./types.js";

export function isPlayCaptcha(status: number, body: string, finalUrl: string): boolean {
  if (finalUrl.includes("/sorry/")) return true;
  if (status === 429) return true;
  if (/unusual traffic/i.test(body)) return true;
  if (/www\.google\.com\/recaptcha/i.test(body) && !/AF_initDataCallback/.test(body)) return true;
  return false;
}

export function parsePlayPage(bundleId: string, status: number, body: string): StoreResult {
  if (status === 404) return storeNotFound(bundleId, 404);

  const title =
    match1(body, /<meta property="og:title" content="([^"]+)"/) ??
    match1(body, /<h1[^>]*itemprop="name"[^>]*>\s*<span[^>]*>([^<]+)/);

  const storeDeveloperId =
    match1(body, /\/store\/apps\/dev\?id=(\d+)/) ??
    match1(body, /\/store\/apps\/developer\?id=([^"&]+)/);

  const publisherName =
    match1(body, /"author":\{"@type":"Person","name":"([^"]+)"/) ??
    match1(body, /href="\/store\/apps\/dev(?:eloper)?\?id=[^"]+"[^>]*>([^<]+)/);

  const decoded = unescapePlay(body);
  const developerUrl =
    match1(body, /<meta name="appstore:developer_url" content="([^"]*)"/) ??
    match1(body, /"developerWebsite":"([^"]+)"/) ??
    match1(body, /developer_website\\":\\"([^\\"]+)/) ??
    match1(
      decoded,
      /\/store\/apps\/dev(?:eloper)?\?id=[^"]+"\]\],"[^"]+"\],\[\[null,null,null,null,null,\[null,null,"(https?:[^"]+)"\]\]/,
    );

  return {
    bundleId,
    ok: true,
    status: "active",
    title,
    developerUrl,
    publisherName,
    storeDeveloperId: storeDeveloperId ? decodeURIComponent(storeDeveloperId) : null,
    httpStatus: status,
  };
}

function unescapePlay(body: string): string {
  return body
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replaceAll("\\/", "/");
}

function match1(body: string, re: RegExp): string | null {
  const m = re.exec(body);
  return m?.[1] ? decodeHtml(m[1]) : null;
}

function decodeHtml(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function playAdapter(config: StoreWorkerConfig): StoreAdapter {
  return {
    async fetch(bundleIds: string[]): Promise<StoreResult[]> {
      const out: StoreResult[] = [];
      for (const id of bundleIds) out.push(await fetchOne(config, id));
      return out;
    },
  };
}

async function fetchOne(config: StoreWorkerConfig, bundleId: string): Promise<StoreResult> {
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(bundleId)}&hl=en&gl=${config.storeCountry}`;
  let res;
  try {
    res = await httpGet(url, {
      timeoutMs: config.httpTimeout.ms,
      userAgent: config.userAgent,
      proxyUrl: pickProxy(config.proxies),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "play network";
    return storeRetry(bundleId, null, message);
  }

  if (isPlayCaptcha(res.status, res.body, res.finalUrl)) {
    return storeRetry(bundleId, res.status, "captcha");
  }
  if (isRetryableHttp(res.status) || (res.status >= 400 && res.status !== 404)) {
    return storeRetry(bundleId, res.status, `play http ${res.status}`);
  }
  return parsePlayPage(bundleId, res.status, res.body);
}
